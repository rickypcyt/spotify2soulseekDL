import { useConfirm } from './ConfirmDialog.jsx'
import { LoaderCircle, RefreshCw, Trash2, X } from 'lucide-react'

const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace"

export default function PlaylistTabBar({ tabs, activeKey, meta = {}, onSelect, onClose, onCloseAll, onRefresh }) {
  const confirm = useConfirm()
  if (tabs.length === 0) return null
  return (
    <div
      className="mt-2 flex items-center gap-2 overflow-x-auto rounded-xl border border-[#2C303D] bg-[#161822] px-2.5 py-2.5"
      role="tablist"
      aria-label="Playlists abiertas"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey
        const info = meta[tab.key] || {}
        const label = info.name || tab.name || tab.url
        const busy = Boolean(info.loading)
        const activity = (info.queued || 0) + (info.active || 0) + (info.searches || 0)
        return (
          <div
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            className={`group flex shrink-0 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm transition-colors ${
              isActive
                ? 'bg-[#2C303D] font-medium text-[#E9EAF0] shadow-[inset_0_-2px_0_#7FD8CC]'
                : 'border border-transparent text-[#8D93A6] hover:border-[#2C303D] hover:bg-[#1A1D28] hover:text-[#E9EAF0]'
            }`}
            onClick={() => onSelect(tab.key)}
            title={tab.url}
          >
            {busy
              ? <LoaderCircle size={15} className="shrink-0 animate-spin text-[#7FD8CC]" />
              : activity > 0
                ? <LoaderCircle size={15} className="shrink-0 animate-spin text-[#8D93A6]" />
                : null}
            <span style={{ fontFamily: FONT_MONO }}>
              {label}
            </span>
            {typeof info.trackCount === 'number' && info.trackCount > 0 && (
              <span className="shrink-0 rounded-full border border-[#3A3F4E] px-2 py-0.5 text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
                {info.trackCount}
              </span>
            )}
            <button
              type="button"
              title="Refrescar playlist"
              aria-label={`Refrescar ${label}`}
              onClick={(event) => {
                event.stopPropagation()
                onRefresh(tab.key)
              }}
              className="btn-icon flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#8D93A6] transition-colors hover:bg-[#3A3F4E] hover:text-[#FFFFFF]"
            >
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              title="Cerrar pestaña"
              aria-label={`Cerrar ${label}`}
              onClick={(event) => {
                event.stopPropagation()
                onClose(tab.key)
              }}
              className="btn-icon flex h-7 w-7 shrink-0 items-center justify-center rounded text-[#8D93A6] transition-colors hover:bg-[#3A3F4E] hover:text-[#FFFFFF]"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
      {onCloseAll && tabs.length > 1 && (
        <button
          type="button"
          onClick={async () => {
            if (await confirm(`¿Cerrar las ${tabs.length} pestañas? Se borra su estado guardado.`, { title: 'Cerrar pestañas', confirmLabel: 'Cerrar todas' })) onCloseAll()
          }}
          title="Cerrar todas las pestañas y limpiar su estado guardado"
          className="ml-auto flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#2C303D] px-3.5 py-2.5 text-sm text-[#8D93A6] transition-colors hover:border-red-400/60 hover:text-red-300"
        >
          <Trash2 size={15} />
          Cerrar todas
        </button>
      )}
    </div>
  )
}
