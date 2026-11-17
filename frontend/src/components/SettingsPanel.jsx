import { ExternalLink, FolderOpen, KeyRound, Music2, Save, Server } from 'lucide-react'
import { FONT_MONO } from '../constants'

const INPUT = 'mt-1.5 w-full rounded-lg border border-[#2C303D] bg-[#0F1117] px-3.5 py-2.5 text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none transition-colors focus:border-[#7FD8CC]/70'

function Section({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-xl border border-[#2C303D] bg-[#161822] p-5 sm:p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2C303D] text-[#7FD8CC]">
          <Icon size={19} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-[#E9EAF0]">{title}</h3>
          {description && <p className="text-sm text-[#8D93A6]">{description}</p>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Field({ label, hint, wide = false, children }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="text-sm font-medium text-[#E9EAF0]">{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-[#8D93A6]">{hint}</p>}
    </div>
  )
}

export default function SettingsPanel({ config, onChange, onSave, saving }) {
  const update = (key, value) => onChange((current) => ({ ...current, [key]: value }))

  return (
    <form
      className="mb-8 space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
    >
      <Section icon={Music2} title="Spotify" description="Para leer tus playlists. Los secretos se guardan en el almacén seguro del sistema.">
        <Field label="Client ID">
          <input
            value={config.spotify_client_id || ''}
            onChange={(event) => update('spotify_client_id', event.target.value)}
            className={INPUT}
            style={{ fontFamily: FONT_MONO }}
          />
        </Field>
        <Field label="Client Secret" hint={config.spotify_client_secret_configured ? 'Guardado. Escribe para cambiarlo.' : undefined}>
          <input
            type="password"
            placeholder={config.spotify_client_secret_configured ? 'guardado' : ''}
            value={config.spotify_client_secret || ''}
            onChange={(event) => update('spotify_client_secret', event.target.value)}
            className={INPUT}
          />
        </Field>
        <details className="sm:col-span-2 rounded-lg border border-[#2C303D] bg-[#0F1117] p-4">
          <summary className="cursor-pointer text-sm font-medium text-[#E9EAF0]">¿Cómo consigo estas credenciales?</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#8D93A6]">
            <li>
              Abre{' '}
              <a href="https://developer.spotify.com/documentation/web-api/concepts/apps" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#7FD8CC] underline-offset-2 hover:underline">
                developer.spotify.com <ExternalLink size={12} />
              </a>{' '}
              e inicia sesión.
            </li>
            <li>Crea una aplicación y copia el <strong className="text-[#E9EAF0]">Client ID</strong>.</li>
            <li>En la aplicación, abre <strong className="text-[#E9EAF0]">Settings</strong> y copia el <strong className="text-[#E9EAF0]">Client Secret</strong>.</li>
            <li>Agrega esta Redirect URI exactamente como está escrita:</li>
          </ol>
          <code className="mt-2 block rounded-lg border border-[#2C303D] bg-[#161822] px-3 py-2 text-xs text-[#E9EAF0]" style={{ fontFamily: FONT_MONO }}>
            http://127.0.0.1:8080/callback
          </code>
          <p className="mt-3 text-xs text-[#8D93A6]">Después de guardar, pulsa <strong className="text-[#E9EAF0]">Conectar Spotify</strong> para autorizar tus playlists.</p>
        </details>
      </Section>

      <Section icon={Server} title="slskd" description="El motor que conecta con Soulseek. La app lo arranca sola en 127.0.0.1:5030.">
        <Field label="API key de slskd" hint={config.slskd_api_key_configured ? 'Guardada. Escribe para cambiarla.' : undefined}>
          <input
            type="password"
            placeholder={config.slskd_api_key_configured ? 'guardada' : ''}
            value={config.slskd_api_key || ''}
            onChange={(event) => update('slskd_api_key', event.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Ruta de slskd.exe" hint="Déjalo vacío para usar el que trae la app. Cámbialo solo si tienes uno propio.">
          <input
            value={config.slskd_path || ''}
            onChange={(event) => update('slskd_path', event.target.value)}
            placeholder="C:\ruta\a\slskd.exe"
            className={INPUT}
            style={{ fontFamily: FONT_MONO }}
          />
        </Field>
      </Section>

      <Section icon={FolderOpen} title="Descargas" description="Dónde se guardan las canciones y cuántas bajan a la vez.">
        <Field label="Carpeta de descargas" wide>
          <input
            value={config.downloads_dir || ''}
            onChange={(event) => update('downloads_dir', event.target.value)}
            placeholder="C:\Users\...\Music"
            className={INPUT}
            style={{ fontFamily: FONT_MONO }}
          />
        </Field>
        <Field label="Descargas simultáneas" hint="Limita las transferencias que inicia la app; slskd puede mantener otras en cola.">
          <select
            value={config.download_concurrency || 4}
            onChange={(event) => update('download_concurrency', Number(event.target.value))}
            className={INPUT}
          >
            {[1, 2, 4, 6, 8].map((value) => <option key={value} value={value}>{value} a la vez</option>)}
          </select>
        </Field>
      </Section>

      <div className="flex flex-col gap-3 rounded-xl border border-[#2C303D] bg-[#161822] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="flex items-center gap-2 text-sm text-[#8D93A6]">
          <KeyRound size={15} className="shrink-0 text-[#7FD8CC]" />
          Los secretos no se vuelven a mostrar una vez guardados.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#FFFFFF] px-6 py-3 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </form>
  )
}
