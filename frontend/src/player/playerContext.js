import { createContext } from 'react'

// El estado "lento" (qué suena, cola, volumen) y el tiempo (se actualiza varias veces
// por segundo) van en contextos separados para que las filas no se redibujen en cada tick.
export const PlayerStateContext = createContext(null)
export const PlayerTimeContext = createContext({ currentTime: 0, duration: 0 })
