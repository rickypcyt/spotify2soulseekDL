// Solo suena un audio a la vez en toda la app.
let activeAudio = null

/** Pausa cualquier otro audio y marca este como el que suena. */
export function claimPlayback(audio) {
  if (activeAudio && activeAudio !== audio) activeAudio.pause()
  activeAudio = audio
}

/** Libera la marca si este audio era el activo (al desmontar). */
export function releasePlayback(audio) {
  if (activeAudio === audio) activeAudio = null
}
