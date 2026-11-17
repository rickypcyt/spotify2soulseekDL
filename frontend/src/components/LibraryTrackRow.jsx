import { ChevronDown, FolderInput, ImagePlus, Music, Pause, Play, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { FILE_DRAG_TYPE, FONT_MONO } from '../constants'
import { usePlayerState } from '../player/usePlayer'
import CoverLightbox from './CoverLightbox'
import LibraryAudioCard from './LibraryAudioCard'
import PlaylistSelectModal from './PlaylistSelectModal'

function RowIconButton({ title, onClick, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick(event)
      }}
      title={title}
      aria-label={title}
      className={`btn-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg !p-0 text-[#8D93A6] transition-colors ${
        danger ? 'hover:!bg-red-400/10 hover:text-red-300' : 'hover:text-[#E9EAF0]'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Fila compacta de una canción para las columnas de playlists. Se puede reproducir,
 * mover y borrar sin abrirla, arrastrar a otra playlist y desplegar para ver la card completa.
 */
function formatClock(seconds) {
  const total = Math.floor(Number(seconds) || 0)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function LibraryTrackRow({ file, coverUrl, metadata = {}, dragDir, formatSize, cardProps, sourceId, playlistName }) {
  const player = usePlayerState()
  const [expanded, setExpanded] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)
  const [moveOpen, setMoveOpen] = useState(false)
  const [coverZoom, setCoverZoom] = useState(false)
  const [coverRefresh, setCoverRefresh] = useState(0)

  const { onDelete, onMoveToPlaylist, movePlaylists = [], coverSourceUrl, onEmbedCover, onSearchCover } = cardProps
  const isCurrent = player.now?.sourceId === sourceId && player.now?.path === file.path
  const playing = isCurrent && player.playing
  const extension = (file.name.split('.').pop() || '').toUpperCase()
  const title = metadata.trackName?.trim() || file.name.replace(/\.[^.]+$/, '')
  const artist = metadata.artists?.trim() || ''
  const showCover = Boolean(coverUrl) && !coverFailed
  const coverSrc = coverUrl ? `${coverUrl}${coverUrl.includes('?') ? '&' : '?'}v=${coverRefresh}` : ''
  const canAddCover = Boolean(coverSourceUrl || onSearchCover)

  const handleCover = async () => {
    if (coverSourceUrl) await onEmbedCover?.(file.path, coverSourceUrl)
    else await onSearchCover?.(file.path)
    setCoverFailed(false)
    setCoverRefresh(Date.now())
  }
  const canMove = Boolean(onMoveToPlaylist) && movePlaylists.length > 0

  const togglePlay = () => {
    if (isCurrent) player.actions.toggle()
    else player.actions.play(sourceId, playlistName, file.path)
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-[#161822] transition-colors ${isCurrent ? 'border-[#7FD8CC]/50' : expanded ? 'border-[#3A3F4E]' : 'border-[#2C303D]'}`}>
      <div
        draggable={Boolean(dragDir)}
        onDragStart={(event) => {
          if (!dragDir) return
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify({ dir: dragDir, path: file.path }))
        }}
        title={dragDir ? 'Arrastra a otra playlist' : undefined}
        className={`relative flex items-center gap-2 px-2.5 py-2 ${dragDir ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <RowIconButton title={expanded ? 'Ocultar detalles' : 'Ver detalles'} onClick={() => setExpanded((value) => !value)}>
          <ChevronDown size={17} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </RowIconButton>

        {showCover ? (
          <button
            type="button"
            onClick={() => setCoverZoom(true)}
            title="Ver portada más grande"
            aria-label={`Ver portada de ${title} más grande`}
            className="group/cover relative h-16 w-16 shrink-0 cursor-zoom-in overflow-hidden rounded-xl !p-0"
          >
            <img
              src={coverSrc}
              alt=""
              loading="lazy"
              draggable={false}
              onError={() => setCoverFailed(true)}
              className="h-full w-full object-cover transition-transform duration-200 group-hover/cover:scale-105"
            />
          </button>
        ) : (
          <button
            type="button"
            onClick={canAddCover ? handleCover : undefined}
            disabled={!canAddCover}
            title={canAddCover ? 'Añadir portada' : 'Sin portada'}
            aria-label={canAddCover ? `Añadir portada a ${title}` : 'Sin portada'}
            className="flex h-16 w-16 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[#2C303D] bg-[#0F1117] !p-0 text-[#565C6E] transition-colors enabled:hover:border-[#7FD8CC]/50 enabled:hover:text-[#7FD8CC] disabled:cursor-default"
          >
            {canAddCover ? <ImagePlus size={18} /> : <Music size={20} />}
            {canAddCover && <span className="text-[10px] leading-none">Añadir</span>}
          </button>
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            title="Ver detalles"
            className="btn-icon block w-full min-w-0 !p-0 text-left"
          >
            <span className={`block truncate text-sm font-medium ${isCurrent ? 'text-[#7FD8CC]' : 'text-[#E9EAF0]'}`} title={title}>{title}</span>
            <span className="block truncate text-xs text-[#8D93A6]">
              {artist || 'Artista desconocido'}
            </span>
          </button>
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
            {file.duration ? <span className="whitespace-nowrap">{formatClock(file.duration)}</span> : null}
            <span className="rounded-md bg-[#2C303D] px-1.5 py-px text-[#E9EAF0]">{extension}</span>
            <span className="whitespace-nowrap">{formatSize(file.size)}</span>
            {file.bitrate ? <span className="whitespace-nowrap">{Math.round(file.bitrate / 1000)} kbps</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center justify-between self-stretch py-0.5">
          <button
            type="button"
            onClick={togglePlay}
            title={playing ? 'Pausar' : 'Reproducir'}
            aria-label={playing ? 'Pausar' : 'Reproducir'}
            className="player-play flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
          >
            {playing
              ? <Pause size={16} fill="currentColor" strokeWidth={0} />
              : <Play size={16} fill="currentColor" strokeWidth={0} className="translate-x-px" />}
          </button>
          {canMove ? (
            <RowIconButton title="Mover a otra playlist" onClick={() => setMoveOpen(true)}>
              <FolderInput size={17} />
            </RowIconButton>
          ) : <span className="h-9 w-9" />}
          {onDelete ? (
            <RowIconButton
              title="Borrar"
              danger
              onClick={() => {
                if (isCurrent) player.actions.stop()
                onDelete(file.path)
              }}
            >
              <Trash2 size={17} />
            </RowIconButton>
          ) : <span className="h-9 w-9" />}
        </div>

      </div>

      {expanded && (
        <div className="p-2.5">
          <LibraryAudioCard
            file={file}
            coverUrl={coverUrl}
            metadata={metadata}
            formatSize={formatSize}
            dragDir={dragDir}
            showPlayer={false}
            {...cardProps}
          />
        </div>
      )}

      <CoverLightbox
        open={coverZoom && showCover}
        src={coverSrc}
        title={title}
        artist={artist}
        onClose={() => setCoverZoom(false)}
        onReplace={canAddCover ? handleCover : undefined}
      />

      <PlaylistSelectModal
        open={moveOpen}
        playlists={movePlaylists}
        title="Mover a carpeta"
        subtitle={file.name}
        allowEmpty={false}
        onClose={() => setMoveOpen(false)}
        onSelect={(playlist) => {
          setMoveOpen(false)
          if (playlist) onMoveToPlaylist(file.path, playlist)
        }}
      />
    </div>
  )
}
