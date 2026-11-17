import { useContext } from 'react'
import { PlayerStateContext, PlayerTimeContext } from './playerContext'

const EMPTY_ACTIONS = {
  play: () => {},
  toggle: () => {},
  next: () => {},
  prev: () => {},
  seek: () => {},
  stop: () => {},
  setVolume: () => {},
  toggleMute: () => {},
  registerSource: () => {},
  registerMover: () => {},
  moveFile: () => {},
}

/** Estado del reproductor global y sus acciones. Seguro fuera del proveedor. */
export function usePlayerState() {
  return useContext(PlayerStateContext) || {
    now: null,
    item: null,
    index: -1,
    queue: [],
    sources: {},
    playing: false,
    volume: 1,
    muted: false,
    hasPrev: false,
    hasNext: false,
    actions: EMPTY_ACTIONS,
  }
}

/** Tiempo actual y duración (cambia varias veces por segundo). */
export function usePlayerTime() {
  return useContext(PlayerTimeContext)
}
