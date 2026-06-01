import { useState } from 'react'
import { toast } from 'sonner'
import {
  FileText, FileCode, FileImage, FileArchive, Music, Video, File as FileIcon,
  Download, Trash2, Eye, Inbox, Loader2,
} from 'lucide-react'
import { cn } from '#/lib/utils'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '#/components/ui/alert-dialog'
import { FileViewer } from '#/components/file-viewer'
import {
  deleteFile, fileUrl, type Box, type FileEntry, type FileKind,
} from '#/lib/api'
import { formatBytes, timeAgo } from '#/lib/format'

const KIND_ICON: Record<FileKind, typeof FileIcon> = {
  image: FileImage, pdf: FileText, text: FileText, code: FileCode,
  audio: Music, video: Video, archive: FileArchive, other: FileIcon,
}

const KIND_TINT: Record<FileKind, string> = {
  image: 'text-emerald-400', pdf: 'text-rose-400', text: 'text-sky-400',
  code: 'text-violet-400', audio: 'text-amber-400', video: 'text-pink-400',
  archive: 'text-orange-400', other: 'text-muted-foreground',
}

function FileCard({
  box, file, onOpen, onDeleted,
}: {
  box: Box
  file: FileEntry
  onOpen: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const Icon = KIND_ICON[file.kind]

  const remove = async () => {
    setDeleting(true)
    try {
      await deleteFile(box, file.name)
      toast.success(`Deleted “${file.name}”`)
      onDeleted()
    } catch (e) {
      toast.error((e as Error).message)
      setDeleting(false)
    }
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card/50 backdrop-blur transition-colors hover:border-primary/40 hover:bg-card/80">
      <button
        type="button"
        onClick={onOpen}
        className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-muted/30"
      >
        {file.kind === 'image' ? (
          <img
            src={fileUrl(box, file.name)}
            alt={file.name}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <Icon className={cn('size-12 transition-transform group-hover:scale-110', KIND_TINT[file.kind])} />
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <button type="button" onClick={onOpen} className="text-left">
          <p className="truncate text-sm font-medium" title={file.name}>
            {file.name}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatBytes(file.size)} · {timeAgo(file.mtime)}
          </p>
        </button>

        <div className="mt-auto flex items-center justify-between pt-1">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            {file.kind}
          </Badge>
          <div className="flex items-center gap-0.5">
            <Button size="icon" variant="ghost" className="size-8" onClick={onOpen} title="View">
              <Eye className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="size-8" asChild title="Download">
              <a href={fileUrl(box, file.name, true)} download={file.name}>
                <Download className="size-4" />
              </a>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" title="Delete">
                  {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{file.name}” will be permanently removed. This can’t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={remove}
                    className="bg-destructive text-white hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </div>
  )
}

export function FileGrid({
  box, files, loading, emptyHint, onChanged,
}: {
  box: Box
  files: FileEntry[] | null
  loading: boolean
  emptyHint: string
  onChanged: () => void
}) {
  const [active, setActive] = useState<FileEntry | null>(null)
  const [open, setOpen] = useState(false)

  if (loading && !files) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
        ))}
      </div>
    )
  }

  if (!files || files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 py-16 text-center">
        <Inbox className="size-10 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {files.map((f) => (
          <FileCard
            key={f.name}
            box={box}
            file={f}
            onOpen={() => {
              setActive(f)
              setOpen(true)
            }}
            onDeleted={onChanged}
          />
        ))}
      </div>
      <FileViewer box={box} file={active} open={open} onOpenChange={setOpen} />
    </>
  )
}
