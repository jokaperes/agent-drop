export type Box = 'in' | 'out'
export type FileKind =
  | 'image' | 'pdf' | 'text' | 'code' | 'audio' | 'video' | 'archive' | 'other'

export interface FileEntry {
  name: string
  size: number
  mtime: number
  mime: string
  kind: FileKind
}

export async function fetchFiles(box: Box): Promise<FileEntry[]> {
  const res = await fetch(`/api/files?box=${box}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`list failed (${res.status})`)
  const data = (await res.json()) as { files: FileEntry[] }
  return data.files
}

export function fileUrl(box: Box, name: string, download = false): string {
  const u = `/api/file/${box}/${encodeURIComponent(name)}`
  return download ? `${u}?dl=1` : u
}

export async function deleteFile(box: Box, name: string): Promise<void> {
  const res = await fetch(fileUrl(box, name), { method: 'DELETE' })
  if (!res.ok) throw new Error(`delete failed (${res.status})`)
}

export async function postText(text: string, title?: string): Promise<string> {
  const res = await fetch('/api/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, title }),
  })
  if (!res.ok) throw new Error(`save failed (${res.status})`)
  const data = (await res.json()) as { saved: string }
  return data.saved
}

// Upload with progress via XHR (fetch lacks upload progress events).
export function uploadFiles(
  files: File[],
  onProgress?: (pct: number) => void,
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const f of files) form.append('files', f, f.name)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/upload')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve((JSON.parse(xhr.responseText) as { saved: string[] }).saved)
        } catch {
          resolve([])
        }
      } else {
        reject(new Error(`upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(form)
  })
}

// Poll a fetcher on an interval; returns data, loading, error and a manual refetch.
import { useCallback, useEffect, useRef, useState } from 'react'

export function usePoll<T>(fn: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const refetch = useCallback(async () => {
    try {
      const d = await fnRef.current()
      setData(d)
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (!alive) return
      await refetch()
    }
    tick()
    const id = setInterval(tick, intervalMs)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [intervalMs, refetch])

  return { data, error, loading, refetch }
}
