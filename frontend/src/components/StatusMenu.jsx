import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { FONT_MONO } from '../constants'
import SoulseekNetworkCheck from './SoulseekNetworkCheck'

const LEVEL_STYLES = {
  ok: { dot: 'bg-[#7FD8CC]', pill: 'border-[#7FD8CC]/40 bg-[#7FD8CC]/10 text-[#7FD8CC]' },
  pending: { dot: 'bg-amber-400 animate-pulse', pill: 'border-amber-400/40 bg-amber-400/10 text-amber-200' },
  error: { dot: 'bg-red-400', pill: 'border-red-400/40 bg-red-400/10 text-red-200' },
  off: { dot: 'bg-[#565C6E]', pill: 'border-[#3A3F4E] bg-transparent text-[#8D93A6]' },
}

const LEVEL_ORDER = { error: 3, pending: 2, off: 1, ok: 0 }

function StatusRow({ label, level, stateLabel, description, children }) {
  const style = LEVEL_STYLES[level]
  return (
    <div className="rounded-lg border border-[#2C303D] bg-[#0F1117] p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
          <h3 className="text-sm font-semibold text-[#E9EAF0]">{label}</h3>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${style.pill}`}>{stateLabel}</span>
      </div>
      {description && <p className="mt-2 text-xs leading-relaxed text-[#8D93A6]">{description}</p>}
      {children}
    </div>
  )
}

export default function StatusMenu({ config, diagnostics, backendOnline, spotifyAuth, onStartSpotifyAuth }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const status = diagnostics?.configuration
  const hasStatus = Boolean(status)
  const slskdReachable = hasStatus ? Boolean(status.slskd?.reachable) : false
  const slskdLoggedIn = hasStatus ? Boolean(status.slskd?.loggedIn) : false
  const slskdReady = slskdReachable && slskdLoggedIn && Boolean(status.slskd?.apiKeyConfigured)
  const slskdConnecting = slskdReachable && !slskdLoggedIn
  const slskdServerState = status?.slskd?.serverState || ''
  const slskdDisconnected = slskdConnecting && slskdServerState === 'Disconnected'
  const downloadsReady = hasStatus ? Boolean(status.downloads?.exists) : Boolean(config?.downloads_dir)
  const spotifyStatus = spotifyAuth?.status
  const spotifyCredentials = Boolean(config?.spotify_client_id && config?.spotify_client_secret_configured)

  const backend = { level: backendOnline ? 'ok' : 'error', label: backendOnline ? 'Conectado' : 'Sin respuesta' }
  const soulseek = slskdReady
    ? { level: 'ok', label: 'Conectado' }
    : slskdDisconnected
      ? { level: 'error', label: 'Desconectado' }
      : slskdConnecting || !hasStatus
        ? { level: 'pending', label: slskdConnecting ? 'Conectando…' : 'Pendiente' }
        : { level: 'error', label: 'Revisar' }
  const spotify = spotifyStatus === 'authenticated'
    ? { level: 'ok', label: 'Conectado' }
    : spotifyStatus === 'authenticating'
      ? { level: 'pending', label: 'Autorizando…' }
      : { level: 'off', label: 'No conectado' }
  const downloads = !hasStatus
    ? { level: 'pending', label: 'Pendiente' }
    : downloadsReady
      ? { level: 'ok', label: 'Lista' }
      : { level: 'error', label: 'Revisar' }

  const items = [backend, soulseek, spotify, downloads]
  // Spotify es opcional (la búsqueda directa no lo necesita): no cuenta como problema.
  const overall = [backend, soulseek, downloads].reduce(
    (worst, item) => (LEVEL_ORDER[item.level] > LEVEL_ORDER[worst] ? item.level : worst),
    'ok',
  )
  const overallText = { ok: 'Todo listo', pending: 'Conectando…', error: 'Revisar', off: 'Todo listo' }[overall]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Estado de la configuración"
        className={`flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
          open ? 'border-[#3A3F4E] bg-[#2C303D] text-[#E9EAF0]' : 'border-[#2C303D] text-[#8D93A6] hover:bg-[#1A1D28] hover:text-[#E9EAF0]'
        }`}
      >
        <span className="flex items-center gap-1.5" aria-hidden="true">
          {items.map((item, index) => (
            <span key={index} className={`h-2.5 w-2.5 rounded-full ${LEVEL_STYLES[item.level].dot}`} />
          ))}
        </span>
        <span>{overallText}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Estado de la configuración"
          className="absolute right-0 top-full z-50 mt-2 w-[min(28rem,calc(100vw-2.5rem))] space-y-3 rounded-xl border border-[#343949] bg-[#161822] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#E9EAF0]">Estado de la configuración</h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-[#565C6E]" style={{ fontFamily: FONT_MONO }}>estado</span>
          </div>

          <StatusRow
            label="Backend"
            level={backend.level}
            stateLabel={backend.label}
            description={backendOnline ? 'El servidor local de la app responde.' : 'El servidor local no responde. Reinicia la aplicación.'}
          />

          <StatusRow
            label="Soulseek / slskd"
            level={soulseek.level}
            stateLabel={soulseek.label}
            description={
              slskdDisconnected
                ? 'slskd está desconectado del servidor de Soulseek y no se puede buscar. Si no reconecta solo, tu red puede estar bloqueando el puerto 2271 (p. ej. firewall o wifi restringido).'
                : slskdConnecting
                  ? `slskd responde pero sigue iniciando sesión en el servidor de Soulseek (${slskdServerState || 'conectando'}). Las búsquedas se habilitan al conectar.`
                  : slskdReady
                    ? `Servicio conectado en ${status.slskd.url}.`
                    : 'El servicio no responde o falta la API key. Revisa slskd.exe y su URL.'
            }
          >
            {status?.slskd && !status.slskd.reachable && (
              <p className="mt-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                Para habilitar las búsquedas, inicia slskd o configura la ruta de <strong>slskd.exe</strong> en Configuración y guarda los cambios.
              </p>
            )}
            {config?.slskd_path && status?.slskd && !status.slskd.executableExists && (
              <p className="mt-2 text-xs text-red-200">La ruta configurada de slskd.exe no existe: {config.slskd_path}</p>
            )}
            {!slskdReady && <SoulseekNetworkCheck />}
          </StatusRow>

          <StatusRow
            label="Spotify"
            level={spotify.level}
            stateLabel={spotify.label}
            description={
              spotifyStatus === 'authenticated'
                ? 'Spotify está conectado. Puedes cargar playlists privadas.'
                : spotifyStatus === 'authenticating'
                  ? 'Completa la autorización en la ventana del navegador…'
                  : !spotifyCredentials
                    ? 'Opcional: guarda Client ID y Client Secret en Configuración para cargar playlists.'
                    : 'Spotify necesita autorización para leer tus playlists.'
            }
          >
            {spotifyAuth?.error && <p className="mt-2 text-xs text-red-200">{spotifyAuth.error}</p>}
            {spotifyStatus === 'authenticating' && spotifyAuth?.url && (
              <a
                href={spotifyAuth.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 block break-all text-xs text-[#7FD8CC] underline"
              >
                Abrir link de autorización de Spotify
              </a>
            )}
            <button
              type="button"
              onClick={onStartSpotifyAuth}
              disabled={spotifyStatus === 'authenticating' || !spotifyCredentials}
              className="mt-3 rounded-lg bg-[#FFFFFF] px-3.5 py-2 text-xs font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {spotifyStatus === 'authenticated' ? 'Reautorizar Spotify' : 'Conectar Spotify'}
            </button>
          </StatusRow>

          <StatusRow
            label="Carpeta de descargas"
            level={downloads.level}
            stateLabel={downloads.label}
            description={downloadsReady ? (status?.downloads?.path || config?.downloads_dir) : 'La carpeta todavía no existe o no está configurada.'}
          />
        </div>
      )}
    </div>
  )
}
