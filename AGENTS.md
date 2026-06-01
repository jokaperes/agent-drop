# AGENTS.md — Claude Drop

Guidance for AI agents working in this repo (and the human reading over their
shoulder). Keep this file accurate when behavior changes.

## What this is

A TanStack Start (React 19 + Nitro) + shadcn web app that exchanges files between
a phone browser and an assistant that lives on the same machine, over a private
network. Two folders on disk are the whole "database":

- `$DROPBOX_DIR/in/`  — the human uploads here; **the assistant reads these**.
- `$DROPBOX_DIR/out/` — **the assistant writes here**; the human views/downloads
  them in the app and gets an ntfy push.

`DROPBOX_DIR` defaults to `/root/claude-dropbox`.

## How an assistant actually uses it

- **Receive a file from the user:** they upload in the app → read it straight from
  `$DROPBOX_DIR/in/`. No tool plumbing, no token cost.
- **Send a file to the user:** run `cdrop <file> ["caption"]`. It copies the file
  into `out/` (collision-suffixed) and the notify watcher pushes it to the phone.
  Writing directly into `out/` works too — the watcher catches it either way.

## Layout

```
src/
  server/storage.ts        Core: list/save/delete/stream, name sanitizing, MIME/kind
  routes/api/              Server routes (Web Request/Response):
    files.ts                 GET  /api/files?box=in|out
    upload.ts                POST /api/upload (multipart)
    text.ts                  POST /api/text (paste → .md in in/)
    file/$box/$name.ts       GET (inline, ?dl=1 download) + DELETE
  routes/index.tsx         UI: Tabs — "From Claude" (default) + "Send to Claude"
  routes/__root.tsx        Shell (dark theme, Toaster)
  components/              uploader, file-grid, file-viewer, ui/* (shadcn)
  lib/api.ts               Client API + usePoll hook (polls + refetch on focus)
  lib/format.ts            formatBytes, timeAgo
scripts/
  watch-outbox.mjs         fs.watch on out/ → ntfy push (stdlib only)
  cdrop                    CLI: copy a file into out/ + caption sidecar
deploy/                    Sanitized systemd units + nginx snippet (examples)
```

## Conventions & gotchas

- **Import alias:** `#/*` → `./src/*` (defined in `package.json` `imports`).
- **Server routes** use `createFileRoute('/api/x')({ server: { handlers: {
  GET/POST/DELETE } } })` with raw Web `Request`/`Response` — needed for multipart
  and binary streaming. Dynamic segments are `$name` filenames.
- **ntfy + UTF-8:** put message text in the POST **body**, never an HTTP header —
  headers are latin1-only and emoji/accents throw. Only ASCII metadata goes in
  headers (`Title`, `Tags`, `Click`, `Actions`).
- **Filename safety:** all paths go through `safeName` + `resolveInBox` in
  `storage.ts` (strips control chars, leading dots, path separators; verifies the
  resolved path stays inside the box). Don't bypass these.
- **Caption sidecars:** `cdrop` writes a hidden `.{name}.caption`; the watcher
  reads+deletes it, and `deleteFile` cleans it up. They're hidden from listings.
- **No auth by design.** This app must stay behind a private network boundary
  (Tailscale/VPN/LAN). Never add a public route or expose it to the internet.

## Build / run

```bash
pnpm install
pnpm build                              # → .output/server/index.mjs
HOST=127.0.0.1 PORT=3010 node .output/server/index.mjs
```

In the reference deployment it runs as `claude-drop.service` (web app) +
`claude-drop-notify.service` (outbox watcher). **Rebuild after changes:**

```bash
pnpm build && systemctl restart claude-drop
```

## Secrets

`ntfy.env` is gitignored — it holds the real ntfy topic, which is effectively a
shared push secret. Only `ntfy.env.example` is committed. Never print the real
topic into logs, commits, or docs.
