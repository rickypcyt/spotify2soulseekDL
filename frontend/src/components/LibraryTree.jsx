import { ChevronDown, Folder, FolderInput, Inbox, Trash2 } from 'lucide-react'
import { useConfirm } from './ConfirmDialog.jsx'
import { useEffect, useState } from 'react'
import LibraryTrackRow from './LibraryTrackRow'
import { ROOT_PLAYLIST } from '../player/buildPlaylists'
import {
  FILE_DRAG_TYPE,
  FONT_MONO,
  formatSize,
  getFolderStats,
  isLibraryFileDrag,
  isPlayableFile,
} from '../constants'

// Clases estáticas para que Tailwind las detecte. En pantallas estrechas se reducen solas.
const COLUMN_CLASSES = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4',
}

// Alto del encabezado de cada playlist (se descuenta del alto total de la columna).
const HEADER_REM = 4.5

// Cuántas columnas caben de verdad: es lo que mide el CSS responsivo (md → 2, xl → 4).
function useVisibleColumns(columns) {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const capacity = width >= 1280 ? 4 : width >= 768 ? 2 : 1
  return Math.min(columns, capacity)
}

export default function LibraryTree({
  node,
  level = 0,
  fullNode = node,
  folderPath = '',
  columns = 4,
  readOnly = false,
  sourceId = 'library',
  onDeleteFolder,
  coverUrlFor,
  dragOverFolder,
  onDragOverFolder,
  onMoveFile,
  storedFileStreamUrl,
  onDeleteFile,
  coverByPath,
  coverSourceByPath,
  onEmbedCover,
  onSearchCover,
  onRenameFile,
  onConvertFlac,
  onMoveToPlaylist,
  movePlaylists = [],
  onRevealFile,
  bpmByPath,
  onSyncBpm,
  onUpdateBpm,
  metadataByPath,
  onUpdateMetadata,
  onSearchMetadata,
}) {
  const confirm = useConfirm()
  const folders = Object.entries(node.folders).sort(([a], [b]) => a.localeCompare(b))
  const files = [...node.files].sort((a, b) => a.name.localeCompare(b.name))

  // Todas las playlists miden lo mismo. Si hay varias filas de playlists, el alto se reparte
  // para ver dos filas a la vez; con una sola fila, ocupa el alto disponible. El espacio
  // vacío de cada columna también sirve para soltar canciones.
  const visibleColumns = useVisibleColumns(columns)
  const cellCount = folders.length + (level === 0 && files.length > 0 ? 1 : 0)
  const visibleRows = Math.ceil(cellCount / visibleColumns) >= 2 ? 2 : 1
  const columnBodyStyle = {
    height: `max(25rem, calc((100dvh - var(--topbar-h, 0px) - 12rem) / ${visibleRows} - ${HEADER_REM}rem))`,
  }

  const renderFiles = () => (
    <div className="space-y-2">
      {files.map((file) => {
        if (!isPlayableFile(file)) {
          return (
            <div key={file.path} className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-[#2C303D] bg-[#161822] px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-sm text-[#E9EAF0]" title={file.path}>{file.name}</span>
              <span className="shrink-0 text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>{formatSize(file.size)}</span>
              {!readOnly && (
                <button
                  onClick={async () => {
                    if (await confirm(`¿Borrar ${file.path}?`, { title: 'Borrar archivo', confirmLabel: 'Borrar' })) onDeleteFile(file.path, 'downloads')
                  }}
                  className="shrink-0 rounded-lg border border-[#2C303D] px-3 py-1.5 text-xs text-[#8D93A6] transition-colors hover:border-red-400/60 hover:text-red-300"
                >
                  Borrar
                </button>
              )}
            </div>
          )
        }
        const cardProps = {
          streamUrl: storedFileStreamUrl('downloads', file.path),
          coverSourceUrl: coverSourceByPath?.[file.path] || '',
          onRevealFile,
          bpm: bpmByPath?.[file.path] || null,
          ...(readOnly
            ? {}
            : {
                onEmbedCover,
                onSearchCover,
                onRenameFile,
                onConvertFlac,
                onMoveToPlaylist,
                movePlaylists,
                onSyncBpm,
                onUpdateBpm,
                onUpdateMetadata,
                onSearchMetadata,
                onDelete: async (path) => {
                  if (await confirm(`¿Borrar ${path}?`, { title: 'Borrar archivo', confirmLabel: 'Borrar' })) onDeleteFile(path, 'downloads')
                },
              }),
        }
        return (
          <LibraryTrackRow
            key={file.path}
            file={file}
            coverUrl={coverUrlFor ? coverUrlFor(file.path) : coverByPath?.[file.path] || ''}
            metadata={metadataByPath?.[file.path] || {}}
            dragDir={readOnly ? undefined : 'downloads'}
            formatSize={formatSize}
            cardProps={cardProps}
            sourceId={sourceId}
            playlistName={folderPath || ROOT_PLAYLIST}
          />
        )
      })}
    </div>
  )

  return (
    <div className={level > 0 ? 'space-y-3' : `grid items-start gap-y-4 gap-x-10 xl:gap-x-14 ${COLUMN_CLASSES[columns] || COLUMN_CLASSES[4]}`}>
      {level === 0 && files.length > 0 && (
        <section className="min-w-0 overflow-clip rounded-xl border border-[#2C303D] bg-[#161822]">
          <div className="flex h-[4.5rem] items-center gap-3 border-b border-[#2C303D] px-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2C303D] text-[#8D93A6]" aria-hidden="true">
              <Inbox size={19} strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold text-[#E9EAF0]">Sin playlist</h3>
              <p className="text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
                {files.length} {files.length === 1 ? 'canción' : 'canciones'} sueltas
              </p>
            </div>
          </div>
          <div className="overflow-y-auto bg-[#0F1117] p-3" style={columnBodyStyle}>{renderFiles()}</div>
        </section>
      )}

      {folders.map(([name, folder]) => {
        const sourceFolder = fullNode.folders[name] || folder
        const stats = getFolderStats(sourceFolder)
        const destinationFolder = folderPath ? `${folderPath}/${name}` : name
        const isDropTarget = !readOnly && dragOverFolder === destinationFolder
        const isEmpty = Object.keys(folder.folders).length === 0 && folder.files.length === 0
        const canDeleteFolder = !readOnly && isEmpty && Boolean(onDeleteFolder)
        return (
          <details
            key={name}
            open={level === 0}
            onDragEnter={(event) => {
              if (readOnly || !isLibraryFileDrag(event)) return
              event.preventDefault()
              event.stopPropagation()
              onDragOverFolder(destinationFolder)
            }}
            onDragOver={(event) => {
              if (readOnly || !isLibraryFileDrag(event)) return
              event.preventDefault()
              event.stopPropagation()
              event.dataTransfer.dropEffect = 'move'
              onDragOverFolder(destinationFolder)
            }}
            onDragLeave={(event) => {
              if (readOnly) return
              event.stopPropagation()
              if (!event.currentTarget.contains(event.relatedTarget)) {
                onDragOverFolder(null)
              }
            }}
            onDrop={(event) => {
              if (readOnly) return
              event.preventDefault()
              event.stopPropagation()
              onDragOverFolder(null)
              try {
                const source = JSON.parse(event.dataTransfer.getData(FILE_DRAG_TYPE))
                if (source?.path) onMoveFile(source, destinationFolder)
              } catch {}
            }}
            className={`group/folder min-w-0 overflow-clip rounded-xl border bg-[#161822] transition-[border-color,background-color,box-shadow] duration-150 ${isDropTarget ? 'border-[#7FD8CC] bg-[#7FD8CC]/10 shadow-[0_0_0_2px_rgba(127,216,204,0.25)]' : 'border-[#2C303D]'}`}
          >
            <summary className="flex h-[4.5rem] cursor-pointer list-none items-center gap-3 bg-[#161822] px-4 text-[#E9EAF0] transition-colors hover:bg-[#1A1D28] group-open/folder:border-b group-open/folder:border-[#2C303D] [&::-webkit-details-marker]:hidden">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2C303D] text-[#7FD8CC]" aria-hidden="true">
                <Folder size={19} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold leading-snug" title={name}>{name}</span>
                <span className="block text-xs text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>
                  {stats.files} {stats.files === 1 ? 'canción' : 'canciones'} · {formatSize(stats.size)}
                </span>
              </span>
              {isDropTarget && (
                <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#7FD8CC] px-2.5 py-1 text-xs font-semibold text-[#10121A]">
                  <FolderInput size={13} /> Soltar
                </span>
              )}
              {canDeleteFolder && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    onDeleteFolder(destinationFolder)
                  }}
                  title="Eliminar playlist vacía"
                  aria-label={`Eliminar la playlist vacía ${name}`}
                  className="btn-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-lg !p-0 text-[#8D93A6] transition-colors hover:!bg-red-400/10 hover:text-red-300"
                >
                  <Trash2 size={17} />
                </button>
              )}
              <ChevronDown size={18} className="shrink-0 text-[#8D93A6] transition-transform duration-150 group-open/folder:rotate-180" aria-hidden="true" />
            </summary>
            <div
              className={`relative bg-[#0F1117] p-3 ${level === 0 ? 'overflow-y-auto' : ''}`}
              style={level === 0 ? columnBodyStyle : undefined}
            >
              {isDropTarget && (
                <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-[#7FD8CC]/70 bg-[#7FD8CC]/10 text-sm font-medium text-[#7FD8CC]">
                  Suelta aquí para mover a «{name}»
                </div>
              )}
              {isEmpty ? (
                <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
                  <p className="text-sm text-[#8D93A6]">Esta playlist no tiene canciones.</p>
                  {canDeleteFolder && (
                    <button
                      type="button"
                      onClick={() => onDeleteFolder(destinationFolder)}
                      className="flex items-center gap-2 rounded-lg border border-[#2C303D] px-4 py-2.5 text-sm text-[#E9EAF0] transition-colors hover:border-red-400/60 hover:text-red-300"
                    >
                      <Trash2 size={15} />
                      Eliminar playlist
                    </button>
                  )}
                </div>
              ) : (
              <LibraryTree
                node={folder}
                level={level + 1}
                fullNode={sourceFolder}
                folderPath={destinationFolder}
                columns={columns}
                readOnly={readOnly}
                sourceId={sourceId}
                onDeleteFolder={onDeleteFolder}
                coverUrlFor={coverUrlFor}
                dragOverFolder={dragOverFolder}
                onDragOverFolder={onDragOverFolder}
                onMoveFile={onMoveFile}
                storedFileStreamUrl={storedFileStreamUrl}
                onDeleteFile={onDeleteFile}
                coverByPath={coverByPath}
                coverSourceByPath={coverSourceByPath}
                onEmbedCover={onEmbedCover}
                onSearchCover={onSearchCover}
                onRenameFile={onRenameFile}
                onConvertFlac={onConvertFlac}
                onMoveToPlaylist={onMoveToPlaylist}
                movePlaylists={movePlaylists}
                onRevealFile={onRevealFile}
                bpmByPath={bpmByPath}
                onSyncBpm={onSyncBpm}
                onUpdateBpm={onUpdateBpm}
                metadataByPath={metadataByPath}
                onUpdateMetadata={onUpdateMetadata}
                onSearchMetadata={onSearchMetadata}
              />
              )}
            </div>
          </details>
        )
      })}

      {level > 0 && files.length > 0 && renderFiles()}
    </div>
  )
}
