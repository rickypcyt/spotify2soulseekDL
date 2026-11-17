import StatusMenu from './StatusMenu'
import { CheckCircle2, House, Library, LoaderCircle, ScrollText, Search, Settings } from 'lucide-react'

const TAB_PATHS = {
  main: '/',
  settings: '/settings',
  logs: '/logs',
  library: '/library',
}

const TAB_ICONS = {
  main: House,
  library: Library,
  settings: Settings,
  logs: ScrollText,
}

const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace"

export default function AppNavbar({ activeTab, navigate, libraryCount, pendingDownloadCount, queuedDownloadCount, activeDownloadCount, activeSearchCount, statusProps }) {
  const tabButton = (tab, label) => {
    const Icon = TAB_ICONS[tab]
    return (
    <button
      key={tab}
      type="button"
      onClick={() => navigate(TAB_PATHS[tab])}
      aria-current={activeTab === tab ? 'page' : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${activeTab === tab ? 'bg-[#2C303D] font-medium text-[#E9EAF0] shadow-[inset_0_-2px_0_#7FD8CC]' : 'border border-transparent text-[#8D93A6] hover:border-[#2C303D] hover:bg-[#1A1D28] hover:text-[#E9EAF0]'}`}
    >
      <Icon size={16} className={activeTab === tab ? 'text-[#7FD8CC]' : ''} />
      {label}
    </button>
    )
  }

  return (
    <header className="rounded-xl border border-[#2C303D] bg-[#161822] px-4 py-3.5 sm:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <nav className="order-3 flex w-full flex-wrap items-center gap-2 border-t border-[#2C303D] pt-3 sm:order-2 sm:flex-nowrap sm:w-auto sm:flex-1 sm:justify-between sm:border-0 sm:pt-0" aria-label="Secciones">
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {tabButton('main', 'Principal')}
            {tabButton('library', 'Biblioteca')}
            {tabButton('settings', 'Configuración')}
            {tabButton('logs', 'Logs')}
          </div>

          <div className="flex shrink-0 items-center gap-5 max-sm:w-full max-sm:flex-wrap">
          {statusProps && <StatusMenu {...statusProps} />}
          {/* Indicadores a la derecha con menú on hover */}
          <div className="group relative flex shrink-0 items-center gap-5 border-l border-[#2C303D] pl-5 max-sm:w-full max-sm:border-l-0 max-sm:pl-0 max-sm:pt-2 max-sm:border-t max-sm:mt-1">
            <div className="flex items-center gap-2 text-sm text-[#8D93A6]">
              <CheckCircle2 size={16} className="text-[#7FD8CC]" />
              <span style={{ fontFamily: FONT_MONO }}>{libraryCount}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <LoaderCircle size={16} className={pendingDownloadCount ? 'animate-spin text-[#FFFFFF]' : 'text-[#565C6E]'} />
              <span className={pendingDownloadCount ? 'text-[#FFFFFF]' : 'text-[#565C6E]'} style={{ fontFamily: FONT_MONO }}>
                {pendingDownloadCount}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Search size={16} className={activeSearchCount ? 'animate-spin text-[#7FD8CC]' : 'text-[#565C6E]'} />
              <span className={activeSearchCount ? 'text-[#7FD8CC]' : 'text-[#565C6E]'} style={{ fontFamily: FONT_MONO }}>
                {activeSearchCount}
              </span>
            </div>

            {/* Menú on hover */}
            <div className="pointer-events-none invisible absolute right-0 top-full z-40 mt-2 w-64 rounded-lg border border-[#343949] bg-[#161822] p-3 opacity-0 shadow-[0_14px_32px_rgba(0,0,0,0.35)] transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto">
              <div className="flex items-center justify-between border-b border-[#2C303D] pb-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>resumen</span>
                <span className="rounded-full border border-[#3A3F4E] px-2 py-0.5 text-[10px] text-[#E9EAF0]" style={{ fontFamily: FONT_MONO }}>{libraryCount}</span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-[#8D93A6]"><CheckCircle2 size={14} className="text-[#7FD8CC]" /> canciones descargadas</span>
                  <strong className="text-[#E9EAF0]">{libraryCount}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-[#8D93A6]"><LoaderCircle size={14} className={pendingDownloadCount ? 'animate-spin text-[#FFFFFF]' : 'text-[#565C6E]'} /> pendientes o en cola</span>
                  <strong className={pendingDownloadCount ? 'text-[#FFFFFF]' : 'text-[#565C6E]'}>{pendingDownloadCount}</strong>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-2 text-[#8D93A6]"><Search size={14} className={activeSearchCount ? 'animate-spin text-[#7FD8CC]' : 'text-[#565C6E]'} /> búsquedas activas en Soulseek</span>
                  <strong className={activeSearchCount ? 'text-[#7FD8CC]' : 'text-[#565C6E]'}>{activeSearchCount}</strong>
                </div>
                <div className="flex items-center justify-between pl-6 text-[10px] text-[#565C6E]" style={{ fontFamily: FONT_MONO }}>
                  <span>en cola · {queuedDownloadCount}</span>
                  <span>descargando · {activeDownloadCount}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate(TAB_PATHS.library)}
                className="mt-3 w-full rounded border border-[#2C303D] px-2 py-1.5 text-[10px] text-[#8D93A6] transition-colors hover:border-[#FFFFFF]/40 hover:text-[#E9EAF0]"
              >
                abrir biblioteca
              </button>
            </div>
          </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
