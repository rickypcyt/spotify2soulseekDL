import { FolderInput, FolderOpen, ImagePlus, Music, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { FONT_MONO } from '../constants'
import AudioPlayer from './AudioPlayer'
import PlaylistSelectModal from './PlaylistSelectModal'

const FILE_DRAG_TYPE = 'application/x-soulseek-file'

function formatDuration(seconds) {
  if (!seconds || !Number.isFinite(seconds)) return '--:--'
  const total = Math.floor(seconds)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function formatBitrate(bytes, seconds) {
  if (!bytes || !seconds || !Number.isFinite(seconds)) return null
  return `${Math.round((Number(bytes) * 8) / seconds / 1000)} kbps`
}

function IconButton({ title, onClick, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border !p-0 transition-colors ${
        danger
          ? 'border-[#2C303D] text-[#8D93A6] hover:border-red-400/60 hover:text-red-300'
          : 'border-[#2C303D] text-[#8D93A6] hover:border-[#3A3F4E] hover:text-[#E9EAF0]'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Card de un archivo temporal: reproducir, elegir carpeta (modal) y guardar.
 */
export default function TempFileCard({
  file,
  streamUrl,
  coverUrl,
  folders = [],
  formatSize,
  onSave,
  onSearchCover,
  onReveal,
  onDelete,
}) {
  const audioRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [coverFailed, setCoverFailed] = useState(false)
  const [coverRefresh, setCoverRefresh] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const extension = (file.name.split('.').pop() || 'archivo').toUpperCase()
  const bitrate = formatBitrate(file.size, duration)
  const coverSrc = coverUrl ? `${coverUrl}${coverUrl.includes('?') ? '&' : '?'}v=${coverRefresh}` : ''

  const stopAudio = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.removeAttribute('src')
    audio.load()
  }

  async function saveTo(folderName) {
    const target = (folderName || '').trim()
    if (!target) return
    setSaving(true)
    stopAudio()
    try {
      await onSave(file.path, target)
    } finally {
      setSaving(false)
    }
  }

  function chooseFolder() {
    if (folders.length > 0) {
      setPickerOpen(true)
      return
    }
    // Aún no hay carpetas en la biblioteca: pedir el nombre de la primera.
    saveTo(window.prompt('Nombre de la carpeta donde guardar:'))
  }

  return (
    <article
      draggable
      onDragStart={(event) => {
        stopAudio()
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(FILE_DRAG_TYPE, JSON.stringify({ dir: 'previews', path: file.path }))
      }}
      className="rounded-xl border border-[#2C303D] bg-[#161822] p-4 sm:p-5"
    >
      <div className="flex items-start gap-4">
        {coverSrc && !coverFailed ? (
          <img
            key={coverSrc}
            src={coverSrc}
            alt=""
            onError={() => setCoverFailed(true)}
            className="h-20 w-20 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[#0F1117] text-[#565C6E]">
            <Music size={28} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="break-words [overflow-wrap:anywhere] text-base font-semibold leading-snug text-[#E9EAF0]" title={file.path}>
            {file.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
            <span className="rounded-md bg-[#2C303D] px-2 py-0.5 text-[#E9EAF0]">{extension}</span>
            <span>{formatDuration(duration)}</span>
            <span>·</span>
            <span>{formatSize(file.size)}</span>
            {bitrate && (
              <>
                <span>·</span>
                <span>{bitrate}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <AudioPlayer
        audioRef={audioRef}
        src={streamUrl}
        preload="metadata"
        onDuration={setDuration}
        className="mt-4"
      />

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={chooseFolder}
          disabled={saving}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-[#FFFFFF] px-5 py-2.5 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FolderInput size={16} />
          {saving ? 'Guardando…' : 'Elegir carpeta y guardar'}
        </button>
        {onSearchCover && (
          <IconButton
            title="Buscar y añadir portada"
            onClick={async () => {
              await onSearchCover(file.path)
              setCoverFailed(false)
              setCoverRefresh(Date.now())
            }}
          >
            <ImagePlus size={16} />
          </IconButton>
        )}
        {onReveal && (
          <IconButton title="Mostrar en el explorador" onClick={() => onReveal(file.path)}>
            <FolderOpen size={16} />
          </IconButton>
        )}
        <IconButton
          title="Borrar"
          danger
          onClick={() => {
            stopAudio()
            onDelete(file.path)
          }}
        >
          <Trash2 size={16} />
        </IconButton>
      </div>

      <PlaylistSelectModal
        open={pickerOpen}
        playlists={folders}
        title="Guardar en carpeta"
        subtitle={file.name}
        allowEmpty={false}
        allowCreate
        onClose={() => setPickerOpen(false)}
        onSelect={(playlist) => {
          setPickerOpen(false)
          saveTo(playlist)
        }}
      />
    </article>
  )
}
