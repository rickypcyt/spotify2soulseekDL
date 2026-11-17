import { ImagePlus, X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Portada ampliada a pantalla casi completa, con opción de reemplazarla. */
export default function CoverLightbox({ open, src, title, artist, onClose, onReplace }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !src) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-[#000000]/85 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="btn-icon absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-[#161822] !p-0 text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
      >
        <X size={20} />
      </button>
      <div className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
        <img
          src={src}
          alt={`Portada de ${title}`}
          className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        />
        <p className="max-w-full truncate text-sm text-[#E9EAF0]">{title}{artist ? ` · ${artist}` : ''}</p>
        {onReplace && (
          <button
            type="button"
            onClick={() => {
              onClose()
              onReplace()
            }}
            className="mt-1 flex items-center gap-2 rounded-lg bg-[#FFFFFF] px-5 py-2.5 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0]"
          >
            <ImagePlus size={16} />
            Reemplazar portada
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
