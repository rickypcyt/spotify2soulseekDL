import { Cloud, ListMusic, Search, Youtube } from 'lucide-react'
import { useConfirm } from './ConfirmDialog.jsx'
import { useState } from 'react'
import { FONT_MONO, formatSize } from '../constants'
import LibraryAudioCard from './LibraryAudioCard'
import RecommendConfig from './RecommendConfig'

// Carpeta de la biblioteca donde se guarda por defecto cada origen (se crea sola).
const DEFAULT_FOLDERS = { soundcloud: 'SoundCloud', youtube: 'YouTube' }

export default function SourceInput({
  url,
  onUrlChange,
  loading,
  onSubmit,
  onLoadSpotifyPlaylists,
  spotifyAuthStatus,
  searchProvider,
  onSearchProviderChange,
  onDownloadCompleted,
  localPlaylists = [],
  onSaveTemp,
  onDeleteTemp,
  storedFileStreamUrl,
  storedFileUrl,
  onRevealFile,
  recommendProps,
}) {
  const confirm = useConfirm()
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [youtubeLoading, setYoutubeLoading] = useState(false)
  const [youtubeMessage, setYoutubeMessage] = useState('')
  const [soundcloudUrl, setSoundcloudUrl] = useState('')
  const [soundcloudLoading, setSoundcloudLoading] = useState(false)
  const [soundcloudMessage, setSoundcloudMessage] = useState('')
  const [downloadedPreview, setDownloadedPreview] = useState(null) // { path, name }

  async function handleSoundCloudDownload(event) {
    event.preventDefault()
    if (!soundcloudUrl.trim()) return
    setSoundcloudLoading(true)
    setSoundcloudMessage('')
    try {
      const res = await fetch('/api/soundcloud/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: soundcloudUrl }),
      })
      const data = await res.json()
      if (data.ok) {
        if (data.rel) setDownloadedPreview({ path: data.rel, name: data.rel.split('/').pop(), source: 'soundcloud' })
        onDownloadCompleted?.()
      }
      setSoundcloudMessage(data.ok ? `Preview descargado: ${data.rel || data.file}` : `Error: ${data.error}`)
    } catch (error) {
      setSoundcloudMessage('Error de red')
    } finally {
      setSoundcloudLoading(false)
    }
  }

  async function handleYouTubeDownload(event) {
    event.preventDefault()
    if (!youtubeUrl.trim()) return
    setYoutubeLoading(true)
    setYoutubeMessage('')
    try {
      const res = await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      })
      const data = await res.json()
      if (data.ok) {
        if (data.rel) setDownloadedPreview({ path: data.rel, name: data.rel.split('/').pop(), source: 'youtube' })
        setYoutubeMessage(`Preview descargado: ${data.rel || data.file}`)
        onDownloadCompleted?.()

      } else {
        setYoutubeMessage(`Error: ${data.error}`)
      }
    } catch (error) {
      setYoutubeMessage('Error de red')
    } finally {
      setYoutubeLoading(false)
    }
  }

  const isSpotify = searchProvider === 'spotify'
  const spotifyReady = spotifyAuthStatus === 'authenticated'

  const modeButton = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => onSearchProviderChange(value)}
      aria-pressed={searchProvider === value}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
        searchProvider === value
          ? 'bg-[#2C303D] font-medium text-[#E9EAF0] shadow-[inset_0_-2px_0_#7FD8CC]'
          : 'border border-transparent text-[#8D93A6] hover:border-[#2C303D] hover:bg-[#1A1D28] hover:text-[#E9EAF0]'
      }`}
    >
      <Icon size={16} className={searchProvider === value ? 'text-[#7FD8CC]' : ''} />
      {label}
    </button>
  )

  const cardClass = 'mb-6 rounded-xl border border-[#2C303D] bg-[#161822] p-5 sm:p-6'
  const inputClass = 'w-full rounded-lg border border-[#2C303D] bg-[#0F1117] px-3.5 py-3 text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none transition-colors focus:border-[#7FD8CC]/70'
  const submitClass = 'whitespace-nowrap rounded-lg bg-[#FFFFFF] px-6 py-3 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <>
      <section className={cardClass}>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[#E9EAF0]">Buscar música</h2>
          <p className="mt-1 text-sm text-[#8D93A6]">
            {isSpotify
              ? 'Carga una playlist de Spotify y busca todas sus canciones en Soulseek.'
              : 'Escribe lo que quieras y búscalo directamente en Soulseek.'}
          </p>
        </div>

        <div className="mb-4 flex gap-2 rounded-xl border border-[#2C303D] bg-[#0F1117] p-1.5" role="group" aria-label="Tipo de búsqueda">
          {modeButton('spotify', ListMusic, 'Playlist de Spotify')}
          {modeButton('soulseek', Search, 'Búsqueda en Soulseek')}
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
          {isSpotify && (
            <button
              type="button"
              onClick={onLoadSpotifyPlaylists}
              disabled={!spotifyReady}
              title={spotifyReady ? 'Elegir una de tus playlists de Spotify' : 'Conecta Spotify desde Configuración primero'}
              className="flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-[#7FD8CC]/40 bg-[#7FD8CC]/10 px-5 py-3 text-sm font-medium text-[#7FD8CC] transition-colors hover:bg-[#7FD8CC]/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ListMusic size={16} />
              Mis playlists
            </button>
          )}
          <input
            type="text"
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder={isSpotify ? 'Pega el enlace de una playlist de Spotify' : 'artista - canción'}
            className={inputClass}
            style={{ fontFamily: FONT_MONO }}
            autoFocus
          />
          <button type="submit" disabled={loading} className={submitClass}>
            {loading ? 'Buscando…' : isSpotify ? 'Cargar playlist' : 'Buscar'}
          </button>
        </form>

        {isSpotify && !spotifyReady && (
          <p className="mt-3 text-xs text-[#8D93A6]">
            Para elegir entre tus playlists, conecta Spotify desde Configuración. También puedes pegar el enlace de cualquier playlist.
          </p>
        )}

        {recommendProps && <RecommendConfig {...recommendProps} />}
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2C303D] text-[#7FD8CC]"><Cloud size={18} /></span>
          <div>
            <h2 className="text-base font-semibold text-[#E9EAF0]">SoundCloud · FLAC</h2>
            <p className="text-xs text-[#8D93A6]">Descarga tracks y playlists públicas. Se guardan por defecto en la carpeta «SoundCloud».</p>
          </div>
        </div>
        <form onSubmit={handleSoundCloudDownload} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={soundcloudUrl}
            onChange={(e) => setSoundcloudUrl(e.target.value)}
            placeholder="Pega un enlace de SoundCloud"
            className={inputClass}
            style={{ fontFamily: FONT_MONO }}
          />
          <button type="submit" disabled={soundcloudLoading} className={submitClass}>
            {soundcloudLoading ? 'Descargando…' : 'Descargar FLAC'}
          </button>
        </form>
        {soundcloudMessage && <p className="mt-3 text-sm text-[#8D93A6]">{soundcloudMessage}</p>}
      </section>

      <section className={cardClass}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2C303D] text-[#7FD8CC]"><Youtube size={18} /></span>
          <div>
            <h2 className="text-base font-semibold text-[#E9EAF0]">YouTube · FLAC</h2>
            <p className="text-xs text-[#8D93A6]">Descarga el audio de un video. Se guarda por defecto en la carpeta «YouTube».</p>
          </div>
        </div>
        <form onSubmit={handleYouTubeDownload} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Pega un enlace de YouTube"
            className={inputClass}
            style={{ fontFamily: FONT_MONO }}
          />
          <button type="submit" disabled={youtubeLoading} className={submitClass}>
            {youtubeLoading ? 'Descargando…' : 'Descargar FLAC'}
          </button>
        </form>
        {youtubeMessage && <p className="mt-3 text-sm text-[#8D93A6]">{youtubeMessage}</p>}
      </section>

      {downloadedPreview && (() => {
        const defaultFolder = DEFAULT_FOLDERS[downloadedPreview.source] || ''
        return (
          <div className="mt-5 w-full">
            <p className="mb-2 text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
              descargado · temporal{defaultFolder ? ` · se guardará en «${defaultFolder}»` : ''}
            </p>
            <LibraryAudioCard
              file={downloadedPreview}
              streamUrl={storedFileStreamUrl?.('previews', downloadedPreview.path)}
              coverUrl={`/api/library/cover?dir=previews&path=${encodeURIComponent(downloadedPreview.path)}`}
              onDownload={async (path, playlist) => {
                const ok = await onSaveTemp?.(path, playlist)
                if (ok !== false) setDownloadedPreview(null)
              }}
              quickSaveLabel={defaultFolder}
              onQuickSave={async (path) => {
                const ok = await onSaveTemp?.(path, defaultFolder)
                if (ok !== false) setDownloadedPreview(null)
              }}
              downloadPlaylists={localPlaylists}
              downloadLabel="guardar en otra carpeta"
              downloadUrl={storedFileUrl?.('previews', downloadedPreview.path)}
              onRevealFile={onRevealFile ? (path) => onRevealFile(path, 'previews') : undefined}
              formatSize={formatSize}
              onDelete={async (path) => {
                if (await confirm(`¿Borrar ${path}?`, { title: 'Borrar archivo', confirmLabel: 'Borrar' })) {
                  onDeleteTemp?.(path)
                  setDownloadedPreview(null)
                }
              }}
            />
          </div>
        )
      })()}
    </>
  )
}
