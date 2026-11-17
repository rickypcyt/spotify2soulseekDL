import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { FILE_DRAG_TYPE, FONT_MONO } from '../constants'
import { ROOT_PLAYLIST } from '../player/buildPlaylists'
import { usePlayerState, usePlayerTime } from '../player/usePlayer'

const COLLAPSED_KEY = 'soulseek.player.collapsed'

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function Cover({ item, size }) {
  const [failedUrl, setFailedUrl] = useState('')
  const failed = !item.coverUrl || failedUrl === item.coverUrl
  const box = { width: size, height: size }
  return failed ? (
    <span className="flex shrink-0 items-center justify-center rounded-lg bg-[#2C303D] text-[#565C6E]" style={box}>
      <Music size={Math.round(size * 0.4)} />
    </span>
  ) : (
    <img
      src={item.coverUrl}
      alt=""
      onError={() => setFailedUrl(item.coverUrl)}
      className="shrink-0 rounded-lg object-cover"
      style={box}
    />
  )
}

function IconButton({ title, onClick, disabled = false, active = false, size = 'md', children }) {
  const dimension = size === 'lg' ? 'h-11 w-11' : 'h-9 w-9'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`btn-icon flex ${dimension} shrink-0 items-center justify-center rounded-full !p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? 'text-[#7FD8CC]' : 'text-[#C9CCD8] hover:text-[#FFFFFF]'
      }`}
    >
      {children}
    </button>
  )
}

function PlayButton({ playing, onClick, size = 40 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? 'Pausar' : 'Reproducir'}
      title={playing ? 'Pausar' : 'Reproducir'}
      className="player-play flex shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
      style={{ width: size, height: size }}
    >
      {playing
        ? <Pause size={Math.round(size * 0.45)} fill="currentColor" strokeWidth={0} />
        : <Play size={Math.round(size * 0.45)} fill="currentColor" strokeWidth={0} className="translate-x-px" />}
    </button>
  )
}

function SeekBar({ currentTime, duration, onSeek, className = '' }) {
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0
  return (
    <div className={`flex w-full items-center gap-2.5 ${className}`}>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[#C9CCD8]" style={{ fontFamily: FONT_MONO }}>
        {formatTime(currentTime)}
      </span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        disabled={!duration}
        onChange={(event) => onSeek(Number(event.target.value))}
        aria-label="Posición de reproducción"
        className="player-range min-w-0 flex-1"
        style={{ '--fill': `${progress}%` }}
      />
      <span className="w-10 shrink-0 text-xs tabular-nums text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
        {formatTime(duration)}
      </span>
    </div>
  )
}

/** Panel para cambiar de playlist y de canción sin salir del reproductor. */
function QueuePanel({ player, onClose, className }) {
  const { now, item, sources, actions } = player
  const playlists = sources[now.sourceId] || []
  const [browsing, setBrowsing] = useState(now.playlist)
  const selected = playlists.find((entry) => entry.name === browsing) || playlists.find((entry) => entry.name === now.playlist)
  const items = selected?.items || []
  // Solo la biblioteca local se puede reorganizar; las carpetas externas son de solo lectura.
  const isLibrary = now.sourceId === 'library'
  const [dropTarget, setDropTarget] = useState(null)
  const dropProps = (entry) => {
    if (!isLibrary) return {}
    const folder = entry.name === ROOT_PLAYLIST ? '' : entry.name
    return {
      onDragOver: (event) => {
        if (!Array.from(event.dataTransfer?.types || []).includes(FILE_DRAG_TYPE)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setDropTarget(entry.name)
      },
      onDragLeave: (event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null)
      },
      onDrop: (event) => {
        if (!Array.from(event.dataTransfer?.types || []).includes(FILE_DRAG_TYPE)) return
        event.preventDefault()
        setDropTarget(null)
        try {
          const source = JSON.parse(event.dataTransfer.getData(FILE_DRAG_TYPE))
          if (source?.path && source.dir === 'downloads') actions.moveFile(now.sourceId, source.path, folder)
        } catch {
          // dato de arrastre no válido: se ignora
        }
      },
    }
  }

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-label="Elegir playlist y canción"
      className={`flex h-auto max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-[#343949] bg-[#161822] shadow-[0_18px_48px_rgba(0,0,0,0.55)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#2C303D] px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-[#8D93A6]">Reproduciendo desde</p>
          <p className="truncate text-sm font-semibold text-[#E9EAF0]">{now.playlist}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="btn-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg !p-0 text-[#8D93A6] hover:text-[#E9EAF0]"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        {/* Playlists */}
        <div className="shrink-0 border-b border-[#2C303D] sm:w-72 sm:border-b-0 sm:border-r">
          <div className="p-2 sm:hidden">
            <select
              value={selected?.name || ''}
              onChange={(event) => setBrowsing(event.target.value)}
              aria-label="Playlist"
              className="w-full rounded-lg bg-[#0F1117] px-3 py-2.5 text-sm text-[#E9EAF0]"
            >
              {playlists.map((entry) => (
                <option key={entry.name} value={entry.name}>{entry.name} ({entry.items.length})</option>
              ))}
            </select>
          </div>
          <ul className="hidden max-h-full flex-col gap-1 overflow-y-auto p-2 sm:flex">
            {playlists.map((entry) => {
              const active = entry.name === selected?.name
              const playingFrom = entry.name === now.playlist
              return (
                <li key={entry.name}>
                  <button
                    type="button"
                    {...dropProps(entry)}
                    onClick={() => setBrowsing(entry.name)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                      dropTarget === entry.name ? '!bg-[#7FD8CC]/20 text-[#E9EAF0] ring-2 ring-[#7FD8CC]/70' : active ? '!bg-[#2C303D] text-[#E9EAF0]' : 'text-[#8D93A6] hover:text-[#E9EAF0]'
                    }`}
                  >
                    <ListMusic size={15} className={playingFrom ? 'shrink-0 text-[#7FD8CC]' : 'shrink-0'} />
                    <span className="min-w-0 flex-1 break-words leading-snug [overflow-wrap:anywhere]">{entry.name}</span>
                    <span className="shrink-0 text-xs text-[#565C6E]" style={{ fontFamily: FONT_MONO }}>{entry.items.length}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Canciones de la playlist elegida */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => actions.play(now.sourceId, selected.name, items[0].path)}
              className="mb-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#7FD8CC] transition-colors hover:bg-[#7FD8CC]/10"
            >
              <Play size={14} fill="currentColor" strokeWidth={0} />
              Reproducir «{selected.name}» desde el inicio
            </button>
          )}
          <ul className="flex flex-col gap-1.5">
            {items.map((entry, position) => {
              const current = selected?.name === now.playlist && entry.path === item.path
              return (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => actions.play(now.sourceId, selected.name, entry.path)}
                    draggable={isLibrary}
                    onDragStart={(event) => {
                      if (!isLibrary) return
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify({ dir: 'downloads', path: entry.path }))
                    }}
                    title={isLibrary ? 'Clic para reproducir · arrastra a una playlist para moverla' : 'Clic para reproducir'}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                      current ? 'bg-[#7FD8CC]/10' : 'hover:bg-[#1A1D28]'
                    }`}
                  >
                    <span className="flex w-5 shrink-0 justify-center text-xs text-[#565C6E]" style={{ fontFamily: FONT_MONO }}>
                      {current ? <Volume2 size={14} className="text-[#7FD8CC]" /> : position + 1}
                    </span>
                    <Cover item={entry} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${current ? 'text-[#7FD8CC]' : 'text-[#E9EAF0]'}`}>{entry.title}</span>
                      <span className="block truncate text-xs text-[#8D93A6]">{entry.artist || 'Artista desconocido'}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-[#8D93A6]">Esta playlist no tiene canciones.</p>}
        </div>
      </div>
    </div>
  )
}

/**
 * Barra de reproducción global. Expandida: barra inferior tipo Spotify. Colapsada:
 * tarjeta compacta con portada y título arriba y los botones debajo.
 */
export default function PlayerBar() {
  const player = usePlayerState()
  const { currentTime, duration } = usePlayerTime()
  const [collapsed, setCollapsedState] = useState(readCollapsed)
  const [queueOpen, setQueueOpen] = useState(false)
  const { now, item, playing, volume, muted, hasPrev, hasNext, actions } = player

  const setCollapsed = (value) => {
    setCollapsedState(value)
    try {
      window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
    } catch {
      // sin almacenamiento: la preferencia solo dura esta sesión
    }
  }

  if (!now || !item) return null

  const effectiveVolume = muted ? 0 : volume
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2
  const progress = duration ? Math.min(100, (currentTime / duration) * 100) : 0

  const transport = (
    <>
      <IconButton title="Anterior" onClick={actions.prev} disabled={!hasPrev && currentTime <= 3}>
        <SkipBack size={20} fill="currentColor" strokeWidth={0} />
      </IconButton>
      <PlayButton playing={playing} onClick={actions.toggle} size={collapsed ? 44 : 40} />
      <IconButton title="Siguiente" onClick={actions.next} disabled={!hasNext}>
        <SkipForward size={20} fill="currentColor" strokeWidth={0} />
      </IconButton>
    </>
  )

  const queueButton = (
    <IconButton title="Elegir playlist y canción" onClick={() => setQueueOpen((open) => !open)} active={queueOpen}>
      <ListMusic size={19} />
    </IconButton>
  )

  // ---- Colapsada: portada y título arriba, botones debajo ----
  if (collapsed) {
    return (
      <>
        {queueOpen && (
          <QueuePanel player={player} onClose={() => setQueueOpen(false)} className="fixed bottom-[13.5rem] right-4 z-40 w-[min(94vw,640px)]" />
        )}
        <div className="fixed bottom-4 right-4 z-40 w-[min(94vw,340px)] overflow-hidden rounded-2xl border border-[#343949] bg-[#161822]/95 shadow-[0_18px_48px_rgba(0,0,0,0.55)] backdrop-blur">
          <div className="flex items-center gap-3 p-3.5">
            <Cover item={item} size={64} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 break-words text-sm font-semibold leading-snug text-[#E9EAF0]" title={item.title}>{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-[#8D93A6]">{item.artist || 'Artista desconocido'}</p>
              <p className="mt-0.5 truncate text-xs text-[#7FD8CC]" title={now.playlist}>{now.playlist}</p>
            </div>
          </div>
          <div className="h-[3px] w-full bg-[#2C303D]" aria-hidden="true">
            <div className="h-full bg-[#7FD8CC]" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between px-3 py-2.5">
            {queueButton}
            {transport}
            <IconButton title="Expandir reproductor" onClick={() => setCollapsed(false)}>
              <ChevronUp size={19} />
            </IconButton>
            <IconButton title="Cerrar reproductor" onClick={actions.stop}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
      </>
    )
  }

  // ---- Expandida: barra inferior ----
  return (
    <>
      {queueOpen && (
        <QueuePanel player={player} onClose={() => setQueueOpen(false)} className="fixed bottom-[6.5rem] right-4 z-40 w-[min(94vw,620px)]" />
      )}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#2C303D] bg-[#12141D]/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-[1800px] grid-cols-1 items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
          {/* Canción */}
          <div className="flex min-w-0 items-center gap-3.5">
            <Cover item={item} size={60} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#E9EAF0]" title={item.title}>{item.title}</p>
              <p className="truncate text-xs text-[#8D93A6]">{item.artist || 'Artista desconocido'}</p>
              <button
                type="button"
                onClick={() => setQueueOpen((open) => !open)}
                title="Cambiar de playlist"
                className="btn-icon mt-0.5 flex max-w-full items-center gap-1.5 !p-0 text-xs text-[#7FD8CC] hover:underline"
              >
                <ListMusic size={12} className="shrink-0" />
                <span className="truncate">{now.playlist}</span>
              </button>
            </div>
          </div>

          {/* Controles + progreso */}
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <div className="flex items-center gap-3">{transport}</div>
            <SeekBar currentTime={currentTime} duration={duration} onSeek={actions.seek} className="max-w-2xl" />
          </div>

          {/* Volumen y ventana */}
          <div className="flex items-center justify-end gap-1.5">
            {queueButton}
            <div className="hidden items-center gap-1 sm:flex">
              <IconButton title={effectiveVolume === 0 ? 'Activar sonido' : 'Silenciar'} onClick={actions.toggleMute}>
                <VolumeIcon size={19} />
              </IconButton>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={effectiveVolume}
                onChange={(event) => actions.setVolume(Number(event.target.value))}
                aria-label="Volumen"
                className="player-range w-24"
                style={{ '--fill': `${effectiveVolume * 100}%` }}
              />
            </div>
            <IconButton title="Colapsar reproductor" onClick={() => setCollapsed(true)}>
              <ChevronDown size={19} />
            </IconButton>
            <IconButton title="Cerrar reproductor" onClick={actions.stop}>
              <X size={18} />
            </IconButton>
          </div>
        </div>
      </div>
    </>
  )
}
