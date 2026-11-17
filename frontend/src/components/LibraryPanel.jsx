import { Clock3, DownloadCloud, FolderOpen, FolderPlus, LoaderCircle, RefreshCw, Search, Undo2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { requestJson } from '../api/client'
import LibraryTree from './LibraryTree'
import TemporalesPanel from './TemporalesPanel'
import TransfersPanel from './TransfersPanel'
import { buildPlaylists } from '../player/buildPlaylists'
import { usePlayerState } from '../player/usePlayer'
import { FONT_MONO, buildFolderTree } from '../constants'

const COLUMNS_KEY = 'soulseek.library.columns'
const COLUMN_OPTIONS = [1, 2, 3, 4]

function readColumns() {
  try {
    const value = Number(window.localStorage.getItem(COLUMNS_KEY))
    return COLUMN_OPTIONS.includes(value) ? value : 4
  } catch {
    return 4
  }
}

function ColumnIcon({ count }) {
  return (
    <span className="flex h-4 items-stretch gap-[2px]" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="w-[3px] rounded-[1px] bg-current" />
      ))}
    </span>
  )
}

export default function LibraryPanel({
  newLibraryFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onDeleteFolder,
  config,
  onRefresh,
  diagnostics,
  libraryFiles,
  libraryFolders,
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
  dragOverFolder,
  onDragOverFolder,
  onMoveFile,
  storedFileStreamUrl,
  onDeleteFile,
  transfersProps,
  temporalesProps,
}) {
  const [librarySearch, setLibrarySearch] = useState('')
  const [trayOpen, setTrayOpen] = useState(null) // 'temporales' | 'descargas' | null
  const trayRef = useRef(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [columns, setColumnsState] = useState(readColumns)

  // Vista de otra carpeta: solo lectura, no toca la biblioteca principal ni la base de datos.
  const [rootDraft, setRootDraft] = useState('')
  const [rootPickerOpen, setRootPickerOpen] = useState(false)
  const [external, setExternal] = useState(null) // { root, files, folders, truncated }
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  // Cerrar la bandeja al hacer clic fuera o con Escape (no al arrastrar: debe seguir abierta).
  useEffect(() => {
    if (!trayOpen) return undefined
    const onPointerDown = (event) => {
      if (trayRef.current && !trayRef.current.contains(event.target)) setTrayOpen(null)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setTrayOpen(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [trayOpen])

  const tempCount = temporalesProps?.previewFiles?.length || 0
  const transferCount = transfersProps?.activeTransfers?.length || 0

  const setColumns = (value) => {
    setColumnsState(value)
    try {
      window.localStorage.setItem(COLUMNS_KEY, String(value))
    } catch {
      // sin almacenamiento: la preferencia solo dura esta sesión
    }
  }

  const isExternal = Boolean(external)
  const sourceFiles = isExternal ? external.files : libraryFiles
  const sourceFolders = isExternal ? external.folders : libraryFolders

  const normalizedSearch = librarySearch.trim().toLowerCase()
  const filteredFiles = useMemo(() => normalizedSearch
    ? sourceFiles.filter((file) => file.path.toLowerCase().includes(normalizedSearch))
    : sourceFiles, [sourceFiles, normalizedSearch])
  const filteredFolders = useMemo(() => normalizedSearch
    ? sourceFolders.filter((folder) => folder.toLowerCase().includes(normalizedSearch))
    : sourceFolders, [sourceFolders, normalizedSearch])
  const tree = useMemo(() => buildFolderTree(filteredFiles, filteredFolders), [filteredFiles, filteredFolders])

  async function scanRoot(event) {
    event?.preventDefault()
    const root = rootDraft.trim()
    if (!root) return
    setScanning(true)
    setScanError('')
    try {
      const data = await requestJson('/api/library/external/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root }),
      })
      setExternal({ root: data.root, files: data.files, folders: data.folders, truncated: data.truncated })
      setRootPickerOpen(false)
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  function backToMainLibrary() {
    setExternal(null)
    setScanError('')
  }

  const externalStreamUrl = (_dir, path) =>
    `/api/library/external/stream?root=${encodeURIComponent(external.root)}&path=${encodeURIComponent(path)}`
  const externalCoverUrl = (path) =>
    `/api/library/external/cover?root=${encodeURIComponent(external.root)}&path=${encodeURIComponent(path)}`

  // Playlists para el reproductor global (sin filtrar por la búsqueda de la biblioteca).
  const { actions: playerActions } = usePlayerState()
  const sourceId = isExternal ? `external:${external.root}` : 'library'
  const externalRoot = isExternal ? external.root : ''
  // Reproductor: permite soltar canciones en sus playlists sin salir de él.
  useEffect(() => {
    if (!isExternal) playerActions.registerMover(sourceId, onMoveFile)
  }, [playerActions, sourceId, isExternal, onMoveFile])

  const playerPlaylists = useMemo(() => buildPlaylists(
    buildFolderTree(sourceFiles, sourceFolders),
    {
      streamUrlFor: (path) => (externalRoot
        ? `/api/library/external/stream?root=${encodeURIComponent(externalRoot)}&path=${encodeURIComponent(path)}`
        : `/api/file/stream?dir=downloads&path=${encodeURIComponent(path)}`),
      coverUrlFor: (path) => (externalRoot
        ? `/api/library/external/cover?root=${encodeURIComponent(externalRoot)}&path=${encodeURIComponent(path)}`
        : coverByPath?.[path] || ''),
      metadataFor: (path) => (externalRoot ? undefined : metadataByPath?.[path]),
    },
  ), [sourceFiles, sourceFolders, externalRoot, coverByPath, metadataByPath])

  // Solo se registra si el contenido cambió de verdad (el sondeo renueva las listas
  // aunque no haya cambios, y cada registro redibuja a los consumidores del reproductor).
  const playerSignature = useMemo(
    () => `${sourceId}|${playerPlaylists.map((entry) => (
      `${entry.name}\u0001${entry.items.map((song) => `${song.path}\u0002${song.title}\u0002${song.artist}\u0002${song.coverUrl}`).join('\u0003')}`
    )).join('\u0004')}`,
    [sourceId, playerPlaylists],
  )
  const registeredSignature = useRef('')
  useEffect(() => {
    if (registeredSignature.current === playerSignature) return
    registeredSignature.current = playerSignature
    playerActions.registerSource(sourceId, playerPlaylists)
  }, [playerActions, sourceId, playerPlaylists, playerSignature])

  const currentRoot = isExternal ? external.root : config.downloads_dir
  const hasContent = filteredFiles.length > 0 || filteredFolders.length > 0

  return (
    <div className="w-full min-w-0">
      {/* Cabecera del organizador */}
      <div className="mb-4 rounded-xl border border-[#2C303D] bg-[#161822] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-[#E9EAF0]">Biblioteca</h2>
            <p className="mt-0.5 max-w-xl truncate text-xs text-[#8D93A6]" title={currentRoot} style={{ fontFamily: FONT_MONO }}>
              {currentRoot || 'sin configurar'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {transfersProps && temporalesProps && (
              <div ref={trayRef} className="relative flex items-center gap-2">
                {[
                  ['temporales', 'Temporales', Clock3, tempCount],
                  ['descargas', 'Descargas', DownloadCloud, transferCount],
                ].map(([id, label, Icon, count]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTrayOpen((current) => (current === id ? null : id))}
                    aria-expanded={trayOpen === id}
                    title={id === 'temporales' ? 'Archivos temporales para guardar en una playlist' : 'Descargas en curso y en cola'}
                    className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                      trayOpen === id
                        ? '!border-[#7FD8CC]/60 !bg-[#2C303D] text-[#E9EAF0]'
                        : 'border-[#2C303D] text-[#8D93A6] hover:bg-[#2C303D] hover:text-[#E9EAF0]'
                    }`}
                  >
                    <Icon size={16} className={count > 0 ? 'text-[#7FD8CC]' : ''} />
                    {label}
                    <span
                      className={`rounded-full border px-2 py-px text-xs ${count > 0 ? 'border-[#7FD8CC]/50 text-[#7FD8CC]' : 'border-[#3A3F4E] text-[#565C6E]'}`}
                      style={{ fontFamily: FONT_MONO }}
                    >
                      {count}
                    </span>
                  </button>
                ))}

                {trayOpen && (
                  <div
                    role="dialog"
                    aria-label={trayOpen === 'temporales' ? 'Temporales' : 'Descargas'}
                    className="absolute right-0 top-full z-30 mt-2 max-h-[min(70vh,640px)] w-[min(94vw,440px)] overflow-y-auto rounded-2xl border border-[#343949] bg-[#161822] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.55)]"
                  >
                    <h3 className="mb-3 text-sm font-semibold text-[#E9EAF0]">
                      {trayOpen === 'temporales' ? 'Temporales' : 'Descargas en curso y en cola'}
                    </h3>
                    {trayOpen === 'temporales'
                      ? <TemporalesPanel {...temporalesProps} embedded />
                      : <TransfersPanel {...transfersProps} embedded />}
                  </div>
                )}
              </div>
            )}
            <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[#2C303D] bg-[#0F1117] px-3.5 py-2.5 transition-colors focus-within:border-[#7FD8CC]/70">
              <Search size={15} className="shrink-0 text-[#565C6E]" />
              <input
                type="search"
                value={librarySearch}
                onChange={(event) => setLibrarySearch(event.target.value)}
                placeholder="Buscar en la biblioteca"
                aria-label="Buscar en la biblioteca local"
                className="input-bare w-44 min-w-0 bg-transparent text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none sm:w-56"
              />
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-[#2C303D] bg-[#0F1117] p-1" role="group" aria-label="Número de columnas">
              {COLUMN_OPTIONS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setColumns(count)}
                  aria-pressed={columns === count}
                  title={`${count} ${count === 1 ? 'columna' : 'columnas'}`}
                  className={`flex h-8 min-h-0 w-9 items-center justify-center rounded-lg !p-0 transition-colors ${
                    columns === count ? '!bg-[#2C303D] text-[#7FD8CC]' : 'text-[#8D93A6] hover:text-[#E9EAF0]'
                  }`}
                >
                  <ColumnIcon count={count} />
                </button>
              ))}
            </div>

            {!isExternal && (
              <button
                type="button"
                onClick={() => setNewFolderOpen((open) => !open)}
                className="flex items-center gap-2 rounded-lg border border-[#2C303D] px-4 py-2.5 text-sm text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
              >
                <FolderPlus size={16} />
                Nueva playlist
              </button>
            )}
            <button
              type="button"
              onClick={isExternal ? scanRoot : onRefresh}
              title="Actualizar"
              aria-label="Actualizar biblioteca"
              className="flex items-center gap-2 rounded-lg border border-[#2C303D] px-4 py-2.5 text-sm text-[#8D93A6] transition-colors hover:bg-[#2C303D] hover:text-[#E9EAF0]"
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Qué carpeta se está viendo */}
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#2C303D] pt-4">
          {isExternal ? (
            <>
              <span className="flex min-w-0 items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3.5 py-2 text-sm text-amber-100">
                <FolderOpen size={15} className="shrink-0" />
                <span className="font-medium">Solo lectura</span>
                <span className="truncate text-amber-100/80" title={external.root}>· {external.root}</span>
              </span>
              <button
                type="button"
                onClick={backToMainLibrary}
                className="flex items-center gap-2 rounded-lg bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0]"
              >
                <Undo2 size={15} />
                Volver a la biblioteca principal
              </button>
              <span className="text-xs text-[#8D93A6]">No se modifica ningún archivo ni la base de datos.</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-2 text-sm text-[#8D93A6]">
                <FolderOpen size={15} /> Viendo la biblioteca principal
              </span>
              <button
                type="button"
                onClick={() => setRootPickerOpen((open) => !open)}
                aria-expanded={rootPickerOpen}
                className="rounded-lg border border-[#2C303D] px-4 py-2 text-sm text-[#E9EAF0] transition-colors hover:bg-[#2C303D]"
              >
                Ver otra carpeta…
              </button>
            </>
          )}
        </div>

        {rootPickerOpen && !isExternal && (
          <form onSubmit={scanRoot} className="mt-3 rounded-xl border border-[#2C303D] bg-[#0F1117] p-4">
            <label htmlFor="external-root" className="text-sm font-medium text-[#E9EAF0]">Ruta de la carpeta</label>
            <p className="mt-0.5 text-xs text-[#8D93A6]">
              Pega la ruta completa (p. ej. <span style={{ fontFamily: FONT_MONO }}>D:\Música\DJ</span>). Se mostrará como solo lectura: puedes recorrerla y escuchar, pero no se cambia nada.
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <input
                id="external-root"
                autoFocus
                value={rootDraft}
                onChange={(event) => setRootDraft(event.target.value)}
                placeholder="C:\ruta\a\mi\musica"
                className="min-w-0 flex-1 rounded-lg border border-[#2C303D] bg-[#161822] px-3.5 py-3 text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none focus:border-[#7FD8CC]/70"
                style={{ fontFamily: FONT_MONO }}
              />
              <button
                type="submit"
                disabled={scanning || !rootDraft.trim()}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#FFFFFF] px-5 py-3 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning && <LoaderCircle size={15} className="animate-spin" />}
                {scanning ? 'Leyendo…' : 'Ver carpeta'}
              </button>
            </div>
            {scanError && <p className="mt-3 text-sm text-red-300">{scanError}</p>}
          </form>
        )}

        {newFolderOpen && !isExternal && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#2C303D] bg-[#0F1117] p-4">
            <input
              autoFocus
              value={newLibraryFolderName}
              onChange={(event) => onNewFolderNameChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onCreateFolder()
                  setNewFolderOpen(false)
                }
              }}
              placeholder="Nombre de la nueva playlist"
              className="min-w-0 flex-1 rounded-lg border border-[#2C303D] bg-[#161822] px-3.5 py-3 text-sm text-[#E9EAF0] placeholder-[#565C6E] outline-none focus:border-[#7FD8CC]/70"
            />
            <button
              type="button"
              onClick={() => {
                onCreateFolder()
                setNewFolderOpen(false)
              }}
              disabled={!newLibraryFolderName.trim()}
              className="rounded-lg bg-[#FFFFFF] px-5 py-3 text-sm font-medium text-[#161822] transition-colors hover:bg-[#E9EAF0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Crear
            </button>
            <button type="button" onClick={() => setNewFolderOpen(false)} className="text-sm text-[#8D93A6] hover:text-[#E9EAF0]">
              Cancelar
            </button>
          </div>
        )}

        {isExternal && external.truncated && (
          <p className="mt-3 text-xs text-amber-200">La carpeta tiene demasiados archivos: se muestran solo los primeros 20&nbsp;000.</p>
        )}
      </div>

      {/* Columnas de playlists */}
      <div
        onDragOver={(event) => { if (!isExternal) event.preventDefault() }}
        onDragLeave={(event) => {
          if (isExternal) return
          if (!event.currentTarget.contains(event.relatedTarget)) onDragOverFolder(null)
        }}
        onDrop={(event) => {
          if (isExternal) return
          event.preventDefault()
          onDragOverFolder(null)
          try {
            const source = JSON.parse(event.dataTransfer.getData('application/x-soulseek-file'))
            if (source?.path) onMoveFile(source, '')
          } catch {}
        }}
      >
        {!diagnostics && !isExternal ? (
          <p className="text-sm text-[#8D93A6]" style={{ fontFamily: FONT_MONO }}>cargando…</p>
        ) : hasContent ? (
          <LibraryTree
            node={tree}
            fullNode={tree}
            columns={columns}
            readOnly={isExternal}
            sourceId={sourceId}
            onDeleteFolder={onDeleteFolder}
            coverUrlFor={isExternal ? externalCoverUrl : undefined}
            dragOverFolder={dragOverFolder}
            onDragOverFolder={onDragOverFolder}
            onMoveFile={onMoveFile}
            storedFileStreamUrl={isExternal ? externalStreamUrl : storedFileStreamUrl}
            onDeleteFile={onDeleteFile}
            coverByPath={coverByPath}
            coverSourceByPath={isExternal ? undefined : coverSourceByPath}
            onEmbedCover={onEmbedCover}
            onSearchCover={onSearchCover}
            onRenameFile={onRenameFile}
            onConvertFlac={onConvertFlac}
            onMoveToPlaylist={onMoveToPlaylist}
            movePlaylists={movePlaylists}
            onRevealFile={isExternal ? undefined : onRevealFile}
            bpmByPath={isExternal ? undefined : bpmByPath}
            onSyncBpm={onSyncBpm}
            onUpdateBpm={onUpdateBpm}
            metadataByPath={isExternal ? undefined : metadataByPath}
            onUpdateMetadata={onUpdateMetadata}
            onSearchMetadata={onSearchMetadata}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-[#2C303D] px-4 py-10 text-center text-sm text-[#8D93A6]">
            {normalizedSearch ? 'No se encontraron archivos.' : isExternal ? 'La carpeta no contiene audio.' : 'La biblioteca está vacía.'}
          </p>
        )}
      </div>
    </div>
  )
}
