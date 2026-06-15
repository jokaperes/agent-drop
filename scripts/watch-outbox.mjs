#!/usr/bin/env node
// Watches the outbox and sends an ntfy push whenever the agent drops a new file
// (whether via the `agentdrop` helper or written directly). Stdlib only.
import { watch, promises as fs } from 'node:fs'
import path from 'node:path'

const ROOT = process.env.DROPBOX_DIR ?? '/var/lib/agent-drop'
const OUT = path.join(ROOT, 'out')
const NTFY_URL = (process.env.NTFY_URL ?? 'https://ntfy.sh').replace(/\/+$/, '')
const TOPIC = process.env.NTFY_TOPIC ?? ''
const TOKEN = process.env.NTFY_TOKEN ?? ''
const DROP_URL = process.env.DROP_URL ?? 'http://drop.home'

const seen = new Set()
const timers = new Map()

function captionPath(name) {
  return path.join(OUT, `.${name}.caption`)
}

async function readCaption(name) {
  try {
    const c = (await fs.readFile(captionPath(name), 'utf8')).trim()
    await fs.unlink(captionPath(name)).catch(() => {})
    return c
  } catch {
    return ''
  }
}

async function notify(name) {
  if (!TOPIC) return
  const caption = await readCaption(name)
  // The message goes in the BODY (UTF-8 safe — emoji/accents OK). HTTP headers
  // are latin1-only, so only plain-ASCII metadata lives in headers here.
  const body = caption ? `${caption}\n${name}` : name
  const headers = {
    'Content-Type': 'text/plain; charset=utf-8',
    Title: 'Your agent sent you a file',
    Tags: 'inbox_tray',
    Click: DROP_URL,
    Actions: `view, Open Agent Drop, ${DROP_URL}`,
  }
  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`
  try {
    await fetch(`${NTFY_URL}/${TOPIC}`, { method: 'POST', headers, body })
    console.log(`[notify] ${name}${caption ? ` — ${caption}` : ''}`)
  } catch (err) {
    console.warn(`[notify] failed for ${name}: ${err}`)
  }
}

async function consider(name) {
  if (!name || name.startsWith('.')) return // ignore caption sidecars / dotfiles
  if (seen.has(name)) return
  let st
  try {
    st = await fs.stat(path.join(OUT, name))
  } catch {
    return // vanished
  }
  if (!st.isFile()) return
  seen.add(name)
  await notify(name)
}

// Debounce per filename: file writes fire many events; wait for quiet.
function schedule(name) {
  if (!name) return
  clearTimeout(timers.get(name))
  timers.set(
    name,
    setTimeout(() => {
      timers.delete(name)
      consider(name).catch((e) => console.warn(e))
    }, 600),
  )
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  // Seed `seen` with existing files so we don't notify for the backlog on boot.
  for (const n of await fs.readdir(OUT)) if (!n.startsWith('.')) seen.add(n)
  console.log(`[watch] outbox=${OUT} topic=${TOPIC || '(unset → notifications off)'}`)

  watch(OUT, (_event, filename) => {
    if (filename) schedule(filename.toString())
  })

  // Safety net: fs.watch can miss events; reconcile every 10s.
  setInterval(async () => {
    try {
      for (const n of await fs.readdir(OUT)) if (!seen.has(n)) schedule(n)
      // forget deleted files so re-adding the same name notifies again
      const current = new Set(await fs.readdir(OUT))
      for (const n of seen) if (!current.has(n)) seen.delete(n)
    } catch {
      /* ignore */
    }
  }, 10_000)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
