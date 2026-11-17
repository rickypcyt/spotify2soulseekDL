import { Check, ImageOff, LoaderCircle, Search, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { requestJson } from '../api/client'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/**
 * Modal para elegir la portada de un archivo entre varias candidatas de Spotify
 * y confirmarla antes de incrustarla.
 *
 * picker: { path, dir, name } | null
 * onClose(applied: boolean)
 */
export default function CoverPickerModal({ picker, onClose }) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [applying, setApplying] = useState(false)
  const [currentFailed, setCurrentFailed] = useState(false)

  const search = useCallback(async (text) => {
    if (!picker) return
    setLoading(true)
    setError('')
    setSelected(null)
    try {
      const data = await requestJson('/api/library/cover/candidates', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ path: picker.path, dir: picker.dir, query: text }),
      })
      setCandidates(data.candidates || [])
      setQuery(data.query || text)
      if ((data.candidates || []).length > 0) setSelected(0)
    } catch (err) {
      setCandidates([])
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [picker])

  useEffect(() => {
    if (!picker) return
    setCurrentFailed(false)
    setQuery('')
    search('')
  }, [picker, search])

  useEffect(() => {
    if (!picker) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picker, onClose])

  if (!picker) return null

  const chosen = selected !== null ? candidates[selected] : null
  const currentUrl = `/api/library/cover?dir=${picker.dir}&path=${encodeURIComponent(picker.path)}&v=${picker.token || 0}`

  async function apply() {
    if (!chosen) return
    setApplying(true)
    setError('')
    try {
      await requestJson('/api/library/cover/embed', {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ path: picker.path, dir: picker.dir, cover_url: chosen.cover_url }),
      })
      onClose(true)
    } catch (err) {
      setError(`No se pudo insertar la portada: ${err.message}`)
    } finally {
      setApplying(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center bg-[#000000]/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={() => onClose(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Elegir portada"
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-2xl border border-[#2C303D] bg-[#161822] shadow-[0_24px_64px_rgba(0,0,0,0.6)] sm:max-w-3xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#E9EAF0]">Elegir portada</h3>
            <p className="mt-1 truncate text-sm text-[#8D93A6]" title={picker.name}>{picker.name}</p>
          </div>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Cerrar"
            className="btn-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg !p-0 text-[#8D93A6] transition-colors hover:bg-[#2C303D] hover:text-[#E9EAF0]"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            search(query.trim())
          }}
          className="flex gap-3 px-6 pb-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-[#2C303D] bg-[#0F1117] px-4 py-3 transition-colors focus-within:border-[#7FD8CC]/70">
            <Search size={16} className="shrink-0 text-[#565C6E]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Título y artista, p. ej. Let Go Maccari"
              className="input-bare min-w-0 flex-1 bg-transparent text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 rounded-xl border border-[#2C303D] px-5 py-3 text-sm font-medium text-[#E9EAF0] transition-colors hover:bg-[#2C303D] disabled:opacity-50"
          >
            Buscar
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#2C303D] p-6">
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="shrink-0 sm:w-36">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8D93A6]">Actual</p>
              {currentFailed ? (
                <span className="flex aspect-square w-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#2C303D] text-center text-xs text-[#565C6E]">
                  <ImageOff size={22} />
                  Sin portada
                </span>
              ) : (
                <img
                  src={currentUrl}
                  alt="Portada actual"
                  onError={() => setCurrentFailed(true)}
                  className="aspect-square w-36 rounded-xl object-cover"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-[#8D93A6]">Candidatas</p>
              {loading ? (
                <div className="flex items-center gap-2.5 py-10 text-sm text-[#8D93A6]">
                  <LoaderCircle size={18} className="animate-spin text-[#7FD8CC]" /> Buscando en Spotify…
                </div>
              ) : error ? (
                <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>
              ) : candidates.length === 0 ? (
                <p className="py-10 text-sm text-[#8D93A6]">
                  No se encontraron portadas. Prueba a escribir otro título o artista arriba.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {candidates.map((candidate, index) => {
                    const active = selected === index
                    return (
                      <button
                        key={candidate.cover_url}
                        type="button"
                        onClick={() => setSelected(index)}
                        aria-pressed={active}
                        className={`group relative rounded-xl border-2 p-2 text-left transition-colors ${
                          active ? 'border-[#7FD8CC] bg-[#7FD8CC]/10' : 'border-transparent hover:border-[#3A3F4E] hover:bg-[#1A1D28]'
                        }`}
                      >
                        <img
                          src={candidate.thumb_url}
                          alt={`Portada de ${candidate.album || candidate.track_name}`}
                          loading="lazy"
                          className="aspect-square w-full rounded-lg object-cover"
                        />
                        {active && (
                          <span className="absolute right-3.5 top-3.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#7FD8CC] text-[#10121A]">
                            <Check size={14} strokeWidth={3.5} />
                          </span>
                        )}
                        {candidate.linked && (
                          <span className="absolute left-3.5 top-3.5 rounded-md bg-[#10121A]/85 px-2 py-0.5 text-[10px] font-medium text-[#7FD8CC]">
                            Vinculada
                          </span>
                        )}
                        <p className="mt-2 truncate text-sm font-medium text-[#E9EAF0]" title={candidate.album}>{candidate.album || candidate.track_name}</p>
                        <p className="truncate text-xs text-[#8D93A6]" title={candidate.artists}>
                          {candidate.artists}{candidate.year ? ` · ${candidate.year}` : ''}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2C303D] px-6 py-4">
          <p className="text-xs text-[#8D93A6]">Se insertará dentro del archivo y reemplazará la portada actual.</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-lg border border-[#2C303D] px-5 py-2.5 text-sm font-medium text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={apply}
              disabled={!chosen || applying}
              className="flex items-center gap-2 rounded-lg bg-[#FFFFFF] px-5 py-2.5 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applying && <LoaderCircle size={15} className="animate-spin" />}
              {applying ? 'Insertando…' : 'Usar esta portada'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
