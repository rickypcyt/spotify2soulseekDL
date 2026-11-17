import { ListMusic, LoaderCircle, Search, Users, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

const GROUPS = [
  ['all', 'Todas'],
  ['mine', 'Tuyas'],
  ['collaborative', 'Colaborativas'],
  ['followed', 'Seguidas'],
]

const GROUP_KEY = 'soulseek.playlistGroup'

function readStoredGroup() {
  try {
    const value = window.localStorage.getItem(GROUP_KEY)
    return GROUPS.some(([id]) => id === value) ? value : 'all'
  } catch {
    return 'all'
  }
}

const GROUP_HINTS = {
  all: 'Todas las playlists de tu biblioteca de Spotify.',
  mine: 'Las que creaste tú.',
  collaborative: 'Playlists compartidas que puedes editar.',
  followed: 'De otras personas, que sigues en tu biblioteca.',
}

// Más columnas a medida que hay ancho; las tarjetas son cuadradas.
const GRID_CLASSES = 'grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'

export default function PlaylistPicker({ open, playlists = [], loading = false, onClose, onSelect }) {
  const [search, setSearch] = useState('')
  const [group, setGroupState] = useState(readStoredGroup)

  const setGroup = (value) => {
    setGroupState(value)
    try {
      window.localStorage.setItem(GROUP_KEY, value)
    } catch {
      // sin almacenamiento: el filtro solo dura esta sesión
    }
  }

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const counts = useMemo(() => {
    const result = { all: playlists.length, mine: 0, collaborative: 0, followed: 0 }
    playlists.forEach((playlist) => {
      if (playlist.kind in result) result[playlist.kind] += 1
    })
    return result
  }, [playlists])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return playlists.filter((playlist) => {
      if (group !== 'all' && playlist.kind !== group) return false
      return !query || playlist.name.toLowerCase().includes(query)
    })
  }, [playlists, group, search])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-[#000000]/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tus playlists de Spotify"
        className="flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2C303D] bg-[#161822] shadow-[0_24px_64px_rgba(0,0,0,0.6)] sm:h-[92vh] sm:max-w-[min(96vw,1400px)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-8 pb-5 pt-6">
          <div>
            <h2 className="text-xl font-semibold text-[#E9EAF0]">Tus playlists de Spotify</h2>
            <p className="mt-1 text-sm text-[#8D93A6]">Elige una para cargarla y buscar sus canciones en Soulseek.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="btn-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg !p-0 text-[#8D93A6] transition-colors hover:bg-[#2C303D] hover:text-[#E9EAF0]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selector de grupo */}
        <div className="px-8">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#2C303D] bg-[#0F1117] p-1" role="tablist" aria-label="Tipo de playlist">
            {GROUPS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={group === value}
                onClick={() => setGroup(value)}
                className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition-colors ${
                  group === value
                    ? '!bg-[#2C303D] font-medium text-[#E9EAF0] shadow-[inset_0_-2px_0_#7FD8CC]'
                    : 'text-[#8D93A6] hover:text-[#E9EAF0]'
                }`}
              >
                {label}
                <span
                  className={`rounded-full border px-2 py-px text-xs ${group === value ? 'border-[#7FD8CC]/50 text-[#7FD8CC]' : 'border-[#3A3F4E] text-[#565C6E]'}`}
                >
                  {counts[value]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#8D93A6]">{GROUP_HINTS[group]}</p>
        </div>

        <div className="px-8 pb-5 pt-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#2C303D] bg-[#0F1117] px-4 py-3 transition-colors focus-within:border-[#7FD8CC]/70">
            <Search size={16} className="shrink-0 text-[#565C6E]" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar playlist…"
              className="input-bare min-w-0 flex-1 bg-transparent text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#2C303D] p-6">
          {loading && (
            <p className="mb-3 flex items-center gap-2 text-xs text-[#8D93A6]">
              <LoaderCircle size={14} className="animate-spin text-[#7FD8CC]" />
              {playlists.length === 0 ? 'Cargando tus playlists de Spotify…' : 'Actualizando la lista…'}
            </p>
          )}
          {loading && playlists.length === 0 && (
            <div className={GRID_CLASSES} aria-hidden="true">
              {Array.from({ length: 15 }, (_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="aspect-square w-full rounded-xl bg-[#2C303D]" />
                  <div className="mt-3 h-3.5 w-3/4 rounded bg-[#2C303D]" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-[#232632]" />
                </div>
              ))}
            </div>
          )}
          <div className={GRID_CLASSES}>
            {filtered.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                onClick={() => onSelect(playlist.url)}
                className="group min-w-0 rounded-xl p-2 text-left transition-colors hover:bg-[#1A1D28] focus-visible:bg-[#1A1D28]"
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#2C303D] shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
                  {playlist.image ? (
                    <img
                      src={playlist.image}
                      alt={`Portada de ${playlist.name}`}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2C303D] to-[#161822] text-[#7FD8CC]">
                      <ListMusic size={48} strokeWidth={1.5} />
                    </span>
                  )}
                  {playlist.kind === 'collaborative' && (
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-[#10121A]/85 px-2 py-1 text-[11px] font-medium text-[#7FD8CC]">
                      <Users size={12} /> Colaborativa
                    </span>
                  )}
                </div>
                <p className="mt-3 line-clamp-2 break-words text-base font-semibold leading-snug text-[#E9EAF0]" title={playlist.name}>
                  {playlist.name}
                </p>
                <p className="mt-1 truncate text-sm text-[#8D93A6]">
                  {playlist.kind === 'followed' && playlist.owner ? `de ${playlist.owner}` : playlist.owner || ''}
                  {typeof playlist.track_count === 'number' ? `${playlist.kind === 'mine' || !playlist.owner ? '' : ' · '}${playlist.track_count} canciones` : ''}
                </p>
              </button>
            ))}
          </div>
          {filtered.length === 0 && !loading && (
            <p className="py-12 text-center text-sm text-[#8D93A6]">
              {search ? 'Ninguna playlist coincide con tu búsqueda.' : 'No hay playlists en este grupo.'}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
