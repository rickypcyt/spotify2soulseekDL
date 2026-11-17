import { CheckCircle2, LoaderCircle, XCircle, Activity } from 'lucide-react'
import { useState } from 'react'
import { FONT_MONO } from '../constants'

const VERDICT_STYLES = {
  ok: 'border-[#7FD8CC]/40 bg-[#7FD8CC]/10 text-[#CFF3EE]',
  port_blocked: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  dns: 'border-amber-400/40 bg-amber-400/10 text-amber-100',
  no_internet: 'border-red-400/40 bg-red-400/10 text-red-200',
}

export default function SoulseekNetworkCheck() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function runCheck() {
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/network/soulseek-check', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setResult(await res.json())
    } catch (err) {
      setResult(null)
      setError(`No se pudo ejecutar la prueba: ${err.message}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-600 bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Probar conexión con Soulseek</h3>
          <p className="mt-1 text-sm text-slate-300">
            Comprueba si el problema es tu red (por ejemplo eduroam bloqueando el puerto 2271) o algo más.
          </p>
        </div>
        <button
          type="button"
          onClick={runCheck}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? <LoaderCircle size={15} className="animate-spin" /> : <Activity size={15} />}
          {running ? 'Probando…' : 'Probar conexión'}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-200">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3">
          <p className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${VERDICT_STYLES[result.verdict] || VERDICT_STYLES.dns}`}>
            {result.message}
          </p>
          <ul className="space-y-1.5">
            {Object.entries(result.checks).map(([key, check]) => (
              <li key={key} className="flex flex-wrap items-center gap-2 text-xs" style={{ fontFamily: FONT_MONO }}>
                {check.ok
                  ? <CheckCircle2 size={14} className="shrink-0 text-[#7FD8CC]" />
                  : <XCircle size={14} className="shrink-0 text-red-300" />}
                <span className="text-slate-200">{check.label}</span>
                <span className="text-slate-400">· {check.detail} · {check.ms} ms</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
