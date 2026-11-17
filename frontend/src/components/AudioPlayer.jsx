import { Pause, Play, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { claimPlayback, releasePlayback } from '../utils/playback'

const VOLUME_KEY = 'soulseek.player.volume'
function readStoredVolume() {
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY)
    const value = raw === null ? NaN : Number(raw)
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1
  } catch {
    return 1
  }
}

function storeVolume(value) {
  try {
    window.localStorage.setItem(VOLUME_KEY, String(value))
  } catch {
    // sin almacenamiento disponible: el volumen simplemente no se recuerda
  }
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Reproductor propio: play/pausa, tiempo actual, barra de progreso, duración
 * total y volumen. `audioRef` expone el <audio> interno para quien necesite
 * detenerlo o recargarlo desde fuera.
 */
export default function AudioPlayer({
  src,
  audioRef,
  preload = 'none',
  onDuration,
  size = 'md',
  className = '',
}) {
  const innerRef = useRef(null)
  const ref = audioRef || innerRef
  const draggingRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(readStoredVolume)
  const [muted, setMuted] = useState(false)
  const [failed, setFailed] = useState(false)
  const onDurationRef = useRef(onDuration)

  useEffect(() => {
    onDurationRef.current = onDuration
  })

  const compact = size === 'sm'

  useEffect(() => {
    const audio = ref.current
    if (!audio) return undefined
    audio.volume = volume
    audio.muted = muted

    const syncDuration = () => {
      const value = Number.isFinite(audio.duration) ? audio.duration : 0
      setDuration(value)
      if (value) onDurationRef.current?.(value)
    }
    const handlers = {
      play: () => {
        claimPlayback(audio)
        setPlaying(true)
        setFailed(false)
      },
      pause: () => setPlaying(false),
      ended: () => {
        setPlaying(false)
        setCurrent(0)
      },
      timeupdate: () => {
        if (!draggingRef.current) setCurrent(audio.currentTime)
      },
      loadedmetadata: syncDuration,
      durationchange: syncDuration,
      emptied: () => {
        setPlaying(false)
        setCurrent(0)
        setDuration(0)
      },
      error: () => {
        setPlaying(false)
        // Un src vacío (al detener desde fuera) también dispara error: solo avisar si hay fuente.
        if (audio.getAttribute('src')) setFailed(true)
      },
    }
    Object.entries(handlers).forEach(([name, fn]) => audio.addEventListener(name, fn))
    return () => {
      Object.entries(handlers).forEach(([name, fn]) => audio.removeEventListener(name, fn))
    }
    // volume/muted se aplican en sus propios efectos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])

  useEffect(() => {
    const audio = ref.current
    return () => releasePlayback(audio)
  }, [ref])

  useEffect(() => {
    if (ref.current) ref.current.volume = volume
  }, [ref, volume])

  useEffect(() => {
    if (ref.current) ref.current.muted = muted
  }, [ref, muted])

  const toggle = useCallback(() => {
    const audio = ref.current
    if (!audio) return
    if (audio.paused) {
      setFailed(false)
      audio.play().catch(() => setFailed(true))
    } else {
      audio.pause()
    }
  }, [ref])

  const seek = (value) => {
    const audio = ref.current
    if (!audio) return
    audio.currentTime = value
    setCurrent(value)
  }

  const changeVolume = (value) => {
    setVolume(value)
    setMuted(value === 0)
    storeVolume(value)
  }

  const progress = duration ? Math.min(100, (current / duration) * 100) : 0
  const effectiveVolume = muted ? 0 : volume
  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2
  const buttonSize = compact ? 'h-8 w-8' : 'h-10 w-10'
  const iconSize = compact ? 15 : 18

  return (
    <div className={`flex w-full min-w-0 items-center gap-3 ${className}`}>
      <audio ref={ref} src={src} preload={preload} />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar' : 'Reproducir'}
        title={playing ? 'Pausar' : 'Reproducir'}
        className={`player-play flex ${buttonSize} shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105`}
      >
        {playing
          ? <Pause size={iconSize} fill="currentColor" strokeWidth={0} />
          : <Play size={iconSize} fill="currentColor" strokeWidth={0} className="translate-x-px" />}
      </button>

      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[#E9EAF0]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        {formatTime(current)}
      </span>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(current, duration || 0)}
        disabled={!duration}
        onPointerDown={() => { draggingRef.current = true }}
        onPointerUp={() => { draggingRef.current = false }}
        onPointerCancel={() => { draggingRef.current = false }}
        onChange={(event) => seek(Number(event.target.value))}
        aria-label="Posición de reproducción"
        className="player-range min-w-0 flex-1"
        style={{ '--fill': `${progress}%` }}
      />

      <span className="w-10 shrink-0 text-xs tabular-nums text-[#8D93A6]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
        {formatTime(duration)}
      </span>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMuted((value) => !value)}
          aria-label={effectiveVolume === 0 ? 'Activar sonido' : 'Silenciar'}
          title={effectiveVolume === 0 ? 'Activar sonido' : 'Silenciar'}
          className="btn-icon flex h-8 w-8 items-center justify-center rounded-lg !p-0 text-[#8D93A6] transition-colors hover:text-[#E9EAF0]"
        >
          <VolumeIcon size={17} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={effectiveVolume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          aria-label="Volumen"
          className="player-range hidden w-20 sm:block"
          style={{ '--fill': `${effectiveVolume * 100}%` }}
        />
      </div>

      {failed && <span className="shrink-0 text-xs text-red-300">Error de audio</span>}
    </div>
  )
}
