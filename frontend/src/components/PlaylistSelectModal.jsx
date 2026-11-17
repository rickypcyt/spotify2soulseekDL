import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Folder, FolderPlus, Search, X } from 'lucide-react'

// Modal para elegir la carpeta/playlist destino. Se monta con portal en
// document.body para que ningún contenedor con overflow/transform la recorte.
export default function PlaylistSelectModal({
  open,
  playlists = [],
  title = 'Guardar en carpeta',
  subtitle,
  onClose,
  onSelect,
  allowEmpty = true,
  allowCreate = false,
}) {
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (open) setSearch('')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const query = search.trim()
  const filtered = useMemo(
    () => playlists.filter((playlist) => playlist.toLowerCase().includes(query.toLowerCase())),
    [playlists, query],
  )
  const exactMatch = playlists.some((playlist) => playlist.toLowerCase() === query.toLowerCase())
  const canCreate = allowCreate && query.length > 0 && !exactMatch

  if (!open) return null

  const handleSubmit = (event) => {
    event.preventDefault()
    if (filtered.length === 1) onSelect(filtered[0])
    else if (canCreate && filtered.length === 0) onSelect(query)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-[#000000]/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2C303D] bg-[#161822] shadow-[0_24px_64px_rgba(0,0,0,0.6)] sm:max-w-lg sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#E9EAF0]">{title}</h3>
            {subtitle && (
              <p className="mt-1 truncate text-sm text-[#8D93A6]" title={subtitle}>{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="btn-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg !p-0 text-[#8D93A6] transition-colors hover:bg-[#2C303D] hover:text-[#E9EAF0]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-[#2C303D] bg-[#0F1117] px-4 py-3 transition-colors focus-within:border-[#7FD8CC]/70">
            <Search size={16} strokeWidth={2} className="shrink-0 text-[#565C6E]" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={allowCreate ? 'Buscar o escribir una carpeta nueva…' : 'Buscar carpeta…'}
              className="input-bare min-w-0 flex-1 bg-transparent text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Borrar búsqueda"
                className="btn-icon shrink-0 !p-0 text-[#565C6E] hover:text-[#E9EAF0]"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </form>

        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto border-t border-[#2C303D] p-3">
          {canCreate && (
            <button
              type="button"
              onClick={() => onSelect(query)}
              className="mb-1 flex w-full items-center gap-3.5 rounded-xl border border-dashed border-[#7FD8CC]/50 bg-[#7FD8CC]/5 px-3.5 py-3 text-left transition-colors hover:bg-[#7FD8CC]/10"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#7FD8CC]/15 text-[#7FD8CC]">
                <FolderPlus size={20} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[#E9EAF0]">Crear carpeta nueva</span>
                <span className="block truncate text-xs text-[#8D93A6]">«{query}»</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-[#7FD8CC]" />
            </button>
          )}

          {filtered.map((playlist) => (
            <button
              key={playlist}
              type="button"
              onClick={() => onSelect(playlist)}
              className="group flex w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-left transition-colors hover:bg-[#2C303D]/60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#2C303D] text-[#7FD8CC] transition-colors group-hover:bg-[#7FD8CC]/15">
                <Folder size={20} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#E9EAF0]" title={playlist}>
                {playlist}
              </span>
              <ChevronRight size={18} className="shrink-0 text-[#565C6E] transition-colors group-hover:text-[#7FD8CC]" />
            </button>
          ))}

          {filtered.length === 0 && !canCreate && (
            <p className="px-4 py-10 text-center text-sm text-[#8D93A6]">
              {query ? 'Ninguna carpeta coincide con tu búsqueda.' : 'Todavía no hay carpetas.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#2C303D] px-6 py-4">
          {allowEmpty ? (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-sm text-[#8D93A6] underline-offset-2 transition-colors hover:text-[#E9EAF0] hover:underline"
            >
              Guardar sin carpeta
            </button>
          ) : <span className="text-xs text-[#565C6E]">{playlists.length} carpeta{playlists.length === 1 ? '' : 's'}</span>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#2C303D] px-5 py-2.5 text-sm font-medium text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
