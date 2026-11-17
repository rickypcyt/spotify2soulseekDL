import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { CheckCircle2, Clock3, Copy, Eye, EyeOff, RotateCcw, Search } from 'lucide-react'
import { Checkbox, Chip } from './ui'
import SearchResults from './SearchResults'
import SpotifyEmbed from './SpotifyEmbed'
import { FONT_MONO, RESULTS_PER_TRACK, formatDuration } from '../constants'

export default function TrackCard({
  track,
  index,
  localPlaylists,
  formatFilters,
  selected,
  onToggleSelect,
  actualDownloaded,
  manuallyDownloaded,
  onToggleManualDownloaded,
  ignored,
  onToggleIgnored,
  trackDownloads,
  spotifyTrackId,
  search,
  expandedSearches,
  onToggleExpandedSearch,
  collapsedSearches,
  onToggleCollapsedSearch,
  onUpdateQuery,
  onCopy,
  onSearchTrack,
  pickMode,
  formatPref,
  previews,
  onStartPreview,
  onSavePreview,
  quickSaveLabel,
  onQuickSavePreview,
  onDiscardPreview,
  onCancelPreview,
  onSaveSpotifyPreview,
  storedFileStreamUrl,
  storedFileUrl,
  onCancelDownload,
  onEmbedCover,
  onRefreshSearch,
  onCancelSearch,
  embedOpen,
  onToggleEmbed,
}) {
  const t = track
  const i = index
  const downloaded = actualDownloaded || manuallyDownloaded || trackDownloads.some((download) => download.state === 'completado')
  const localCoverUrl = trackDownloads.find((download) => download.state === 'completado' && download.coverUrl)?.coverUrl

  // Preview activo de Soulseek en los resultados de este track: no debe
  // cortarse ni taparse cuando la descarga del track termina.
  const hasActivePreview = Boolean(
    search && (search.raw?.results || []).some((res) => {
      const preview = previews[`${res.username}|${res.filename}`]
      return preview && preview.state !== 'error'
    })
  )

  const hasDownloading = trackDownloads.some((download) => download.state === 'descargando')
  const hasQueued = trackDownloads.some((download) => download.state === 'encolando')
  const isSearching = Boolean(search && !search.raw?.isComplete)
  const hasNoResults = Boolean(search?.raw?.isComplete && (search?.raw?.results || []).length === 0)

  const borderClass = downloaded
    ? 'border-[#6B7280]/60'
    : hasDownloading
      ? 'border-emerald-400/60'
      : hasQueued
        ? 'border-blue-400/60'
        : hasNoResults
          ? 'border-red-400/60'
          : isSearching
            ? 'border-amber-400/60'
            : 'border-[#2C303D]'

  const notifiedPercents = useRef({})

  useEffect(() => {
    trackDownloads.forEach((download) => {
      if (download.state === 'descargando') {
        const percent = Math.round(download.percent || 0)
        if (percent > 0 && percent % 25 === 0 && notifiedPercents.current[download.id] !== percent) {
          notifiedPercents.current[download.id] = percent
          toast.info(`Descargando · ${percent}% · ${download.filename}`)
        }
      }
    })
  }, [trackDownloads])

  return (
    <div
      key={i}
      className={`group relative overflow-visible fade-in rounded-xl border bg-[#161822] p-5 ${borderClass} ${ignored ? 'opacity-70' : ''}`}
      style={{ animationDelay: `${i * 40}ms` }}
    >
      <div className="flex items-start gap-4">
        <div className="flex shrink-0 flex-col items-center gap-1.5 pt-1">
          <Checkbox
            checked={selected}
            onChange={() => onToggleSelect(i)}
            title="Seleccionar pista"
            size={22}
          />
        </div>
        {(localCoverUrl || t.cover_url) ? (
          <img
            src={localCoverUrl || t.cover_url}
            alt={`Portada de ${t.track_name}`}
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold leading-tight text-[#E9EAF0]">
            {t.track_name}
          </h3>
          <p className="mt-0.5 truncate text-sm text-[#8D93A6]">
            {t.artists}
            {t.album ? ` · ${t.album}` : ''}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
            <Clock3 size={14} strokeWidth={1.8} aria-hidden="true" />
            <span>{formatDuration(t.duration_ms)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onToggleManualDownloaded(t, i)}
          disabled={actualDownloaded}
          aria-pressed={manuallyDownloaded}
          aria-label={actualDownloaded ? 'La canción ya está descargada' : manuallyDownloaded ? 'Quitar marca de descargada' : 'Marcar como descargada'}
          title={actualDownloaded ? 'Detectada en la biblioteca' : manuallyDownloaded ? 'Quitar marca de descargada' : 'Marcar como descargada'}
          className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm transition-colors ${downloaded
            ? 'border-[#7FD8CC]/50 bg-[#7FD8CC]/10 text-[#7FD8CC] hover:border-[#7FD8CC]'
            : 'border-[#2C303D] text-[#8D93A6] hover:border-[#7FD8CC]/50 hover:text-[#E9EAF0]'} disabled:cursor-default disabled:opacity-100`}
        >
          <CheckCircle2 size={16} strokeWidth={2} />
          <span className="hidden sm:inline">{downloaded ? 'Descargada' : 'Marcar descargada'}</span>
        </button>
        <button
          type="button"
          onClick={() => onToggleIgnored(t, i)}
          aria-pressed={ignored}
          aria-label={ignored ? 'Quitar de ignoradas' : 'Ignorar pista'}
          title={ignored ? 'Restaurar pista' : 'Ignorar pista'}
          className={`flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-sm transition-colors ${ignored
            ? 'border-amber-400/50 bg-amber-400/10 text-amber-200 hover:border-amber-400'
            : 'border-[#2C303D] text-[#8D93A6] hover:border-[#3A3F4E] hover:text-[#E9EAF0]'}`}
        >
          {ignored ? <Eye size={16} strokeWidth={2} /> : <EyeOff size={16} strokeWidth={2} />}
          <span className="hidden sm:inline">{ignored ? 'Restaurar' : 'Ignorar'}</span>
        </button>
      </div>

      {ignored && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm text-amber-100"><EyeOff size={15} /> Pista ignorada: no se incluye al descargar la selección.</span>
          <button
            type="button"
            onClick={() => onToggleIgnored(t, i)}
            className="flex items-center gap-2 rounded-lg bg-amber-300 px-3.5 py-2 text-sm font-medium text-[#161822] transition-colors hover:bg-amber-200"
          >
            <RotateCcw size={15} /> Restaurar
          </button>
        </div>
      )}

      {trackDownloads.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {trackDownloads.map((download) => (
            <span key={download.id}>
              {download.state === 'encolando' && <Chip tone="queued">encolando · {download.filename}</Chip>}
              {download.state === 'descargando' && <Chip tone="active">descargando {Math.round(download.percent || 0)}% · {download.filename}</Chip>}
              {download.state === 'completado' && (
                <>
                  <Chip tone="teal">descargado{download.path ? ` · ${download.path}` : ''}</Chip>
                  {download.path && t.cover_url && (
                    <button
                      type="button"
                      onClick={() => onEmbedCover(download, t)}
                      className="rounded border border-[#FFFFFF]/40 px-2 py-1 text-[11px] text-[#FFFFFF] transition-colors hover:bg-[#FFFFFF]/10"
                    >
                      download cover
                    </button>
                  )}
                </>
              )}
              {download.state === 'cancelado' && <Chip tone="neutral">cancelado · {download.filename}</Chip>}
              {download.state === 'offline' && <Chip tone="amber">usuario offline · {download.filename}</Chip>}
              {download.state === 'no_disponible' && <Chip tone="amber">usuario no disponible · {download.filename}</Chip>}
              {download.state === 'error' && <Chip tone="coral">error · {download.error}</Chip>}
            </span>
          ))}
        </div>
      )}

      {(!downloaded || hasActivePreview) && (spotifyTrackId || t.spotify_preview) && (
        <SpotifyEmbed
          trackId={spotifyTrackId}
          spotifyUrl={t.spotify_url}
          previewUrl={t.spotify_preview}
          open={embedOpen}
          onToggle={onToggleEmbed}
          trackName={t.track_name}
          artists={t.artists}
          localPlaylists={localPlaylists}
          onSaveToLibrary={onSaveSpotifyPreview}
        />
      )}

      <div className="mt-4 flex items-center gap-2.5">
        <input
          type="text"
          value={t.search_query}
          onChange={(e) => onUpdateQuery(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSearchTrack(i, e.currentTarget.value)
            }
          }}
          placeholder="artista - canción para buscar en Soulseek"
          className="min-w-0 flex-1 rounded-lg border border-[#2C303D] bg-[#0F1117] px-3.5 py-2.5 text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none transition-colors focus:border-[#7FD8CC]/70"
          style={{ fontFamily: FONT_MONO }}
        />
        <button
          onClick={() => onCopy(t.search_query)}
          title="Copiar búsqueda"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-[#2C303D] px-3.5 py-2.5 text-sm text-[#8D93A6] transition-colors hover:border-[#3A3F4E] hover:text-[#E9EAF0]"
        >
          <Copy size={15} />
          <span className="hidden sm:inline">Copiar</span>
        </button>
        <button
          onClick={() => onSearchTrack(i, t.search_query)}
          className="flex shrink-0 items-center gap-2 rounded-lg bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0]"
        >
          <Search size={15} />
          Buscar
        </button>
      </div>

      {search && (
        <div className="mt-3 border-t border-[#2C303D] pt-3">
          <SearchResults
            search={search}
            limit={RESULTS_PER_TRACK}
            pickMode={pickMode}
            formatPref={formatPref}
            expanded={expandedSearches.has(search.searchId)}
            onToggleExpanded={onToggleExpandedSearch}
            collapsed={collapsedSearches.has(search.searchId)}
            onToggleCollapsed={onToggleCollapsedSearch}
            trackDownloaded={downloaded}
            trackDownloads={trackDownloads}
            previews={previews}
            localPlaylists={localPlaylists}
            formatFilters={formatFilters}
            onStartPreview={(res, folderName) => onStartPreview(res, i, folderName)}
            onSavePreview={onSavePreview}
            quickSaveLabel={quickSaveLabel}
            onQuickSavePreview={onQuickSavePreview}
            onDiscardPreview={onDiscardPreview}
            onCancelPreview={onCancelPreview}
            storedFileStreamUrl={storedFileStreamUrl}
            storedFileUrl={storedFileUrl}
            onCancelDownload={onCancelDownload}
            onRefreshSearch={onRefreshSearch}
            onCancelSearch={onCancelSearch}
          />
        </div>
      )}
      {downloaded && !hasActivePreview && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#10121A]/70 p-4 text-center backdrop-blur-[2px] transition-[backdrop-filter] duration-200 group-hover:backdrop-blur-0">
          <div className="flex max-w-[90%] flex-col items-center gap-1.5">
            <p className="max-w-full truncate text-sm font-semibold text-[#E9EAF0]" title={t.track_name}>{t.track_name}</p>
            <p className="max-w-full truncate text-xs text-[#8D93A6]" title={t.artists}>{t.artists || 'Artista desconocido'}</p>
            <span className="mt-1 rounded-lg border border-[#8D93A6]/50 bg-[#161822]/90 px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-[#D5D7DE]">
              Este track ya se ha descargado
            </span>
            {manuallyDownloaded && !actualDownloaded && (
              <button
                type="button"
                onClick={() => onToggleManualDownloaded(t, i)}
                className="pointer-events-auto mt-2 flex items-center gap-2 rounded-lg bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#161822] shadow-lg transition-colors hover:bg-[#E9EAF0]"
              >
                <RotateCcw size={16} /> Quitar marca de descargada
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
