import { isPlayableFile } from '../constants'

export const ROOT_PLAYLIST = 'Sin playlist'

/**
 * Convierte el árbol de la biblioteca en las playlists del reproductor, en el mismo
 * orden en que se muestran: [{ name, items: [{ path, title, artist, streamUrl, coverUrl }] }].
 * Cada carpeta que contiene audio directamente es una playlist.
 */
export function buildPlaylists(tree, { streamUrlFor, coverUrlFor, metadataFor }) {
  const playlists = []

  const collect = (node, folderPath) => {
    const items = [...node.files]
      .filter(isPlayableFile)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((file) => {
        const metadata = metadataFor?.(file.path) || {}
        return {
          path: file.path,
          title: metadata.trackName?.trim() || file.name.replace(/\.[^.]+$/, ''),
          artist: metadata.artists?.trim() || '',
          streamUrl: streamUrlFor(file.path),
          coverUrl: coverUrlFor?.(file.path) || '',
        }
      })
    // Las carpetas vacías también cuentan: son destinos válidos para soltar canciones.
    if (items.length > 0 || folderPath) playlists.push({ name: folderPath || ROOT_PLAYLIST, items })
    Object.entries(node.folders)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([name, child]) => collect(child, folderPath ? `${folderPath}/${name}` : name))
  }

  collect(tree, '')
  return playlists
}
