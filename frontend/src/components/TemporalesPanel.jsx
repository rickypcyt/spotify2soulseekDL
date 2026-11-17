import { Trash2 } from 'lucide-react'
import { useConfirm } from './ConfirmDialog.jsx'
import { formatSize } from '../constants'
import TempFileCard from './TempFileCard'

export default function TemporalesPanel({
  diagnostics,
  onCleanupAll,
  previewFiles = [],
  storedFileStreamUrl,
  onSaveTemporaryPreview,
  localPlaylists = [],
  onSearchCover,
  onRevealFile,
  onDeleteFile,
  embedded = false,
}) {
  const confirm = useConfirm()
  const hasFiles = previewFiles.length > 0

  if (embedded) {
    return (
      <div className="w-full min-w-0">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[#8D93A6]">Arrastra un archivo a una playlist o elige carpeta para guardarlo.</p>
          {hasFiles && (
            <button
              type="button"
              onClick={onCleanupAll}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2C303D] px-3 py-1.5 text-xs text-[#8D93A6] transition-colors hover:border-red-400/60 hover:text-red-300"
            >
              <Trash2 size={13} />
              Limpiar todo
            </button>
          )}
        </div>
        {!diagnostics ? (
          <p className="text-sm text-[#8D93A6]">Cargando…</p>
        ) : !hasFiles ? (
          <p className="rounded-lg border border-dashed border-[#2C303D] px-4 py-8 text-center text-sm text-[#8D93A6]">No hay archivos temporales.</p>
        ) : (
          <div className="space-y-3">
            {previewFiles.map((file) => (
              <TempFileCard
                key={file.path}
                file={{ ...file, name: file.path.split('/').pop() || file.path }}
                streamUrl={storedFileStreamUrl('previews', file.path)}
                coverUrl={`/api/library/cover?dir=previews&path=${encodeURIComponent(file.path)}`}
                folders={localPlaylists}
                formatSize={formatSize}
                onSave={onSaveTemporaryPreview}
                onSearchCover={onSearchCover}
                onReveal={onRevealFile}
                onDelete={async (path) => {
                  if (await confirm(`¿Borrar ${path}?`, { title: 'Borrar archivo', confirmLabel: 'Borrar' })) onDeleteFile(path, 'previews')
                }}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="flex w-full min-w-0 flex-col rounded-xl border border-[#2C303D] bg-[#161822]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2C303D] px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2.5 text-lg font-semibold text-[#E9EAF0]">
            Temporales
            {hasFiles && (
              <span className="rounded-full border border-[#3A3F4E] px-2.5 py-0.5 text-xs font-normal text-[#8D93A6]">
                {previewFiles.length}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-[#8D93A6]">
            Archivos de prueba. Elige una carpeta y guárdalos para conservarlos; los que no guardes se pueden limpiar.
          </p>
        </div>
        {hasFiles && (
          <button
            type="button"
            onClick={onCleanupAll}
            className="flex items-center gap-2 rounded-lg border border-[#2C303D] px-4 py-2.5 text-sm text-[#8D93A6] transition-colors hover:border-red-400/60 hover:text-red-300"
          >
            <Trash2 size={15} />
            Limpiar todo
          </button>
        )}
      </div>

      <div className="p-5">
        {!diagnostics ? (
          <p className="text-sm text-[#8D93A6]">Cargando…</p>
        ) : !hasFiles ? (
          <p className="rounded-lg border border-dashed border-[#2C303D] px-4 py-8 text-center text-sm text-[#8D93A6]">
            No hay archivos temporales.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            {previewFiles.map((file) => (
              <TempFileCard
                key={file.path}
                file={{ ...file, name: file.path.split('/').pop() || file.path }}
                streamUrl={storedFileStreamUrl('previews', file.path)}
                coverUrl={`/api/library/cover?dir=previews&path=${encodeURIComponent(file.path)}`}
                folders={localPlaylists}
                formatSize={formatSize}
                onSave={onSaveTemporaryPreview}
                onSearchCover={onSearchCover}
                onReveal={onRevealFile}
                onDelete={async (path) => {
                  if (await confirm(`¿Borrar ${path}?`, { title: 'Borrar archivo', confirmLabel: 'Borrar' })) onDeleteFile(path, 'previews')
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
