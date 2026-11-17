import {
  Download,
  FileDown,
  FilePenLine,
  FolderInput,
  FolderOpen,
  ImagePlus,
  Music,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import AudioPlayer from './AudioPlayer'
import CoverLightbox from './CoverLightbox'
import PlaylistSelectModal from './PlaylistSelectModal'

const FILE_DRAG_TYPE = 'application/x-soulseek-file'
const FONT_MONO = "'IBM Plex Mono', 'SFMono-Regular', Menlo, monospace"

function formatDuration(ms) {
  if (!ms || isNaN(ms)) return '--:--'
  const total = Math.floor(Number(ms) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatBitrate(bytes, durationSeconds) {
  if (!bytes || !durationSeconds || !Number.isFinite(durationSeconds)) return null
  return `${Math.round((Number(bytes) * 8) / durationSeconds / 1000)} kbps`
}

const TONES = {
  neutral: 'border-[#2C303D] text-[#E9EAF0] hover:border-[#3A3F4E] hover:bg-[#1A1D28]',
  accent: 'border-[#7FD8CC]/50 bg-[#7FD8CC]/10 text-[#7FD8CC] hover:border-[#7FD8CC] hover:bg-[#7FD8CC]/15',
  primary: 'border-transparent bg-[#FFFFFF] text-[#161822] hover:bg-[#E9EAF0]',
  danger: 'border-[#2C303D] text-[#8D93A6] hover:border-red-400/60 hover:text-red-300',
  disabled: 'cursor-not-allowed border-[#2C303D] text-[#565C6E] opacity-60',
}

function ActionButton({ icon: Icon, label, title, onClick, tone = 'neutral', disabled = false, href, wide = false }) {
  const className = `flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
    TONES[disabled ? 'disabled' : tone]
  } ${wide ? 'col-span-2' : ''}`
  const content = (
    <>
      <Icon size={16} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{label}</span>
    </>
  )
  if (href && !disabled) {
    return (
      <a href={href} title={title || label} aria-label={title || label} className={className}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title || label} aria-label={title || label} className={className}>
      {content}
    </button>
  )
}

export default function LibraryAudioCard({
  file,
  streamUrl,
  downloadUrl,
  onDownload,
  downloadLabel = 'descargar',
  formatSize,
  onDelete,
  dragDir,
  onMoveStart,
  coverUrl,
  coverSourceUrl,
  onEmbedCover,
  onSearchCover,
  onRenameFile,
  onRevealFile,
  onConvertFlac,
  onMoveToPlaylist,
  movePlaylists = [],
  bpm,
  metadata = {},
  onUpdateMetadata,
  onSearchMetadata,
  downloadPlaylists = [],
  quickSaveLabel = '',
  onQuickSave,
  showPlayer = true,
}) {
  const audioRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [coverFailed, setCoverFailed] = useState(false)
  const [coverRefresh, setCoverRefresh] = useState(0)
  const [editingMetadata, setEditingMetadata] = useState(false)
  const [metadataDraft, setMetadataDraft] = useState({ trackName: '', artists: '' })
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [renamePreview, setRenamePreview] = useState(null)
  const [coverZoom, setCoverZoom] = useState(false)
  const extension = (file.name.split('.').pop() || 'archivo').toUpperCase()
  const bitrate = formatBitrate(file.size, duration)
  const title = metadata.trackName?.trim() || file.name.replace(/\.[^.]+$/, '')
  const artist = metadata.artists?.trim() || 'Artista desconocido'
  const downloadTitle = downloadLabel === 'descargar'
    ? 'Descargar este archivo al equipo'
    : 'Guardar este preview en la biblioteca local'
  const hasCover = Boolean(coverUrl) && !coverFailed

  const stopAudio = () => {
    if (!audioRef.current) return
    audioRef.current.pause()
    audioRef.current.removeAttribute('src')
    audioRef.current.load()
  }

  const coverImgUrl = coverUrl ? `${coverUrl}${coverUrl.includes('?') ? '&' : '?'}v=${coverRefresh}` : ''

  const handleCover = async () => {
    if (coverSourceUrl) await onEmbedCover?.(file.path, coverSourceUrl)
    else await onSearchCover?.(file.path)
    setCoverFailed(false)
    setCoverRefresh(Date.now())
  }

  const canAddCover = Boolean(coverSourceUrl || onSearchCover)


  const renamePreviewModal = renamePreview ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0F16]/80 p-4" onClick={() => setRenamePreview(null)}>
      <div className="w-full max-w-md rounded-2xl border border-[#2C303D] bg-[#161822] p-5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]" onClick={(event) => event.stopPropagation()}>
        <h4 className="mb-4 text-base font-semibold text-[#E9EAF0]">Previsualizar renombre</h4>
        <div className="space-y-2 rounded-lg border border-[#2C303D] bg-[#0F1117] p-4 text-sm text-[#8D93A6]">
          <p className="break-words [overflow-wrap:anywhere]"><span className="text-[#565C6E]">Archivo:</span> {renamePreview.filename}</p>
          <p><span className="text-[#565C6E]">Título:</span> {renamePreview.track_name}</p>
          <p><span className="text-[#565C6E]">Artista:</span> {renamePreview.artists}</p>
          <p><span className="text-[#565C6E]">Álbum:</span> {renamePreview.album || '—'}</p>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setRenamePreview(null)}
            className="rounded-lg border border-[#2C303D] px-4 py-2.5 text-sm text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                setRenamePreview(null)
                await onRenameFile(file.path)
              } catch (err) {
                toast.error('No se pudo renombrar: ' + err.message)
              }
            }}
            className="rounded-lg bg-[#FFFFFF] px-4 py-2.5 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0]"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  ) : null

  const metadataEditor = editingMetadata && (
        <div className="space-y-2.5 rounded-xl border border-[#2C303D] bg-[#0F1117] p-3.5">
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              value={metadataDraft.trackName}
              onChange={(event) => setMetadataDraft((current) => ({ ...current, trackName: event.target.value }))}
              placeholder="Título"
              className="min-w-0 flex-1 rounded-lg border border-[#2C303D] bg-[#161822] px-3 py-2.5 text-sm text-[#E9EAF0] outline-none focus:border-[#7FD8CC]/70"
            />
            <input
              value={metadataDraft.artists}
              onChange={(event) => setMetadataDraft((current) => ({ ...current, artists: event.target.value }))}
              placeholder="Artista"
              className="min-w-0 flex-1 rounded-lg border border-[#2C303D] bg-[#161822] px-3 py-2.5 text-sm text-[#E9EAF0] outline-none focus:border-[#7FD8CC]/70"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (metadataDraft.trackName.trim()) {
                  onUpdateMetadata?.(file.path, metadataDraft.trackName.trim(), metadataDraft.artists.trim())
                  setEditingMetadata(false)
                }
              }}
              className="h-10 flex-1 rounded-lg bg-[#FFFFFF] text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0]"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditingMetadata(false)}
              className="h-10 flex-1 rounded-lg border border-[#2C303D] text-sm text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )

  return (
    <>
      <article
        draggable={Boolean(dragDir)}
        onDragStart={(event) => {
          stopAudio()
          if (dragDir) {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify({ dir: dragDir, path: file.path }))
          }
          onMoveStart?.(event)
        }}
        className={`flex w-full min-w-0 flex-col gap-5 ${showPlayer ? 'rounded-2xl border border-[#2C303D] bg-[#161822] p-4' : ''} ${dragDir ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        {showPlayer && (
        <div className="flex flex-col gap-5 sm:flex-row">
          {/* 1. Portada: clic para ampliar; sin portada, opción de añadirla */}
          {hasCover ? (
            <button
              type="button"
              onClick={() => setCoverZoom(true)}
              title="Ver portada más grande"
              aria-label={`Ver portada de ${title} más grande`}
              className="group relative aspect-square w-full max-w-[220px] shrink-0 self-center overflow-hidden rounded-xl !p-0 sm:h-44 sm:w-44 sm:max-w-none sm:self-start"
            >
              <img
                key={coverImgUrl}
                src={coverImgUrl}
                alt={`Portada de ${title}`}
                onError={() => setCoverFailed(true)}
                className="h-full w-full cursor-zoom-in object-cover"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#10121A]/0 text-xs font-medium text-transparent transition-colors group-hover:bg-[#10121A]/55 group-hover:text-[#E9EAF0]">
                Ampliar
              </span>
            </button>
          ) : (
            <div className="flex aspect-square w-full max-w-[220px] shrink-0 flex-col items-center justify-center gap-2.5 self-center rounded-xl border border-dashed border-[#2C303D] bg-[#0F1117] p-3 text-center text-[#565C6E] sm:h-44 sm:w-44 sm:max-w-none sm:self-start">
              <Music size={34} strokeWidth={1.5} />
              <span className="text-xs">Sin portada</span>
              {canAddCover && (
                <button
                  type="button"
                  onClick={handleCover}
                  className="flex items-center gap-1.5 rounded-lg bg-[#7FD8CC]/10 px-3 py-1.5 text-xs font-medium text-[#7FD8CC] transition-colors hover:bg-[#7FD8CC]/20"
                >
                  <ImagePlus size={14} />
                  Añadir portada
                </button>
              )}
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {/* 2. Título, artista, duración y peso */}
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 break-words [overflow-wrap:anywhere] text-lg font-semibold leading-snug text-[#E9EAF0]" title={file.path}>
                  {title}
                </h3>
                {onDelete && showPlayer && (
                  <button
                    type="button"
                    onClick={() => {
                      stopAudio()
                      onDelete(file.path)
                    }}
                    title="Borrar"
                    aria-label={`Borrar ${title}`}
                    className="btn-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg !p-0 text-[#8D93A6] transition-colors hover:!bg-red-400/10 hover:text-red-300"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
              <p className="mt-1 break-words [overflow-wrap:anywhere] text-sm text-[#8D93A6]">{artist}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[#E9EAF0]" style={{ fontFamily: FONT_MONO }}>
                <span>{duration ? formatDuration(duration * 1000) : '--:--'}</span>
                <span className="text-[#565C6E]">·</span>
                <span>{formatSize(file.size)}</span>
                <span className="rounded-md bg-[#2C303D] px-2 py-0.5 text-xs">{extension}</span>
                {bitrate && <span className="rounded-md border border-[#2C303D] px-2 py-0.5 text-xs text-[#8D93A6]">{bitrate}</span>}
                {bpm ? <span className="rounded-md border border-[#2C303D] px-2 py-0.5 text-xs text-[#8D93A6]">{Math.round(Number(bpm))} BPM</span> : null}
              </div>
            </div>

            {/* 3. Reproductor */}
            {showPlayer ? (
              <AudioPlayer
                audioRef={audioRef}
                src={streamUrl}
                onDuration={setDuration}
                className="mt-auto"
              />
            ) : (
              // Sin controles propios: la reproducción la lleva la barra global. Este audio
              // oculto solo lee la duración para mostrarla junto al peso y el bitrate.
              <audio
                ref={audioRef}
                src={streamUrl}
                preload="metadata"
                onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                className="hidden"
              />
            )}
          </div>
        </div>

        )}
        {metadataEditor}

        {/* 4. Acciones con texto */}
        <div className="grid grid-cols-2 gap-2 border-t border-[#2C303D] pt-4 sm:grid-cols-3 lg:grid-cols-4">
          {quickSaveLabel && onQuickSave && (
            <ActionButton
              wide
              tone="accent"
              icon={Download}
              label={`Guardar en ${quickSaveLabel}`}
              title={`Guardar directo en la carpeta “${quickSaveLabel}”`}
              onClick={() => {
                stopAudio()
                onQuickSave(file.path)
              }}
            />
          )}
          {onDownload ? (
            <ActionButton
              wide={!(quickSaveLabel && onQuickSave)}
              tone="primary"
              icon={Download}
              label={downloadLabel === 'descargar' ? 'Descargar' : 'Guardar en carpeta'}
              title={downloadTitle}
              onClick={() => {
                if (downloadPlaylists.length > 0) setDownloadMenuOpen(true)
                else onDownload(file.path)
              }}
            />
          ) : downloadUrl ? (
            <ActionButton tone="neutral" icon={Download} label="Descargar" title="Descargar este archivo al equipo" href={downloadUrl} />
          ) : null}
          {onMoveToPlaylist && movePlaylists.length > 0 && (
            showPlayer && <ActionButton icon={FolderInput} label="Mover" title="Mover a otra playlist" onClick={() => setMoveMenuOpen(true)} />
          )}
          {onUpdateMetadata && (
            <ActionButton
              icon={FilePenLine}
              label="Editar datos"
              title="Modificar título y artista"
              onClick={() => {
                setMetadataDraft({ trackName: metadata.trackName || file.name.replace(/\.[^.]+$/, ''), artists: metadata.artists || '' })
                setEditingMetadata(true)
              }}
            />
          )}
          {onSearchMetadata && (
            <ActionButton
              icon={FileDown}
              label="Buscar datos"
              title="Buscar metadata en Spotify y guardarla en el archivo"
              onClick={() => onSearchMetadata(file.path)}
            />
          )}
          {onRenameFile && (
            <ActionButton
              icon={Pencil}
              label="Renombrar"
              title="Renombrar archivo: Nombre - Artista"
              onClick={async () => {
                try {
                  const data = await onRenameFile(file.path, { preview: true })
                  setRenamePreview(data)
                } catch (err) {
                  toast.error('No se pudo previsualizar el renombre: ' + err.message)
                }
              }}
            />
          )}
          {onRevealFile && (
            <ActionButton icon={FolderOpen} label="Ver en carpeta" title="Mostrar archivo en el explorador" onClick={() => onRevealFile(file.path)} />
          )}
        </div>
      </article>

      <PlaylistSelectModal
        open={downloadMenuOpen && downloadPlaylists.length > 0}
        playlists={downloadPlaylists}
        title={downloadLabel === 'descargar' ? 'Descargar' : 'Guardar en carpeta'}
        subtitle={file.name}
        onClose={() => setDownloadMenuOpen(false)}
        onSelect={(playlist) => {
          setDownloadMenuOpen(false)
          if (playlist) onDownload(file.path, playlist)
          else onDownload(file.path)
        }}
      />
      <PlaylistSelectModal
        open={moveMenuOpen}
        playlists={movePlaylists}
        title="Mover a carpeta"
        subtitle={file.name}
        allowEmpty={false}
        onClose={() => setMoveMenuOpen(false)}
        onSelect={(playlist) => {
          setMoveMenuOpen(false)
          if (playlist) onMoveToPlaylist(file.path, playlist)
        }}
      />
      {renamePreviewModal}
      <CoverLightbox
        open={coverZoom && hasCover}
        src={coverImgUrl}
        title={title}
        artist={artist}
        onClose={() => setCoverZoom(false)}
        onReplace={canAddCover ? handleCover : undefined}
      />
    </>
  )
}
