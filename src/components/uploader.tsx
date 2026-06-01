import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Upload, FileUp, Send, Loader2 } from 'lucide-react'
import { cn } from '#/lib/utils'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { Progress } from '#/components/ui/progress'
import { uploadFiles, postText } from '#/lib/api'

export function Uploader({ onDone }: { onDone: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [text, setText] = useState('')
  const [sendingText, setSendingText] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const send = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || busy) return
      setBusy(true)
      setPct(0)
      try {
        const saved = await uploadFiles(files, setPct)
        toast.success(
          saved.length === 1 ? `Sent “${saved[0]}”` : `Sent ${saved.length} files`,
        )
        onDone()
      } catch (e) {
        toast.error((e as Error).message)
      } finally {
        setBusy(false)
        setPct(0)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [busy, onDone],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      send(Array.from(e.dataTransfer.files))
    },
    [send],
  )

  const sendText = useCallback(async () => {
    const t = text.trim()
    if (!t || sendingText) return
    setSendingText(true)
    try {
      const name = await postText(t)
      toast.success(`Saved note “${name}”`)
      setText('')
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSendingText(false)
    }
  }, [text, sendingText, onDone])

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer select-none',
          'border-border/70 bg-card/40 hover:bg-card/70 hover:border-primary/50',
          dragging && 'border-primary bg-primary/10',
          busy && 'pointer-events-none opacity-80',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => send(Array.from(e.target.files ?? []))}
        />
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          {busy ? <Loader2 className="size-6 animate-spin" /> : <Upload className="size-6" />}
        </div>
        {busy ? (
          <div className="w-full max-w-xs space-y-2">
            <p className="text-sm text-muted-foreground">Uploading… {pct}%</p>
            <Progress value={pct} />
          </div>
        ) : (
          <>
            <div>
              <p className="font-medium">Drop files here, or tap to choose</p>
              <p className="text-sm text-muted-foreground">
                Photos, PDFs, code — anything. They land in the agent’s inbox.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-1 gap-2"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
            >
              <FileUp className="size-4" />
              Choose files
            </Button>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="…or paste text / a link to send as a note"
          rows={3}
          className="resize-y bg-card/40"
        />
        <div className="flex justify-end">
          <Button onClick={sendText} disabled={!text.trim() || sendingText} className="gap-2">
            {sendingText ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send note
          </Button>
        </div>
      </div>
    </div>
  )
}
