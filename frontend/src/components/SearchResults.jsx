import AudioPlayer from './AudioPlayer'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock3, Download, Folder, Gauge, HardDrive, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'
import { requestJson } from '../api/client'
import { Chip } from './ui'
import PlaylistSelectModal from './PlaylistSelectModal'
import SearchActions from './SearchActions'
import { FONT_MONO, RESULTS_PER_TRACK, formatResultDuration, formatSize, formatSpeed } from '../constants'
import { extOf, pickBest, rankResults } from '../utils/resultPicker'

const LOSSLESS_EXTS = new Set(['flac', 'wav', 'alac', 'aiff', 'aif', 'ape', 'wv'])

function splitPath(fullName) {
  const parts = String(fullName).split(/[\\/]/).filter(Boolean)
  const file = parts.pop() || String(fullName)
  const base = file.replace(/\.[a-z0-9]{2,5}$/i, '') || file
  // Solo las dos últimas carpetas: suelen ser "Artista\Álbum".
  const folder = parts.slice(-2).join(' / ')
  return { base, folder }
}

function qualityTier(res) {
  const ext = extOf(res)
  const kbps = res.bitrate ? Math.round(res.bitrate / 1000) : null
  if (LOSSLESS_EXTS.has(ext)) {
    const depth = res.bitDepth || res.bit_depth
    const rate = res.sampleRate || res.sample_rate
    const sub = depth && rate ? `${depth}/${Math.round(rate / 100) / 10}` : 'lossless'
    return { sub, label: 'Sin pérdida', badge: 'border-[#7FD8CC]/40 bg-[#7FD8CC]/10 text-[#7FD8CC]' }
  }
  if (kbps && kbps >= 256) {
    return { sub: `${kbps}k`, label: `${kbps} kbps`, badge: 'border-[#FFFFFF]/25 bg-[#FFFFFF]/[0.07] text-[#E9EAF0]' }
  }
  if (kbps) {
    return { sub: `${kbps}k`, label: `${kbps} kbps · calidad baja`, badge: 'border-amber-400/40 bg-amber-400/10 text-amber-200' }
  }
  return { sub: '—', label: 'Bitrate desconocido', badge: 'border-[#3A3F4E] bg-[#161822] text-[#8D93A6]' }
}

function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null
  const total = Math.ceil(seconds)
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const remainingSeconds = total % 60
  if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function previewStatusLabel(preview) {
  const rawState = String(preview.transferState || '').toLowerCase()
  if (preview.state === 'encolando' || ['queued', 'queue', 'pending'].some((state) => rawState.includes(state))) {
    return 'en cola · esperando conexión'
  }
  if (['connecting', 'initializing', 'requested', 'negotiating'].some((state) => rawState.includes(state))) {
    return `conectando · ${Math.round(preview.percent || 0)}%`
  }
  if (rawState.includes('downloading') || rawState.includes('transferring')) {
    const speed = preview.transferSpeed ? formatSpeed(preview.transferSpeed) : 'sin velocidad todavía'
    const eta = preview.bytesRemaining && preview.transferSpeed
      ? formatEta(preview.bytesRemaining / preview.transferSpeed)
      : null
    return `descargando ${Math.round(preview.percent || 0)}% · ${speed}${eta ? ` · quedan ${eta}` : ''}`
  }
  if (rawState === 'unknown' || !rawState || rawState === 'starting') {
    return `consultando estado · ${Math.round(preview.percent || 0)}%`
  }
  return `${preview.transferState} · ${Math.round(preview.percent || 0)}%`
}

export default function SearchResults({
  search,
  limit = RESULTS_PER_TRACK,
  pickMode,
  formatPref,
  expanded,
  onToggleExpanded,
  collapsed,
  onToggleCollapsed,
  trackDownloaded,
  trackDownloads,
  localPlaylists = [],
  formatFilters = [],
  previews = {},
  onStartPreview,
  onSavePreview,
  quickSaveLabel,
  onQuickSavePreview,
  onDiscardPreview,
  onCancelPreview,
  storedFileStreamUrl,
  storedFileUrl,
  onCancelDownload,
  onRefreshSearch,
  onCancelSearch,
}) {
  const s = search
  const usernameKey = useMemo(() => [...new Set(
    (s.raw?.results || []).map((result) => result.username).filter(Boolean)
  )].sort().join("\u001f"), [s.raw?.results])
  const [presences, setPresences] = useState({})
  const [openSavePlaylistMenu, setOpenSavePlaylistMenu] = useState(null)
  const audioRef = useRef(null)

  useEffect(() => {
    const usernames = usernameKey ? usernameKey.split("\u001f") : []
    if (!usernames.length) return undefined
    let cancelled = false
    requestJson('/api/soulseek/users/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames }),
    }).then((data) => {
      if (!cancelled) setPresences((previous) => ({ ...previous, ...(data.statuses || {}) }))
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [usernameKey])

  if (!s.raw) {
    return (
      <div className="px-1 py-2 text-sm text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
        <p>esperando resultados&hellip;</p>
        <SearchActions searchId={s.searchId} onRefresh={onRefreshSearch} onCancel={onCancelSearch} />
      </div>
    )
  }
  const allResults = rankResults(s.raw.results || [], s.query, pickMode, formatPref, formatFilters)
  const total = allResults.length

  if (s.raw.error || s.raw.status === 'error') {
    return (
      <div className="py-2">
        <Chip tone="coral">
          error · {typeof s.raw.error === 'string' ? s.raw.error : JSON.stringify(s.raw.error)}
        </Chip>
      </div>
    )
  }

  const normalizedStatus = String(s.raw.status || s.raw.state || s.status || '').toLowerCase()
  const terminalStatuses = new Set(['completed', 'complete', 'finished', 'failed', 'cancelled', 'canceled', 'error'])
  const activeStatuses = new Set(['active', 'searching', 'inprogress', 'in_progress', 'pending', 'running', 'queued', 'started', 'buscando'])
  const stillSearching =
    !s.raw?.isComplete &&
    !terminalStatuses.has(normalizedStatus) &&
    (activeStatuses.has(normalizedStatus) || !normalizedStatus && (s.pollCount || 0) < 10)

  if (!Array.isArray(allResults) || allResults.length === 0) {
    return stillSearching ? (
      <div className="py-2">
        <Chip tone="amber">buscando resultados…</Chip>
      </div>
    ) : (
      <p className="py-2 text-xs text-[#8D93A6]">
        sin resultados
      </p>
    )
  }

  const results = allResults
  const bestPick = pickBest(allResults, pickMode, formatPref, formatFilters)
  // Si hay un preview sonando en este bloque no lo cerramos al completarse la
  // descarga: el reproductor no debe desaparecer mientras se escucha.
  const hasActivePreview = results.some((res) => {
    const preview = previews[`${res.username}|${res.filename}`]
    return preview && preview.state !== 'error'
  })
  const getDownloadForResult = (res) => trackDownloads.find((download) =>
    download.username === res.username && download.filename === res.filename
  )

  return (
    <details
      key={s.searchId}
      open={!collapsed && (!trackDownloaded || hasActivePreview)}
      onToggle={(event) => {
        const isOpen = event.currentTarget.open
        onToggleCollapsed(s.searchId, isOpen)
      }}
      className="group rounded-md border border-[#2C303D] bg-[#0D0F16]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-2.5 py-2 text-[11px] text-[#8D93A6] [&::-webkit-details-marker]:hidden">
        <span style={{ fontFamily: FONT_MONO }}>
          Resultados Soulseek · {total} resultado(s)
        </span>
        <ChevronDown size={14} className="shrink-0 transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <div className="space-y-1.5 border-t border-[#2C303D] p-2.5">
        <p className="text-[11px] text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
          {total} resultado(s){total > 2 ? ' · scroll para ver más' : ''}
        </p>
      <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
      {results.map((res, i) => {
        const resultDownload = getDownloadForResult(res)
        const activePreview = previews[`${res.username}|${res.filename}`]
        const isThisPreview = Boolean(activePreview)
        const isBusy = activePreview && !activePreview.error && activePreview.state !== 'completado'
        const progress = Math.min(100, Math.max(0, Number(resultDownload?.percent || 0)))
        const remainingBytes = Number(res.size) * (1 - progress / 100)
        const eta = resultDownload?.state === 'completado'
          ? null
          : formatEta(remainingBytes / Number(res.speed))
        const presence = presences[res.username] || 'desconocido'
        const presenceTitle = eta
          ? `Usuario ${presence} · descarga aproximada: ${eta}`
          : `Usuario ${presence}`
        const fullName = res.filename || res.file || res.name || res.path || `Resultado ${i + 1}`
        const { base, folder } = splitPath(fullName)
        const ext = extOf(res)
        const quality = qualityTier(res)
        const isBest = res === bestPick
        const duration = formatResultDuration(res)
        const isTransferring = isThisPreview && ['encolando', 'descargando'].includes(activePreview.state)
        const previewProgress = isTransferring ? Math.min(100, Math.max(0, Number(activePreview.percent || 0))) : 0
        return (
        <div
          key={`${res.username || 'unknown'}|${res.filename || res.path || i}|${res.size || 0}`}
          className={`fade-in relative overflow-hidden rounded-lg border p-2.5 transition-colors ${isBest
            ? 'border-[#7FD8CC]/45 bg-[#7FD8CC]/[0.04] hover:border-[#7FD8CC]/70'
            : isThisPreview
              ? 'border-[#3A3F4E] bg-[#12141C]'
              : 'border-[#2C303D] bg-[#0F1117] hover:border-[#3A3F4E] hover:bg-[#12141C]'}`}
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-start gap-2.5">
            <div
              className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-md border py-1.5 leading-none ${quality.badge}`}
              style={{ fontFamily: FONT_MONO }}
              title={quality.label}
            >
              <span className="text-[11px] font-semibold tracking-wide">{(ext || '?').toUpperCase().slice(0, 4)}</span>
              <span className="mt-1 text-[9px] opacity-75">{quality.sub}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-1.5">
                <p className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-[13px] font-medium leading-snug text-[#E9EAF0]" title={fullName}>
                  {base}
                </p>
                {isBest && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#7FD8CC] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#10121A]">
                    <Sparkles size={9} strokeWidth={2.5} /> Top
                  </span>
                )}
              </div>
              {folder && (
                <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10.5px] text-[#565C6E]" style={{ fontFamily: FONT_MONO }} title={folder}>
                  <Folder size={10} className="shrink-0" />
                  <span className="truncate [direction:rtl] text-left">{folder}</span>
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
                {res.username && (
                  <span className="inline-flex min-w-0 items-center gap-1.5" title={presenceTitle}>
                    <span
                      aria-label={presenceTitle}
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${presences[res.username] === 'Online'
                        ? 'bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60'
                        : presences[res.username] === 'Away'
                          ? 'bg-amber-400'
                          : presences[res.username] === 'Offline'
                            ? 'bg-slate-500'
                            : 'bg-slate-600'
                      }`}
                    />
                    <span className="max-w-[140px] truncate">{res.username}</span>
                  </span>
                )}
                {res.size ? (
                  <span className="inline-flex items-center gap-1"><HardDrive size={11} strokeWidth={1.8} />{formatSize(res.size)}</span>
                ) : null}
                {res.speed ? (
                  <span className="inline-flex items-center gap-1"><Gauge size={11} strokeWidth={1.8} />{formatSpeed(res.speed)}</span>
                ) : null}
                {duration && (
                  <span className="inline-flex items-center gap-1"><Clock3 size={11} strokeWidth={1.8} />{duration}</span>
                )}
                {eta && !isTransferring && (
                  <span className="text-[#565C6E]" title="Tiempo estimado de descarga">~{eta}</span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                onClick={() => onStartPreview(res)}
                disabled={isBusy}
                title="Descargar y previsualizar"
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isBest
                  ? 'bg-[#7FD8CC] text-[#10121A] hover:bg-[#9BE3DA]'
                  : 'bg-[#FFFFFF] text-[#161822] hover:bg-[#E9EAF0]'}`}
              >
                {isTransferring ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} strokeWidth={2.2} />}
                {isTransferring ? 'Bajando' : 'Descargar'}
              </button>
              {isThisPreview && activePreview.state !== 'completado' && activePreview.state !== 'error' && (
                <button
                  onClick={() => onCancelPreview(res)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-[#8D93A6] transition-colors hover:text-[#F28B82]"
                >
                  <X size={11} /> Cancelar
                </button>
              )}
            </div>
          </div>

          {isTransferring && (
            <div className="mt-2">
              <p className="mb-1 text-[10.5px] text-amber-200/90" style={{ fontFamily: FONT_MONO }}>
                {previewStatusLabel(activePreview)}
              </p>
              <div className="h-1 overflow-hidden rounded-full bg-[#2C303D]">
                <div
                  className="h-full rounded-full bg-amber-300 transition-[width] duration-500"
                  style={{ width: `${Math.max(previewProgress, 3)}%` }}
                />
              </div>
            </div>
          )}
          {isThisPreview && (
            <div className="mt-2">

              {activePreview.state === 'completado' && activePreview.path && (
                <>
                  <div className="mt-1 flex items-center gap-2">
                    <AudioPlayer
                      audioRef={audioRef}
                      size="sm"
                      src={activePreview.savedPath
                        ? storedFileStreamUrl('downloads', activePreview.savedPath)
                        : `/api/preview/stream?path=${encodeURIComponent(activePreview.path)}`}
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        audioRef.current?.pause()
                        audioRef.current?.load()
                      }}
                      title="Recargar preview"
                      aria-label="Recargar preview"
                      className="shrink-0 rounded border border-[#2C303D] px-1.5 py-1 text-[#8D93A6] transition-colors hover:border-[#FFFFFF]/40 hover:text-[#E9EAF0]"
                    >
                      <RefreshCw size={11} />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {quickSaveLabel && !activePreview.savedPath && (
                      <button
                        onClick={() => {
                          audioRef.current?.pause()
                          audioRef.current?.removeAttribute('src')
                          audioRef.current?.load()
                          onQuickSavePreview(activePreview)
                        }}
                        title={`Guardar directo en la carpeta “${quickSaveLabel}”`}
                        className="max-w-56 truncate rounded border border-[#1DB954]/50 px-2 py-1 text-[11px] font-medium text-[#1DB954] transition-colors hover:bg-[#1DB954]/10"
                      >
                        Guardar en {quickSaveLabel}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (localPlaylists.length > 0 && !activePreview.savedPath) {
                          setOpenSavePlaylistMenu(activePreview.filename)
                        } else {
                          audioRef.current?.pause()
                          audioRef.current?.removeAttribute('src')
                          audioRef.current?.load()
                          onSavePreview(activePreview)
                        }
                      }}
                      disabled={Boolean(activePreview.savedPath)}
                      className="rounded border border-[#FFFFFF]/40 px-2 py-1 text-[11px] font-medium text-[#FFFFFF] transition-colors hover:bg-[#FFFFFF]/10 disabled:cursor-default disabled:opacity-60"
                    >
                      {activePreview.savedPath ? 'Guardado en biblioteca' : 'guardar en otra carpeta'}
                    </button>
                    <PlaylistSelectModal
                      open={openSavePlaylistMenu === activePreview.filename}
                      playlists={localPlaylists}
                      subtitle={activePreview.filename}
                      onClose={() => setOpenSavePlaylistMenu(null)}
                      onSelect={(playlist) => {
                        audioRef.current?.pause()
                        audioRef.current?.removeAttribute('src')
                        audioRef.current?.load()
                        setOpenSavePlaylistMenu(null)
                        if (playlist) onSavePreview(activePreview, playlist)
                        else onSavePreview(activePreview)
                      }}
                    />
                    {!activePreview.savedPath && (
                      <button
                        onClick={() => {
                          audioRef.current?.pause()
                          audioRef.current?.removeAttribute('src')
                          audioRef.current?.load()
                          onDiscardPreview(activePreview)
                        }}
                        className="rounded border border-[#6B7280]/40 px-2 py-1 text-[11px] text-[#8D93A6] transition-colors hover:border-[#6B7280] hover:text-[#E9EAF0]"
                      >
                        descartar archivo
                      </button>
                    )}
                    <a
                      href={activePreview.savedPath
                        ? storedFileUrl('downloads', activePreview.savedPath)
                        : storedFileUrl('previews', activePreview.path)}
                      className="inline-flex rounded border border-[#2C303D] px-2 py-1 text-[11px] text-[#8D93A6] transition-colors hover:border-[#FFFFFF]/40 hover:text-[#E9EAF0]"
                    >
                      Descargar archivo
                    </a>
                  </div>
                </>
              )}
              {activePreview.state === 'offline' && (
                <Chip tone="amber">usuario offline · inténtalo más tarde</Chip>
              )}
              {activePreview.state === 'no_disponible' && (
                <Chip tone="amber">usuario no disponible</Chip>
              )}
              {activePreview.state === 'error' && (
                <Chip tone="coral">error · {activePreview.error}</Chip>
              )}

            </div>
          )}
          {resultDownload && (
            <div className="mt-2">
              {resultDownload.state === 'encolando' && <Chip tone="queued">encolando</Chip>}
              {resultDownload.state === 'descargando' && (
                <Chip tone="active">descargando {Math.round(resultDownload.percent || 0)}%</Chip>
              )}
              {resultDownload.state === 'completado' && resultDownload.path && (
                <Chip tone="teal">guardado · {resultDownload.path}</Chip>
              )}
              {resultDownload.state === 'cancelado' && <Chip tone="neutral">cancelado</Chip>}
              {resultDownload.state === 'offline' && (
                <Chip tone="amber">usuario offline · inténtalo más tarde</Chip>
              )}
              {resultDownload.state === 'no_disponible' && (
                <Chip tone="amber">usuario no disponible</Chip>
              )}
              {resultDownload.state === 'error' && (
                <Chip tone="coral">error · {resultDownload.error}</Chip>
              )}
              {!['completado', 'error', 'cancelado', 'offline', 'no_disponible'].includes(resultDownload.state) && (
                <button
                  onClick={() => onCancelDownload(resultDownload.id)}
                  className="ml-2 rounded border border-[#FFFFFF]/40 px-2 py-1 text-[11px] text-[#FFFFFF] transition-colors hover:bg-[#FFFFFF]/10"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>
        )
      })}
      </div>
      </div>
    </details>
  )
}
