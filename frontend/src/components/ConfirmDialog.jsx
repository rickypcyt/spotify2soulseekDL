import { AlertTriangle, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ConfirmContext = createContext(null)

/** Diálogo de confirmación propio. Devuelve una promesa<boolean>. */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null)
  const confirmButtonRef = useRef(null)

  const confirm = useCallback((message, options = {}) => new Promise((resolve) => {
    setRequest({ message, options, resolve })
  }), [])

  const close = (answer) => {
    request?.resolve(answer)
    setRequest(null)
  }

  useEffect(() => {
    if (!request) return undefined
    confirmButtonRef.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') close(false)
      if (event.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  const danger = request?.options?.danger !== false

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && createPortal(
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-[#000000]/70 p-4 backdrop-blur-sm" onClick={() => close(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-md rounded-2xl border border-[#2C303D] bg-[#161822] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${danger ? 'bg-red-400/15 text-red-300' : 'bg-[#7FD8CC]/15 text-[#7FD8CC]'}`}>
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 id="confirm-title" className="text-base font-semibold text-[#E9EAF0]">
                  {request.options.title || 'Confirmar'}
                </h3>
                <p className="mt-1.5 break-words text-sm leading-relaxed text-[#8D93A6]">{request.message}</p>
              </div>
              <button type="button" onClick={() => close(false)} aria-label="Cerrar" className="btn-icon shrink-0 !p-0 text-[#8D93A6] hover:text-[#E9EAF0]">
                <X size={18} />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="rounded-lg border border-[#2C303D] px-4 py-2.5 text-sm font-medium text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
              >
                {request.options.cancelLabel || 'Cancelar'}
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={() => close(true)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${danger ? 'bg-red-400 text-[#161822] hover:bg-red-300' : 'bg-[#FFFFFF] text-[#161822] hover:bg-[#E9EAF0]'}`}
              >
                {request.options.confirmLabel || 'Aceptar'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  return confirm || (async () => true)
}
