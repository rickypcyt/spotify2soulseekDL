import { Check, SlidersHorizontal } from 'lucide-react'

const PICK_MODES = [
  ['quality', 'Mejor calidad', 'El resultado con mejor calidad de audio.'],
  ['speed', 'Más rápido', 'El que se descargará más rápido.'],
  ['longest', 'Más largo', 'El de mayor duración.'],
  ['balanced', 'Balanceado', 'Un equilibrio entre calidad y velocidad.'],
]

const FORMATS = [
  ['mp3', 'MP3'],
  ['wav', 'WAV'],
  ['aiff', 'AIFF'],
  ['flac', 'FLAC'],
]

// Mismos formatos que los visibles, más "Cualquiera".
const FORMAT_PREFS = [['any', 'Cualquiera'], ...FORMATS]

function Step({ number, title, hint, children }) {
  return (
    <div className="flex gap-3.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2C303D] text-xs font-semibold text-[#7FD8CC]">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-semibold text-[#E9EAF0]">{title}</h4>
        <div className="mt-2.5 flex flex-wrap gap-2">{children}</div>
        {hint && <p className="mt-2 text-xs text-[#8D93A6]">{hint}</p>}
      </div>
    </div>
  )
}

function Chip({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm transition-colors ${
        active
          ? 'border-[#7FD8CC]/60 bg-[#7FD8CC]/10 font-medium text-[#E9EAF0]'
          : 'border-[#2C303D] bg-[#0F1117] text-[#8D93A6] hover:border-[#3A3F4E] hover:text-[#E9EAF0]'
      }`}
    >
      {active && <Check size={14} className="text-[#7FD8CC]" />}
      {children}
    </button>
  )
}

/** Preferencias del resultado recomendado; viven dentro de la card de búsqueda. */
export default function RecommendConfig({
  pickMode,
  onPickModeChange,
  formatPref,
  onFormatPrefChange,
  formatFilters,
  onFormatFiltersChange,
}) {
  const toggleFormat = (format) => {
    if (formatFilters.includes(format)) {
      if (formatFilters.length === 1) return
      onFormatFiltersChange(formatFilters.filter((item) => item !== format))
    } else {
      onFormatFiltersChange([...formatFilters, format])
    }
  }

  const mode = PICK_MODES.find(([value]) => value === pickMode) || PICK_MODES[0]
  const prefLabel = FORMAT_PREFS.find(([value]) => value === formatPref)?.[1] || 'Cualquiera'

  return (
    <div className="mt-5 border-t border-[#2C303D] pt-5">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2C303D] text-[#7FD8CC]">
          <SlidersHorizontal size={17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-[#E9EAF0]">Preferencias de resultados</h3>
          <p className="text-xs text-[#8D93A6]">
            Para cada canción marcamos un resultado como <strong className="font-medium text-[#E9EAF0]">recomendado</strong>.
            Estos ajustes deciden cuál. Se guardan solos.
          </p>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border border-[#2C303D] bg-[#0F1117] p-5">
        <Step number="1" title="¿Qué priorizar al recomendar?" hint={mode[2]}>
          {PICK_MODES.map(([value, label]) => (
            <Chip key={value} active={pickMode === value} onClick={() => onPickModeChange(value)}>
              {label}
            </Chip>
          ))}
        </Step>

        <Step
          number="2"
          title="¿Tienes un formato favorito?"
          hint={formatPref === 'any' ? 'Sin preferencia: se elige solo por el criterio anterior.' : `Si hay un ${prefLabel}, tendrá prioridad.`}
        >
          {FORMAT_PREFS.map(([value, label]) => (
            <Chip key={value} active={formatPref === value} onClick={() => onFormatPrefChange(value)}>
              {label}
            </Chip>
          ))}
        </Step>

        <Step number="3" title="¿Qué formatos quieres ver?" hint="Los desactivados no aparecen en los resultados ni se recomiendan. Debe quedar al menos uno.">
          {FORMATS.map(([value, label]) => (
            <Chip
              key={value}
              active={formatFilters.includes(value)}
              onClick={() => toggleFormat(value)}
              title={`${formatFilters.includes(value) ? 'Ocultar' : 'Mostrar'} ${label}`}
            >
              {label}
            </Chip>
          ))}
        </Step>
      </div>
    </div>
  )
}
