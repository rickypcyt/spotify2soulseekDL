import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { claimPlayback, releasePlayback } from '../utils/playback'
import { PlayerStateContext, PlayerTimeContext } from './playerContext'
import { ROOT_PLAYLIST } from './buildPlaylists'

// Dónde está ahora mismo la canción: la playlist se busca por ruta, no por el nombre guardado,
// así sigue funcionando después de moverla a otra carpeta.
function locate(sourcePlaylists, current) {
  if (!current) return null
  const hit = (sourcePlaylists || []).find((entry) => entry.items.some((song) => song.path === current.path))
  return hit || null
}

const VOLUME_KEY = 'soulseek.player.volume'

function readVolume() {
  try {
    const value = Number(window.localStorage.getItem(VOLUME_KEY))
    return Number.isFinite(value) && window.localStorage.getItem(VOLUME_KEY) !== null
      ? Math.min(1, Math.max(0, value))
      : 1
  } catch {
    return 1
  }
}

/**
 * Reproductor global: un único <audio> que sigue sonando al cambiar de pestaña, con una cola
 * (la playlist desde la que se empezó) y navegación anterior/siguiente.
 *
 * Una fuente (`sourceId`) es una lista de playlists: [{ name, items: [{ path, title, artist,
 * streamUrl, coverUrl }] }]. Los paneles de la app registran las suyas con `registerSource`.
 */
export default function PlayerProvider({ children }) {
  const audioRef = useRef(null)
  const [sources, setSources] = useState({})
  const [now, setNow] = useState(null) // { sourceId, playlist, path, item }
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(readVolume)
  const [muted, setMuted] = useState(false)

  const nowRef = useRef(now)
  const sourcesRef = useRef(sources)
  useEffect(() => {
    nowRef.current = now
    sourcesRef.current = sources
  })

  const findQueue = useCallback((sourceId, playlist) => {
    const playlists = sourcesRef.current[sourceId] || []
    return playlists.find((entry) => entry.name === playlist)?.items || []
  }, [])

  const startItem = useCallback((sourceId, playlist, item) => {
    const audio = audioRef.current
    if (!audio || !item) return
    setNow({ sourceId, playlist, path: item.path, item })
    setCurrentTime(0)
    setDuration(0)
    audio.src = item.streamUrl
    audio.play().catch(() => {})
  }, [])

  const play = useCallback((sourceId, playlist, path) => {
    const item = findQueue(sourceId, playlist).find((entry) => entry.path === path)
    startItem(sourceId, playlist, item)
  }, [findQueue, startItem])

  const step = useCallback((direction) => {
    const current = nowRef.current
    if (!current) return false
    const home = locate(sourcesRef.current[current.sourceId], current)
    const playlist = home ? home.name : current.playlist
    const queue = findQueue(current.sourceId, playlist)
    const index = queue.findIndex((entry) => entry.path === current.path)
    const target = queue[index + direction]
    if (index < 0 || !target) return false
    startItem(current.sourceId, playlist, target)
    return true
  }, [findQueue, startItem])

  const next = useCallback(() => step(1), [step])

  const prev = useCallback(() => {
    const audio = audioRef.current
    // Como en Spotify: pasados unos segundos, "anterior" reinicia la canción.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    step(-1)
  }, [step])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio || !nowRef.current) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }, [])

  const seek = useCallback((time) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(time)) return
    audio.currentTime = time
    setCurrentTime(time)
  }, [])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.removeAttribute('src')
      audio.load()
    }
    setNow(null)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const setVolume = useCallback((value) => {
    setVolumeState(value)
    setMuted(value === 0)
    try {
      window.localStorage.setItem(VOLUME_KEY, String(value))
    } catch {
      // sin almacenamiento: el volumen solo dura esta sesión
    }
  }, [])

  const toggleMute = useCallback(() => setMuted((value) => !value), [])

  // Cada fuente puede registrar cómo mover sus archivos (la biblioteca local).
  const movers = useRef({})
  const registerMover = useCallback((sourceId, fn) => {
    movers.current[sourceId] = fn
  }, [])
  const moveFile = useCallback((sourceId, path, folder) => {
    const fn = movers.current[sourceId]
    if (fn) fn({ dir: 'downloads', path }, folder)
    const current = nowRef.current
    if (current && current.sourceId === sourceId && current.path === path) {
      const base = path.split('/').pop()
      const newPath = folder ? `${folder}/${base}` : base
      setNow((prev) => (prev ? { ...prev, path: newPath, playlist: folder || ROOT_PLAYLIST } : prev))
    }
  }, [])

  const registerSource = useCallback((sourceId, playlists) => {
    setSources((prev) => (prev[sourceId] === playlists ? prev : { ...prev, [sourceId]: playlists }))
  }, [])

  // Eventos del <audio>
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined
    const handlers = {
      play: () => {
        claimPlayback(audio)
        setPlaying(true)
      },
      pause: () => setPlaying(false),
      ended: () => {
        if (!step(1)) setPlaying(false)
      },
      timeupdate: () => setCurrentTime(audio.currentTime),
      loadedmetadata: () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0),
      durationchange: () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0),
    }
    Object.entries(handlers).forEach(([name, fn]) => audio.addEventListener(name, fn))
    return () => {
      Object.entries(handlers).forEach(([name, fn]) => audio.removeEventListener(name, fn))
      releasePlayback(audio)
    }
  }, [step])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted
  }, [muted])

  // Cola derivada: la posición se recalcula por ruta, así sobrevive a que la biblioteca cambie.
  // La playlist se resuelve por la ruta actual: si la canción se movió, la cola sigue su nueva carpeta.
  const home = useMemo(() => (now ? locate(sources[now.sourceId], now) : null), [now, sources])
  const nowResolved = useMemo(
    () => (now ? { ...now, playlist: home ? home.name : now.playlist } : null),
    [now, home],
  )
  const queue = useMemo(
    () => (nowResolved ? (sources[nowResolved.sourceId] || []).find((entry) => entry.name === nowResolved.playlist)?.items || [] : []),
    [nowResolved, sources],
  )
  const index = now ? queue.findIndex((entry) => entry.path === now.path) : -1
  const item = now ? (index >= 0 ? queue[index] : now.item) : null
  const hasPrev = index > 0
  const hasNext = index >= 0 && index < queue.length - 1

  // Teclas multimedia y pantalla de bloqueo
  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined
    if (!item) {
      navigator.mediaSession.metadata = null
      return undefined
    }
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: item.title,
      artist: item.artist || '',
      album: now?.playlist || '',
      artwork: item.coverUrl ? [{ src: new URL(item.coverUrl, window.location.href).href }] : [],
    })
    return undefined
  }, [item, now?.playlist])

  useEffect(() => {
    if (!('mediaSession' in navigator)) return undefined
    const session = navigator.mediaSession
    session.playbackState = now ? (playing ? 'playing' : 'paused') : 'none'
    session.setActionHandler('play', toggle)
    session.setActionHandler('pause', toggle)
    session.setActionHandler('previoustrack', hasPrev ? prev : null)
    session.setActionHandler('nexttrack', hasNext ? next : null)
    return () => {
      ;['play', 'pause', 'previoustrack', 'nexttrack'].forEach((name) => session.setActionHandler(name, null))
    }
  }, [now, playing, hasPrev, hasNext, toggle, prev, next])

  const actions = useMemo(
    () => ({ play, toggle, next, prev, seek, stop, setVolume, toggleMute, registerSource, registerMover, moveFile }),
    [play, toggle, next, prev, seek, stop, setVolume, toggleMute, registerSource, registerMover, moveFile],
  )

  const state = useMemo(
    () => ({ now: nowResolved, item, index, queue, sources, playing, volume, muted, hasPrev, hasNext, actions }),
    [nowResolved, item, index, queue, sources, playing, volume, muted, hasPrev, hasNext, actions],
  )
  const time = useMemo(() => ({ currentTime, duration }), [currentTime, duration])

  return (
    <PlayerStateContext.Provider value={state}>
      <PlayerTimeContext.Provider value={time}>
        <audio ref={audioRef} preload="auto" />
        {children}
      </PlayerTimeContext.Provider>
    </PlayerStateContext.Provider>
  )
}
