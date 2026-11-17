import { CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldAlert, ShieldCheck, WifiOff, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FONT_MONO } from '../constants'
import SoulseekNetworkCheck from './SoulseekNetworkCheck'

const STATUS_PILL = {
  idle: { label: 'Sin verificar', className: 'border-[#3A3F4E] text-[#8D93A6]' },
  validating: { label: 'Verificando…', className: 'border-amber-400/40 bg-amber-400/10 text-amber-200' },
  valid: { label: 'Verificada', className: 'border-[#7FD8CC]/40 bg-[#7FD8CC]/10 text-[#7FD8CC]' },
  invalid: { label: 'Rechazada', className: 'border-red-400/40 bg-red-400/10 text-red-200' },
  unreachable: { label: 'Sin conexión', className: 'border-amber-400/40 bg-amber-400/10 text-amber-200' },
  error: { label: 'Error', className: 'border-red-400/40 bg-red-400/10 text-red-200' },
}

const BANNERS = {
  valid: {
    icon: ShieldCheck,
    tone: 'border-[#7FD8CC]/40 bg-[#7FD8CC]/10 text-[#CFF3EE]',
    title: 'El servidor de Soulseek aceptó tus datos',
  },
  invalid: {
    icon: XCircle,
    tone: 'border-red-400/40 bg-red-400/10 text-red-100',
    title: 'El servidor rechazó el usuario o la contraseña',
  },
  unreachable: {
    icon: WifiOff,
    tone: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
    title: 'No se pudo llegar al servidor de Soulseek',
  },
  error: {
    icon: ShieldAlert,
    tone: 'border-red-400/40 bg-red-400/10 text-red-100',
    title: 'No se pudo completar la verificación',
  },
}

function Field({ id, label, state, children }) {
  const border = state === 'valid'
    ? 'border-[#7FD8CC]/70'
    : state === 'invalid'
      ? 'border-red-400/70'
      : 'border-[#2C303D] focus-within:border-[#7FD8CC]/70'
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-[#E9EAF0]">{label}</label>
      <div className={`mt-1.5 flex items-center gap-2.5 rounded-xl border bg-[#0F1117] px-4 py-3 transition-colors ${border}`}>
        {children}
        {state === 'valid' && <CheckCircle2 size={17} className="shrink-0 text-[#7FD8CC]" aria-label="Correcto" />}
        {state === 'invalid' && <XCircle size={17} className="shrink-0 text-red-300" aria-label="Incorrecto" />}
      </div>
    </div>
  )
}

/**
 * Formulario de la cuenta de Soulseek: al enviarlo inicia sesión de verdad en el
 * servidor (vía slskd) y solo guarda las credenciales si el servidor las acepta.
 */
export default function SoulseekAccountForm({ config, onChange, onValidate, onSave }) {
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [elapsed, setElapsed] = useState(0)

  const username = config.soulseek_username || ''
  const password = config.soulseek_password || ''
  const passwordSaved = Boolean(config.soulseek_password_configured)
  const canSubmit = status !== 'validating' && username.trim() && (password || passwordSaved)

  useEffect(() => {
    if (status !== 'validating') return undefined
    const started = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500)
    return () => clearInterval(timer)
  }, [status])

  const update = (key, value) => {
    onChange((current) => ({ ...current, [key]: value }))
    // Cambiar un dato invalida la verificación anterior.
    if (status !== 'validating') {
      setStatus('idle')
      setResult(null)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!canSubmit) return
    setStatus('validating')
    setElapsed(0)
    setResult(null)
    try {
      const data = await onValidate(username.trim(), password)
      setResult(data)
      if (data.ok) {
        setStatus('valid')
        await onSave() // solo se guarda lo que el servidor confirmó
      } else if (data.status === 'unreachable') {
        setStatus('unreachable')
      } else if (data.status === 'invalid') {
        setStatus('invalid')
      } else {
        setStatus('error')
      }
    } catch (err) {
      setResult({ message: err.message })
      setStatus('error')
    }
  }

  const pill = STATUS_PILL[status]
  const banner = BANNERS[status]
  const fieldState = status === 'valid' ? 'valid' : status === 'invalid' ? 'invalid' : 'idle'
  const step = elapsed < 6 ? 'Reiniciando slskd con tus datos…' : elapsed < 14 ? 'Conectando con el servidor de Soulseek…' : 'Esperando el inicio de sesión…'

  return (
    <section className="mb-8 rounded-xl border border-[#2C303D] bg-[#161822] p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2C303D] text-[#7FD8CC]">
            <ShieldCheck size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-[#E9EAF0]">Cuenta de Soulseek</h2>
            <p className="text-sm text-[#8D93A6]">Se comprueba iniciando sesión en el servidor. Si es correcta, se guarda.</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm ${pill.className}`}>{pill.label}</span>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="soulseek-user" label="Usuario" state={fieldState}>
            <input
              id="soulseek-user"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => update('soulseek_username', event.target.value)}
              placeholder="tu usuario de Soulseek"
              className="input-bare min-w-0 flex-1 bg-transparent text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none"
              style={{ fontFamily: FONT_MONO }}
            />
          </Field>
          <Field id="soulseek-pass" label="Contraseña" state={fieldState}>
            <input
              id="soulseek-pass"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => update('soulseek_password', event.target.value)}
              placeholder={passwordSaved ? 'guardada (escribe para cambiarla)' : 'tu contraseña'}
              className="input-bare min-w-0 flex-1 bg-transparent text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none"
              style={{ fontFamily: FONT_MONO }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              title={showPassword ? 'Ocultar' : 'Mostrar'}
              className="btn-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-md !p-0 text-[#8D93A6] transition-colors hover:text-[#E9EAF0]"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={!canSubmit}
            className="flex items-center gap-2 rounded-lg bg-[#FFFFFF] px-6 py-3 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'validating' ? <LoaderCircle size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {status === 'validating' ? 'Verificando…' : status === 'valid' ? 'Verificar de nuevo' : 'Verificar y guardar'}
          </button>
          {status === 'validating' && (
            <p className="text-sm text-[#8D93A6]" aria-live="polite">
              {step} <span style={{ fontFamily: FONT_MONO }}>{elapsed} s</span>
              <span className="ml-2 text-xs">(puede tardar hasta ~25 s)</span>
            </p>
          )}
          {!canSubmit && status !== 'validating' && (
            <p className="text-xs text-[#8D93A6]">Escribe tu usuario y contraseña para verificarlos.</p>
          )}
        </div>
      </form>

      {banner && result && (
        <div className={`mt-5 rounded-xl border p-4 ${banner.tone}`} role="status">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <banner.icon size={17} className="shrink-0" />
            {banner.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed opacity-90">{result.message}</p>
          {status === 'valid' && (
            <p className="mt-1.5 text-xs opacity-80">Las credenciales ya están guardadas en el almacén seguro del sistema.</p>
          )}
          {status === 'invalid' && (
            <p className="mt-2 text-xs leading-relaxed opacity-80">
              Si el nombre de usuario ya existe en Soulseek con otra contraseña, el servidor la rechaza. Un nombre libre se registra solo en el primer inicio de sesión.
            </p>
          )}
          {status === 'unreachable' && <SoulseekNetworkCheck />}
        </div>
      )}
    </section>
  )
}
