import { promises as fs, createReadStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

// Root of the shared dropbox. `in/` holds files the user sends to the agent,
// `out/` holds files the agent sends to the user. Overridable via env for tests.
const ROOT = process.env.DROPBOX_DIR ?? '/var/lib/agent-drop'

export type Box = 'in' | 'out'

export interface FileEntry {
  name: string
  size: number
  mtime: number // epoch ms
  mime: string
  kind: 'image' | 'pdf' | 'text' | 'code' | 'audio' | 'video' | 'archive' | 'other'
}

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
  heic: 'image/heic', ico: 'image/x-icon',
  pdf: 'application/pdf',
  txt: 'text/plain', md: 'text/markdown', markdown: 'text/markdown',
  json: 'application/json', csv: 'text/csv', xml: 'application/xml',
  yml: 'text/yaml', yaml: 'text/yaml', log: 'text/plain', env: 'text/plain',
  js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
  ts: 'text/typescript', tsx: 'text/typescript', jsx: 'text/javascript',
  py: 'text/x-python', rb: 'text/x-ruby', go: 'text/x-go', rs: 'text/x-rust',
  c: 'text/x-c', h: 'text/x-c', cpp: 'text/x-c++', java: 'text/x-java',
  sh: 'text/x-sh', bash: 'text/x-sh', sql: 'text/x-sql', toml: 'text/x-toml',
  html: 'text/html', css: 'text/css',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  flac: 'audio/flac', aac: 'audio/aac',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  zip: 'application/zip', gz: 'application/gzip', tar: 'application/x-tar',
  '7z': 'application/x-7z-compressed', rar: 'application/vnd.rar',
}

const CODE_EXT = new Set([
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'c', 'h',
  'cpp', 'java', 'sh', 'bash', 'sql', 'toml', 'html', 'css', 'json', 'xml',
  'yml', 'yaml',
])

function ext(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

export function mimeFor(name: string): string {
  return MIME[ext(name)] ?? 'application/octet-stream'
}

function kindFor(name: string): FileEntry['kind'] {
  const e = ext(name)
  const m = mimeFor(name)
  if (m.startsWith('image/')) return 'image'
  if (m === 'application/pdf') return 'pdf'
  if (m.startsWith('audio/')) return 'audio'
  if (m.startsWith('video/')) return 'video'
  if (CODE_EXT.has(e)) return 'code'
  if (m.startsWith('text/') || e === 'md' || e === 'txt' || e === 'log') return 'text'
  if (['zip', 'gz', 'tar', '7z', 'rar'].includes(e)) return 'archive'
  return 'other'
}

function assertBox(box: string): asserts box is Box {
  if (box !== 'in' && box !== 'out') throw new Error('invalid box')
}

export function boxDir(box: Box): string {
  return path.join(ROOT, box)
}

// Reduce an arbitrary client filename to a safe basename inside the box.
// Keeps spaces, hyphens and unicode; strips path separators, control chars
// and leading dots so a file can never escape the box or hide as a dotfile.
export function safeName(raw: string): string {
  const base = path.basename(raw)
  let out = ''
  for (const ch of base) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 0x20 || code === 0x7f) continue
    if (ch === '/' || ch === '\\') { out += '_'; continue }
    out += ch
  }
  out = out.replace(/^\.+/, '').trim()
  return out || `file-${Date.now()}`
}

// Resolve box/name to an absolute path, guaranteeing it stays inside the box.
export function resolveInBox(box: Box, name: string): string {
  const dir = boxDir(box)
  const full = path.resolve(dir, safeName(name))
  if (full !== dir && !full.startsWith(dir + path.sep)) throw new Error('path escape')
  return full
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true })
}

// Pick a non-colliding path: foo.png, foo-1.png, foo-2.png, ...
async function uniquePath(dir: string, name: string): Promise<string> {
  const safe = safeName(name)
  const e = ext(safe)
  const stem = e ? safe.slice(0, -(e.length + 1)) : safe
  const suffix = e ? `.${e}` : ''
  let candidate = path.join(dir, safe)
  let n = 0
  for (;;) {
    try {
      await fs.access(candidate)
      n += 1
      candidate = path.join(dir, `${stem}-${n}${suffix}`)
    } catch {
      return candidate
    }
  }
}

export async function listBox(box: string): Promise<FileEntry[]> {
  assertBox(box)
  const dir = boxDir(box)
  await ensureDir(dir)
  const names = await fs.readdir(dir)
  const entries: FileEntry[] = []
  for (const name of names) {
    if (name.startsWith('.')) continue // hide sidecars / dotfiles
    try {
      const st = await fs.stat(path.join(dir, name))
      if (!st.isFile()) continue
      entries.push({
        name,
        size: st.size,
        mtime: st.mtimeMs,
        mime: mimeFor(name),
        kind: kindFor(name),
      })
    } catch {
      /* skip vanished files */
    }
  }
  entries.sort((a, b) => b.mtime - a.mtime)
  return entries
}

export async function saveUpload(box: Box, name: string, data: Buffer): Promise<string> {
  const dir = boxDir(box)
  await ensureDir(dir)
  const dest = await uniquePath(dir, name)
  await fs.writeFile(dest, data)
  return path.basename(dest)
}

export async function saveText(box: Box, text: string, title?: string): Promise<string> {
  const dir = boxDir(box)
  await ensureDir(dir)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  let name = title ? safeName(title) : `note-${stamp}.md`
  if (!/\.[a-z0-9]+$/i.test(name)) name += '.md'
  const dest = await uniquePath(dir, name)
  await fs.writeFile(dest, text, 'utf8')
  return path.basename(dest)
}

export async function deleteFile(box: string, name: string): Promise<void> {
  assertBox(box)
  const full = resolveInBox(box, name)
  await fs.unlink(full)
  // Best-effort: drop the hidden caption sidecar a `agentdrop` may have left.
  const sidecar = path.join(path.dirname(full), `.${path.basename(full)}.caption`)
  await fs.unlink(sidecar).catch(() => {})
}

// Stream a file out as a web Response (download or inline preview).
export async function fileResponse(
  box: string,
  name: string,
  opts: { download?: boolean } = {},
): Promise<Response> {
  assertBox(box)
  const full = resolveInBox(box, name)
  const st = await fs.stat(full)
  if (!st.isFile()) throw new Error('not a file')
  const stream = Readable.toWeb(createReadStream(full)) as ReadableStream
  const disp = opts.download ? 'attachment' : 'inline'
  const encoded = encodeURIComponent(name)
  return new Response(stream, {
    headers: {
      'Content-Type': mimeFor(name),
      'Content-Length': String(st.size),
      'Content-Disposition': `${disp}; filename*=UTF-8''${encoded}`,
      'Cache-Control': 'no-store',
    },
  })
}
