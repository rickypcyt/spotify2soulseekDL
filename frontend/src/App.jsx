import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { request, requestJson } from './api/client'
import AppNavbar from './components/AppNavbar'
import LibraryPanel from './components/LibraryPanel'
import LogsPanel from './components/LogsPanel'
import PlaylistPicker from './components/PlaylistPicker'
import PlaylistSession from './components/PlaylistSession'
import PlayerBar from './components/PlayerBar'
import PlaylistTabBar from './components/PlaylistTabBar'
import { usePlayerState } from './player/usePlayer'
import SettingsPanel from './components/SettingsPanel'
import SoulseekAccountForm from './components/SoulseekAccountForm'
import SourceInput from './components/SourceInput'
import CoverPickerModal from './components/CoverPickerModal'
import WelcomeWizard from './components/WelcomeWizard'
import { FONT_BODY, isCompletedTransfer, isLibraryFile } from './constants'
import {
  loadHistory,
  saveLastPlaylist,
  loadPlaylistTabs,
  loadSearchPreferences,
  saveHistory,
  savePlaylistTabs,
  deletePlaylistSnapshot,
  saveSearchPreferences,
} from './utils/storage'
import { useConfig } from './hooks/useConfig'
import { useDiagnostics } from './hooks/useDiagnostics'
import { useLibraryIndex } from './hooks/useLibraryIndex'
import { useLibraryOps } from './hooks/useLibraryOps'
import { useLogs } from './hooks/useLogs'
import { useSpotifyAuth } from './hooks/useSpotifyAuth'
import { useTabNavigation } from './hooks/useTabNavigation'

const playlistTabKey = (provider, url) => `${provider || 'spotify'}::${url}`

// Identidad de una pestaña: la misma playlist de Spotify puede venir con distintos
// enlaces (?si=…, spotify:playlist:…). Se compara por el id, no por el texto pegado.
function tabIdentity(provider, url) {
  const prov = provider || 'spotify'
  const text = String(url || '').trim()
  if (prov === 'spotify') {
    const match = text.match(/playlist[/:]([A-Za-z0-9]{22})/)
    return `spotify::${match ? match[1] : text}`
  }
  return `${prov}::${text.toLowerCase()}`
}

// Quita pestañas repetidas (misma identidad), conservando la primera.
function dedupeTabs(tabs) {
  const seen = new Set()
  return tabs.filter((tab) => {
    const id = tabIdentity(tab.provider, tab.url)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

const SEARCH_PROVIDER_KEY = 'soulseek.searchProvider'

// Último modo de búsqueda elegido (Spotify o Soulseek); por defecto Soulseek.
function readStoredSearchProvider() {
  try {
    const value = window.localStorage.getItem(SEARCH_PROVIDER_KEY)
    return value === 'spotify' || value === 'soulseek' ? value : 'soulseek'
  } catch {
    return 'soulseek'
  }
}

function App() {
  const [bootstrapped, setBootstrapped] = useState(false)
  const [inputUrl, setInputUrl] = useState('')
  const [searchProvider, setSearchProvider] = useState(readStoredSearchProvider)
  const [coverPicker, setCoverPicker] = useState(null)
  const topBarRef = useRef(null)
  const { now: nowPlaying } = usePlayerState()

  useEffect(() => {
    try {
      window.localStorage.setItem(SEARCH_PROVIDER_KEY, searchProvider)
    } catch {
      // sin almacenamiento: el modo solo dura esta sesión
    }
  }, [searchProvider])

  // Los encabezados pegajosos (p. ej. playlists de la biblioteca) se anclan justo
  // debajo de la barra superior, así que necesitan conocer su alto real.
  useEffect(() => {
    const element = topBarRef.current
    if (!element) return undefined
    const update = () => {
      document.documentElement.style.setProperty('--topbar-h', `${element.offsetHeight}px`)
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [bootstrapped])
  const [urlHistory, setUrlHistory] = useState([])
  const [spotifyPlaylists, setSpotifyPlaylists] = useState([])
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false)
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  // Carpeta elegida manualmente para una playlist (override del nombre).
  const [folderOverrides, setFolderOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem('playlist_folder_overrides') || '{}') } catch { return {} }
  })

  const [completedTransfersOpen, setCompletedTransfersOpen] = useState(false)
  const [pickMode, setPickMode] = useState('quality')
  const [formatPref, setFormatPref] = useState('any')
  const [formatFilters, setFormatFilters] = useState(['mp3', 'wav', 'aiff', 'flac'])
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem('welcome_dismissed') === '1'
  )
  // ---- playlist tabs ----
  const [playlistTabs, setPlaylistTabs] = useState([])
  const [activePlaylistKey, setActivePlaylistKey] = useState(null)
  const [tabRefreshTicks, setTabRefreshTicks] = useState({})
  const [sessionMeta, setSessionMeta] = useState({})
  const [seededSnapshots] = useState({})
  const sessionHandlers = useRef({})
  const logRef = useRef(null)

  // Cargar estado inicial desde SQLite (vía API) al montar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tabsData, history, prefs] = await Promise.all([
        loadPlaylistTabs(),
        loadHistory(),
        loadSearchPreferences(),
      ])
      if (cancelled) return
      if (tabsData.tabs.length > 0) {
        const tabs = dedupeTabs(tabsData.tabs)
        // Limpiar el estado guardado de las pestañas repetidas que se descartan.
        tabsData.tabs
          .filter((t) => !tabs.some((kept) => kept.key === t.key))
          .forEach((t) => deletePlaylistSnapshot(t.key))
        setPlaylistTabs(tabs)
        const savedActive = tabsData.tabs.find((t) => t.key === tabsData.active)
        const active = (savedActive
          && tabs.find((t) => tabIdentity(t.provider, t.url) === tabIdentity(savedActive.provider, savedActive.url))?.key)
          || tabs[0].key
        setActivePlaylistKey(active)
        const activeTab = tabs.find((t) => t.key === active)
        if (activeTab) setInputUrl(activeTab.url)
      }
      // Antes, si no había pestañas se "resucitaba" aquí la última playlist guardada
      // por una versión antigua, y las pestañas cerradas volvían solas. Ese registro
      // ya no se usa: se vacía para que no quede cache muerto.
      saveLastPlaylist({})
      setUrlHistory(history)
      setPickMode(prefs.pickMode)
      setFormatPref(prefs.formatPref)
      setFormatFilters(prefs.formatFilters)
      setBootstrapped(true)
    })()
    return () => { cancelled = true }
  }, [])

  // ---- composed hooks ----
  const { navigate, activeTab } = useTabNavigation()
  const { config, setConfig, saveConfig, savingConfig, configLoaded } = useConfig()
  const { diagnostics, fetchDiagnostics } = useDiagnostics()
  const libraryActive = Object.values(sessionMeta).some(
    (m) => (m?.queued || 0) + (m?.active || 0) + (m?.searches || 0) > 0
  ) || (diagnostics?.transfers || []).some((t) => !isCompletedTransfer(t))
  const { libraryIndex, fetchLibraryIndex } = useLibraryIndex({ active: libraryActive })
  const { logs, backendOnline } = useLogs()
  const { spotifyAuth, startSpotifyAuth } = useSpotifyAuth()

  const {
    newLibraryFolderName, setNewLibraryFolderName, dragOverLibraryFolder, setDragOverLibraryFolder,
    deleteItem, cleanupAll, cancelTransfer, saveTemporaryPreviewToLibrary, moveLibraryFile, renameLibraryFile, createLibraryFolder, deleteLibraryFolder,
  } = useLibraryOps({ fetchDiagnostics })

  // ---- playlist tabs ----
  const openPlaylist = useCallback((rawUrl, provider) => {
    const target = (rawUrl || '').trim()
    if (!target) return
    const identity = tabIdentity(provider, target)
    const existing = playlistTabs.find((t) => tabIdentity(t.provider, t.url) === identity)
    const key = existing ? existing.key : playlistTabKey(provider, target)
    if (!existing) {
      setPlaylistTabs((prev) => (prev.some((t) => t.key === key)
        ? prev
        : [...prev, { key, url: target, provider: provider || 'spotify', name: '' }]))
    }
    // Una búsqueda de texto repetida reutiliza su pestaña (el estado de cada tab se
    // identifica por su texto) pero se vuelve a lanzar, para que "buscar" siempre haga algo.
    if (provider === 'soulseek') {
      setTabRefreshTicks((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
    }
    setActivePlaylistKey(key)
    setInputUrl(existing ? existing.url : target)
  }, [playlistTabs])

  const selectPlaylistTab = useCallback((key) => {
    setActivePlaylistKey(key)
    const tab = playlistTabs.find((t) => t.key === key)
    if (tab) setInputUrl(tab.url)
    if (activeTab !== 'main') navigate('/')
  }, [playlistTabs, activeTab, navigate])

  const closePlaylistTab = useCallback((key) => {
    const index = playlistTabs.findIndex((t) => t.key === key)
    const next = playlistTabs.filter((t) => t.key !== key)
    if (activePlaylistKey === key) {
      const fallback = next[Math.min(Math.max(index, 0), next.length - 1)]
      setActivePlaylistKey(fallback ? fallback.key : null)
      setInputUrl(fallback ? fallback.url : '')
    }
    setPlaylistTabs(next)
    delete sessionHandlers.current[key]
    setSessionMeta((prev) => {
      const nextMeta = { ...prev }
      delete nextMeta[key]
      return nextMeta
    })
    deletePlaylistSnapshot(key)
  }, [playlistTabs, activePlaylistKey])

  const closeAllPlaylistTabs = useCallback(() => {
    playlistTabs.forEach((tab) => {
      delete sessionHandlers.current[tab.key]
      deletePlaylistSnapshot(tab.key)
    })
    setPlaylistTabs([])
    setActivePlaylistKey(null)
    setInputUrl('')
    setSessionMeta({})
  }, [playlistTabs])

  const refreshPlaylistTab = useCallback((key) => {
    setTabRefreshTicks((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }))
  }, [])

  const handleSessionMeta = useCallback((key, meta) => {
    setSessionMeta((prev) => {
      const current = prev[key]
      if (current
        && current.name === meta.name
        && current.loading === meta.loading
        && current.trackCount === meta.trackCount
        && current.queued === meta.queued
        && current.active === meta.active
        && current.searches === meta.searches
        && current.quickSaveFolder === meta.quickSaveFolder) {
        return prev
      }
      return { ...prev, [key]: meta }
    })
  }, [])

  const handleSessionRegister = useCallback((key, handlers) => {
    sessionHandlers.current[key] = handlers
  }, [])

  const handleHistoryAdd = useCallback((entry) => {
    if (!entry?.url) return
    setUrlHistory((prev) => {
      const next = [entry, ...prev.filter((item) => item.url !== entry.url)]
      queueMicrotask(() => saveHistory(next))
      return next
    })
  }, [])

  // Persistir tabs abiertas + activa.
  useEffect(() => {
    if (!bootstrapped) return
    savePlaylistTabs(playlistTabs, activePlaylistKey)
  }, [bootstrapped, playlistTabs, activePlaylistKey])

  // ---- effects ----
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  useEffect(() => {
    if (!bootstrapped) return
    saveSearchPreferences(pickMode, formatPref, formatFilters)
  }, [bootstrapped, pickMode, formatPref, formatFilters])

  // ---- playlist loading / picking ----
  const preview = (event) => {
    event.preventDefault()
    openPlaylist(inputUrl, searchProvider)
  }

  // El modal se abre al instante (con lo que haya en memoria) y la lista se
  // refresca en segundo plano, así no hay que esperar a Spotify para verlo.
  const fetchSpotifyPlaylists = useCallback(async ({ silent = false } = {}) => {
    setPlaylistsLoading(true)
    try {
      const data = await requestJson('/api/spotify/playlists')
      setSpotifyPlaylists(data.playlists || [])
      return true
    } catch (err) {
      if (!silent) toast.error('No se pudieron cargar tus playlists: ' + err.message)
      return false
    } finally {
      setPlaylistsLoading(false)
    }
  }, [])

  const loadSpotifyPlaylists = () => {
    setPlaylistPickerOpen(true)
    fetchSpotifyPlaylists()
  }

  // Precarga silenciosa al conectar Spotify, para que el selector ya tenga datos.
  useEffect(() => {
    if (spotifyAuth.status === 'authenticated' && bootstrapped) fetchSpotifyPlaylists({ silent: true })
  }, [spotifyAuth.status, bootstrapped, fetchSpotifyPlaylists])

  const embedCoverInFile = useCallback(async (path, coverUrl) => {
    try {
      const response = await request('/api/library/cover/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, cover_url: coverUrl }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || 'No se pudo insertar la portada')
      await Promise.all([fetchDiagnostics(), fetchLibraryIndex()])
      toast.success('Portada insertada en el archivo')
    } catch (error) {
      toast.error(`No se pudo insertar la portada: ${error.message}`)
    }
  }, [fetchDiagnostics, fetchLibraryIndex])

  const revealFile = useCallback(async (path, dir = 'downloads') => {
    try {
      await requestJson('/api/file/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, dir }),
      })
    } catch (error) {
      toast.error(`No se pudo abrir la carpeta: ${error.message}`)
    }
  }, [])

  // Abre el selector de portadas; la promesa se resuelve al cerrarlo (con o sin cambios).
  const searchAndEmbedCover = useCallback((path, dir = 'downloads') => new Promise((resolve) => {
    setCoverPicker({ path, dir, name: path.split('/').pop() || path, token: Date.now(), resolve })
  }), [])

  const closeCoverPicker = useCallback(async (applied) => {
    const picker = coverPicker
    setCoverPicker(null)
    if (applied) {
      await Promise.all([fetchDiagnostics(), fetchLibraryIndex()])
      toast.success('Portada insertada en el archivo')
    }
    picker?.resolve?.()
  }, [coverPicker, fetchDiagnostics, fetchLibraryIndex])

  const syncLibraryBpm = useCallback(async (path) => {
    try {
      const data = await requestJson('/api/library/bpm/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      await Promise.all([fetchDiagnostics(), fetchLibraryIndex()])
      toast.success(`BPM ${data.bpm} guardado en el archivo`)
    } catch (error) {
      toast.error(`No se pudo guardar el BPM: ${error.message}`)
    }
  }, [fetchDiagnostics, fetchLibraryIndex])

  const convertLibraryFileToFlac = useCallback(async (path) => {
    try {
      await requestJson('/api/library/convert-flac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      await Promise.all([fetchDiagnostics(), fetchLibraryIndex()])
      toast.success('Archivo convertido a FLAC')
    } catch (error) {
      toast.error(`No se pudo convertir a FLAC: ${error.message}`)
    }
  }, [fetchDiagnostics, fetchLibraryIndex])

  const updateLibraryBpm = useCallback(async (path, bpm) => {
    try {
      const data = await requestJson('/api/library/bpm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, bpm }),
      })
      await Promise.all([fetchDiagnostics(), fetchLibraryIndex()])
      toast.success(`BPM ${data.bpm} guardado en el archivo`)
    } catch (error) {
      toast.error(`No se pudo guardar el BPM: ${error.message}`)
    }
  }, [fetchDiagnostics, fetchLibraryIndex])

  const searchAndUpdateMetadata = useCallback(async (path) => {
    try {
      const data = await requestJson('/api/library/metadata/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      await Promise.all([fetchDiagnostics(), fetchLibraryIndex()])
      toast.success(`Metadata guardada: ${data.track_name}`)
    } catch (error) {
      toast.error(`No se pudo buscar metadata: ${error.message}`)
    }
  }, [fetchDiagnostics, fetchLibraryIndex])

  const updateLibraryMetadata = useCallback(async (path, trackName, artists) => {
    try {
      const data = await requestJson('/api/library/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, track_name: trackName, artists }),
      })
      await Promise.all([fetchDiagnostics(), fetchLibraryIndex()])
      toast.success(`Metadata actualizada: ${data.track_name}`)
    } catch (error) {
      toast.error(`No se pudo actualizar la metadata: ${error.message}`)
    }
  }, [fetchDiagnostics, fetchLibraryIndex])

  const storedFileUrl = (dir, path) =>
    `/api/file/download?dir=${encodeURIComponent(dir)}&path=${encodeURIComponent(path)}`

  const storedFileStreamUrl = (dir, path) =>
    `/api/file/stream?dir=${encodeURIComponent(dir)}&path=${encodeURIComponent(path)}`

  const refreshLibrary = () => fetchDiagnostics()

  const validateSoulseek = useCallback(async (username, password) => {
    const data = await requestJson('/api/config/validate-soulseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    fetchDiagnostics()
    return data
  }, [fetchDiagnostics])

  const rememberFolderOverride = (playlistName, folder) => {
    setFolderOverrides((current) => {
      const next = { ...current, [playlistName]: folder }
      try { localStorage.setItem('playlist_folder_overrides', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // ---- derived values for the library / temporales panels ----
  const libraryFiles = useMemo(
    () => (diagnostics?.downloads || []).filter(isLibraryFile).sort((a, b) => a.path.localeCompare(b.path)),
    [diagnostics]
  )
  const libraryFolders = useMemo(() => diagnostics?.download_directories || [], [diagnostics])
  const localPlaylists = [...new Set([
    ...libraryFolders,
    ...libraryFiles.map((file) => file.path),
  ].map((path) => String(path).split('/').filter(Boolean)[0]).filter((name) => name && !['temp', '.incomplete'].includes(name.toLowerCase())))].sort((a, b) => a.localeCompare(b))

  // Guardado rápido de temporales desde SourceInput: usa la carpeta de la tab activa.
  const activeSessionMeta = activePlaylistKey ? sessionMeta[activePlaylistKey] : null
  const quickSaveTempFromInput = (path) => {
    const handler = sessionHandlers.current[activePlaylistKey]
    if (!handler) return false
    return handler.quickSaveTempFile(path)
  }

  const coverByPath = useMemo(() => {
    const map = {}
    if (libraryIndex) {
      for (const entry of Object.values(libraryIndex)) {
        if (entry?.path) map[entry.path] = entry.cover_url || ''
      }
    }
    return map
  }, [libraryIndex])
  const coverSourceByPath = useMemo(() => {
    const map = {}
    if (libraryIndex) {
      for (const entry of Object.values(libraryIndex)) {
        if (entry?.path) map[entry.path] = entry.cover_source_url || ''
      }
    }
    return map
  }, [libraryIndex])
  const bpmByPath = useMemo(() => {
    const map = {}
    if (libraryIndex) {
      for (const entry of Object.values(libraryIndex)) {
        if (entry?.path) map[entry.path] = entry.bpm || null
      }
    }
    return map
  }, [libraryIndex])
  const _isSpotifyTrackKey = (trackKey) => typeof trackKey === 'string' && trackKey.length === 22 && !trackKey.includes(':')

  const metadataByPath = useMemo(() => {
    const map = {}
    if (libraryIndex) {
      for (const entry of Object.values(libraryIndex)) {
        const path = entry?.path
        if (!path) continue
        const existing = map[path]
        if (!existing) {
          map[path] = { trackName: entry.track_name || '', artists: entry.artists || '', __trackKey: entry.track_key || '' }
          continue
        }
        const existingComplete = existing.trackName.trim() && existing.artists.trim()
        const currentComplete = (entry.track_name || '').trim() && (entry.artists || '').trim()
        const existingIsSpotify = _isSpotifyTrackKey(existing.__trackKey)
        const currentIsSpotify = _isSpotifyTrackKey(entry.track_key)
        if (currentIsSpotify && !existingIsSpotify) {
          map[path] = { trackName: entry.track_name || '', artists: entry.artists || '', __trackKey: entry.track_key || '' }
        } else if (currentComplete && !existingComplete) {
          map[path] = { trackName: entry.track_name || '', artists: entry.artists || '', __trackKey: entry.track_key || '' }
        }
      }
    }
    return map
  }, [libraryIndex])
  const previewFiles = diagnostics?.previews || []
  const queuedDownloadCount = Object.values(sessionMeta).reduce((sum, m) => sum + (m?.queued || 0), 0)
  const activeDownloadCount = Object.values(sessionMeta).reduce((sum, m) => sum + (m?.active || 0), 0)
  const pendingDownloadCount = queuedDownloadCount + activeDownloadCount
  const activeSearchCount = Object.values(sessionMeta).reduce((sum, m) => sum + (m?.searches || 0), 0)
  const transfers = diagnostics?.transfers || []
  const activeTransfers = transfers.filter((transfer) => !isCompletedTransfer(transfer))
  const completedTransfers = transfers.filter(isCompletedTransfer)

  return (
    <div
      className={`min-h-screen bg-[#10121A] text-[#E9EAF0] ${nowPlaying ? 'pb-28' : ''}`}
      style={{ fontFamily: FONT_BODY }}
    >
      <div className="w-full px-5 py-8 sm:px-10 sm:py-10">
        {/* Barra superior fija: navegación + tabs de playlists siempre visibles */}
        <div ref={topBarRef} className="sticky top-0 z-30 mb-8 bg-[#10121A] pb-2">
          <AppNavbar
            activeTab={activeTab}
            navigate={navigate}
            libraryCount={libraryFiles.length}
            pendingDownloadCount={pendingDownloadCount}
            queuedDownloadCount={queuedDownloadCount}
            activeDownloadCount={activeDownloadCount}
            activeSearchCount={activeSearchCount}
            statusProps={{ config, diagnostics, backendOnline, spotifyAuth, onStartSpotifyAuth: startSpotifyAuth }}
          />
          {activeTab === 'main' && (
            <PlaylistTabBar
              tabs={playlistTabs}
              activeKey={activePlaylistKey}
              meta={sessionMeta}
              onSelect={selectPlaylistTab}
              onClose={closePlaylistTab}
              onCloseAll={closeAllPlaylistTabs}
              onRefresh={refreshPlaylistTab}
            />
          )}
        </div>

        {activeTab === 'main' && (
          <>
            <SourceInput
              url={inputUrl}
              onUrlChange={setInputUrl}
              loading={false}
              onSubmit={preview}
              onLoadSpotifyPlaylists={loadSpotifyPlaylists}
              spotifyAuthStatus={spotifyAuth.status}
              searchProvider={searchProvider}
              onSearchProviderChange={setSearchProvider}
              onDownloadCompleted={fetchDiagnostics}
              localPlaylists={localPlaylists}
              quickSaveLabel={activeSessionMeta?.quickSaveFolder || ''}
              onQuickSaveTemp={quickSaveTempFromInput}
              onSaveTemp={saveTemporaryPreviewToLibrary}
              onDeleteTemp={(path) => deleteItem(path, 'previews')}
              storedFileStreamUrl={storedFileStreamUrl}
              storedFileUrl={storedFileUrl}
              onRevealFile={(path) => revealFile(path, 'previews')}
              recommendProps={{
                pickMode,
                onPickModeChange: setPickMode,
                formatPref,
                onFormatPrefChange: setFormatPref,
                formatFilters,
                onFormatFiltersChange: setFormatFilters,
              }}
            />
            <PlaylistPicker
              open={playlistPickerOpen}
              playlists={spotifyPlaylists}
              loading={playlistsLoading}
              onClose={() => setPlaylistPickerOpen(false)}
              onSelect={(playlistUrl) => {
                setPlaylistPickerOpen(false)
                openPlaylist(playlistUrl, 'spotify')
              }}
            />
          </>
        )}

        {activeTab === 'settings' && (
          <SoulseekAccountForm
            config={config}
            onChange={setConfig}
            onValidate={validateSoulseek}
            onSave={saveConfig}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsPanel
            config={config}
            onChange={setConfig}
            onSave={saveConfig}
            saving={savingConfig}
            open
          />
        )}

        {/* main grid: cards + monitor */}
        {activeTab === 'main' && (
          <div className="mb-5">
            <h2 className="text-xl font-semibold text-slate-100">2. Revisar y descargar canciones</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">Selecciona pistas, busca versiones disponibles y elige escuchar o descargar cada resultado.</p>
          </div>
        )}
        <div className={`grid grid-cols-1 gap-8 ${activeTab === 'main' ? 'lg:grid-cols-1' : 'lg:grid-cols-1'}`}>
          {/* Las sesiones quedan montadas aunque cambies de tab para que las
              búsquedas y descargas sigan en segundo plano. */}
          <div className={`min-w-0 ${activeTab === 'main' ? '' : 'hidden'}`}>
            {playlistTabs.map((tab) => (
              <PlaylistSession
                key={tab.key}
                session={tab}
                active={activeTab === 'main' && tab.key === activePlaylistKey}
                refreshTick={tabRefreshTicks[tab.key] || 0}
                initialSnapshot={seededSnapshots[tab.key]}
                onMeta={handleSessionMeta}
                onRegister={handleSessionRegister}
                onHistoryAdd={handleHistoryAdd}
                config={config}
                diagnostics={diagnostics}
                libraryIndex={libraryIndex}
                fetchDiagnostics={fetchDiagnostics}
                localPlaylists={localPlaylists}
                folderOverrides={folderOverrides}
                rememberFolderOverride={rememberFolderOverride}
                pickMode={pickMode}
                formatPref={formatPref}
                formatFilters={formatFilters}
                saveTemporaryPreviewToLibrary={saveTemporaryPreviewToLibrary}
                embedCoverInFile={embedCoverInFile}
                storedFileUrl={storedFileUrl}
                storedFileStreamUrl={storedFileStreamUrl}
              />
            ))}
          </div>

          {/* monitor column */}
          <div className={`${activeTab === 'main' ? 'hidden' : activeTab === 'logs' ? 'min-w-0 grid grid-cols-1 gap-4' : 'min-w-0 grid grid-cols-1 gap-4'}`}>
            <div className={`${activeTab === 'library' ? 'min-w-0' : 'hidden'}`}>
              <LibraryPanel
                newLibraryFolderName={newLibraryFolderName}
                onNewFolderNameChange={setNewLibraryFolderName}
                onCreateFolder={createLibraryFolder}
                onDeleteFolder={deleteLibraryFolder}
                config={config}
                onRefresh={refreshLibrary}
                diagnostics={diagnostics}
                libraryFiles={libraryFiles}
                libraryFolders={libraryFolders}
                coverByPath={coverByPath}
                coverSourceByPath={coverSourceByPath}
                onEmbedCover={embedCoverInFile}
                onSearchCover={searchAndEmbedCover}
                onRenameFile={renameLibraryFile}
                onConvertFlac={convertLibraryFileToFlac}
                movePlaylists={localPlaylists}
                onMoveToPlaylist={(path, folder) => moveLibraryFile({ dir: 'downloads', path }, folder)}
                onRevealFile={(path) => revealFile(path, 'downloads')}
                bpmByPath={bpmByPath}
                onSyncBpm={syncLibraryBpm}
                onUpdateBpm={updateLibraryBpm}
                metadataByPath={metadataByPath}
                onUpdateMetadata={updateLibraryMetadata}
                onSearchMetadata={searchAndUpdateMetadata}
                dragOverFolder={dragOverLibraryFolder}
                onDragOverFolder={setDragOverLibraryFolder}
                onMoveFile={moveLibraryFile}
                storedFileStreamUrl={storedFileStreamUrl}
                onDeleteFile={deleteItem}
                transfersProps={{
                  diagnostics,
                  activeTransfers,
                  completedTransfers,
                  completedTransfersOpen,
                  onToggleCompletedTransfers: setCompletedTransfersOpen,
                  onCancelTransfer: cancelTransfer,
                }}
                temporalesProps={{
                  diagnostics,
                  onCleanupAll: cleanupAll,
                  previewFiles,
                  storedFileStreamUrl,
                  onSaveTemporaryPreview: saveTemporaryPreviewToLibrary,
                  localPlaylists,
                  onSearchCover: (path) => searchAndEmbedCover(path, 'previews'),
                  onRevealFile: (path) => revealFile(path, 'previews'),
                  onDeleteFile: deleteItem,
                }}
              />
            </div>

            <div className={`${activeTab === 'logs' ? 'flex min-w-0' : 'hidden'}`}>
              <LogsPanel ref={logRef} logs={logs} backendOnline={backendOnline} />
            </div>

          </div>
        </div>
        {(() => {
          const setupIncomplete = !config.downloads_dir || !config.soulseek_username ||
            !config.spotify_client_id || !config.spotify_client_secret_configured
          const showWelcome = configLoaded && setupIncomplete && !welcomeDismissed
          return showWelcome && (
            <WelcomeWizard
              config={config}
              onChange={setConfig}
              onSave={saveConfig}
              saving={savingConfig}
              defaultDownloadsDir={diagnostics?.configuration?.downloads?.path}
              spotifyAuth={spotifyAuth}
              onStartSpotifyAuth={startSpotifyAuth}
              onDone={() => {
                localStorage.setItem('welcome_dismissed', '1')
                setWelcomeDismissed(true)
              }}
            />
          )
        })()}
        <CoverPickerModal picker={coverPicker} onClose={closeCoverPicker} />
        <PlayerBar />
        <ToastContainer
          position="top-right"
          autoClose={6000}
          theme="dark"
          newestOnTop
          closeOnClick
          pauseOnFocusLoss
          draggable
          limit={4}
          closeButton={false}
        />
      </div>
    </div>
  )
}

export default App
