# AGENTS.md

Guidance for any AI coding/agent tool working in this repo (Claude Code, Cursor,
Codex, Aider, Copilot agents, etc.), and for the human reading along. This file is
tool-neutral — there's nothing tool-specific about how the app works. Keep it
accurate when behavior changes.

## What this project is

**Agent Drop** is a TanStack Start (React 19 + Nitro) + shadcn web app that moves
files between a phone browser and an *assistant that runs on the same machine*,
over a private network. the "agent" is whatever assistant you run; any assistant or human with
filesystem access works the same way.

Two folders on disk are the entire data model:

- `$DROPBOX_DIR/in/`  — the human uploads here; **the assistant reads these**.
- `$DROPBOX_DIR/out/` — **the assistant writes here**; the human views/downloads
  them in the app and gets an ntfy push.

`DROPBOX_DIR` defaults to `/var/lib/agent-drop`.

## How an assistant uses it at runtime

You don't need any special tool integration — it's just files:

- **Receive a file from the user:** they upload it in the app → read it straight
  from `$DROPBOX_DIR/in/`. No token cost, no size limit beyond disk.
- **Send a file to the user:** run `agentdrop <file> ["caption"]`. It copies the file
  into `out/` (collision-suffixed) and the watcher pushes a notification to the
  phone. Writing a file directly into `out/` works too — the watcher catches it
  either way.

## Repo layout

```
src/
  server/storage.ts        Core: list/save/delete/stream, name sanitizing, MIME/kind
  routes/api/              Server routes (Web Request/Response):
    files.ts                 GET  /api/files?box=in|out
    upload.ts                POST /api/upload (multipart, multi-file)
    text.ts                  POST /api/text (paste → timestamped .md in in/)
    file/$box/$name.ts       GET (inline, ?dl=1 download) + DELETE
  routes/index.tsx         UI: Tabs — "From Agent" (default) + "Send to Agent"
  routes/__root.tsx        App shell (dark theme, Toaster)
  components/              uploader, file-grid, file-viewer, ui/* (shadcn)
  lib/api.ts               Client API + usePoll hook (polls + refetch on focus)
  lib/format.ts            formatBytes, timeAgo
scripts/
  watch-outbox.mjs         fs.watch on out/ → ntfy push (Node stdlib only)
  agentdrop                    CLI: copy a file into out/ + write caption sidecar
deploy/                    Sanitized systemd units + nginx snippet (examples)
```

## Conventions & gotchas

- **Import alias:** `#/*` → `./src/*` (defined in `package.json` `imports`), not a
  tsconfig path. Use `#/lib/api`, `#/components/...`, etc.
- **Server routes** use `createFileRoute('/api/x')({ server: { handlers: {
  GET/POST/DELETE } } })` with raw Web `Request`/`Response` — required for
  multipart and binary streaming. Dynamic segments are `$name` filenames.
- **ntfy + UTF-8:** put the message text in the POST **body**, never an HTTP
  header — headers are latin1-only and emoji/accents throw. Only ASCII metadata
  goes in headers (`Title`, `Tags`, `Click`, `Actions`).
- **Filename safety:** every path goes through `safeName` + `resolveInBox` in
  `storage.ts` (strips control chars, leading dots, path separators; verifies the
  resolved path stays inside the box). Don't bypass these when adding routes.
- **Caption sidecars:** `agentdrop` writes a hidden `.{name}.caption`; the watcher
  reads+deletes it, `deleteFile` cleans it up, and listings hide dotfiles.
- **No authentication, by design.** This app must stay behind a private network
  boundary (Tailscale/VPN/LAN) — that boundary *is* the security. Never add a
  public route or instructions to expose it to the internet.

## Build & run

```bash
pnpm install
pnpm dev                                 # local dev
pnpm build                               # → .output/server/index.mjs
HOST=127.0.0.1 PORT=3010 node .output/server/index.mjs   # production
```

Reference deployment runs two systemd services — `agent-drop.service` (web app)
and `agent-drop-notify.service` (outbox watcher). After code changes:

```bash
pnpm build && systemctl restart agent-drop
```

See [`deploy/`](deploy/) for sanitized unit files and an nginx vhost example.

## Secrets — do not commit

`ntfy.env` is **gitignored**: it holds the real ntfy topic, which is effectively a
shared push secret (anyone who knows it can publish to and read the
notifications). Only `ntfy.env.example` is committed. Never print the real topic
into logs, commits, or docs, and never `git add -f ntfy.env`.
