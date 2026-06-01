import { useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { ScrollArea } from '#/components/ui/scroll-area'
import { fileUrl, type FileEntry, type Box } from '#/lib/api'
import { formatBytes } from '#/lib/format'

function TextPreview({ url }: { url: string }) {
  const [body, setBody] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(url, { cache: 'no-store' })
      .then((r) => r.text())
      .then((t) => alive && setBody(t.slice(0, 500_000)))
      .catch(() => alive && setErr(true))
    return () => {
      alive = false
    }
  }, [url])
  if (err) return <p className="p-4 text-sm text-muted-foreground">Could not load text.</p>
  if (body === null)
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    )
  return (
    <ScrollArea className="max-h-[60vh] w-full rounded-md border bg-muted/40">
      <pre className="p-4 text-xs leading-relaxed whitespace-pre-wrap break-words font-mono">
        {body}
      </pre>
    </ScrollArea>
  )
}

export function FileViewer({
  box,
  file,
  open,
  onOpenChange,
}: {
  box: Box
  file: FileEntry | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const url = file ? fileUrl(box, file.name) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-4 sm:max-w-3xl">
        {file && (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8 text-left">{file.name}</DialogTitle>
              <p className="text-left text-xs text-muted-foreground">
                {formatBytes(file.size)} · {file.mime}
              </p>
            </DialogHeader>

            <div className="overflow-hidden rounded-lg">
              {file.kind === 'image' && (
                <img
                  src={url}
                  alt={file.name}
                  className="mx-auto max-h-[62vh] w-auto rounded-md object-contain"
                />
              )}
              {file.kind === 'pdf' && (
                <embed src={url} type="application/pdf" className="h-[70vh] w-full rounded-md" />
              )}
              {file.kind === 'video' && (
                <video src={url} controls className="max-h-[62vh] w-full rounded-md" />
              )}
              {file.kind === 'audio' && <audio src={url} controls className="w-full" />}
              {(file.kind === 'text' || file.kind === 'code') && <TextPreview url={url} />}
              {(file.kind === 'archive' || file.kind === 'other') && (
                <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No inline preview for this file type. Use download below.
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button asChild className="gap-2">
                <a href={fileUrl(box, file.name, true)} download={file.name}>
                  <Download className="size-4" />
                  Download
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
