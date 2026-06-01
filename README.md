# Claude Drop

A tiny, polished **file-exchange web app** that bridges a terminal-only workflow
with a phone browser. If you talk to an AI assistant (or anyone) over SSH, you
can't hand it images/PDFs and you can't see the files it makes for you. Claude
Drop fixes both directions:

- **You → Claude:** upload files or paste text in the app → they land on disk in
  `in/`, where the assistant reads them straight off the filesystem.
- **Claude → you:** the assistant drops a file in `out/` → it appears in the app
  with an **inline viewer** (images, PDFs, text/code, audio, video) plus download
  and delete, and your phone gets an **ntfy push**.

Files move over the filesystem, never through the assistant's context window — so
there's **no token cost** and no size limit beyond disk + your reverse proxy's
upload cap.

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19 + Vite + Nitro SSR) —
  file-based routing and server routes for the file API.
- [shadcn/ui](https://ui.shadcn.com/) + Tailwind v4, Sonner toasts, Lucide icons.
- Runs as a self-contained Node server (Nitro `node-server` build).
- No database, no cloud — just two folders on disk.

## How it works

```
phone browser ──(private network)──> reverse proxy ──> 127.0.0.1:3010 (Nitro)
                                                              │ server routes
                                       $DROPBOX_DIR/{in,out}
   you upload / paste ───────────────────────────────────►  in/    (assistant reads)
   you view / download ◄──────────────────────────────────  out/   (assistant writes) ──► ntfy push
```

### Server routes (`src/routes/api/`)

| Method | Route | Purpose |
|--------|-------|---------|
| `GET`  | `/api/files?box=in\|out` | List a box: `{name, size, mtime, mime, kind}` |
| `POST` | `/api/upload` | Multipart multi-file upload → `in/` |
| `POST` | `/api/text` | Paste text → timestamped `.md` in `in/` |
| `GET`  | `/api/file/{box}/{name}` | Stream a file (`?dl=1` to force download) |
| `DELETE` | `/api/file/{box}/{name}` | Delete a file |

Filenames are sanitized (no path traversal, control chars stripped, leading dots
removed) and de-duplicated with a `-1`, `-2` suffix. See
[`src/server/storage.ts`](src/server/storage.ts).

### Notifications

`scripts/watch-outbox.mjs` watches `out/` (stdlib `fs.watch` + a 10s reconcile
safety net) and POSTs an [ntfy](https://ntfy.sh) push on each new file. The
message text goes in the request **body** so emoji/accents survive (HTTP headers
are latin1-only). A `cdrop <file> ["caption"]` helper copies a file into `out/`
and the caption rides along via a hidden `.{name}.caption` sidecar.

## Security model

There is **no authentication by design**. Claude Drop is meant to run on a private
network boundary — a [Tailscale](https://tailscale.com) tailnet, a VPN, or LAN —
and that boundary *is* the lock. **Do not expose it to the public internet.**

## Getting started

```bash
pnpm install
cp ntfy.env.example ntfy.env   # then edit: set a long, unguessable NTFY_TOPIC
pnpm dev                       # dev server
```

### Production

```bash
pnpm build                                   # → .output/server/index.mjs
HOST=127.0.0.1 PORT=3010 node .output/server/index.mjs
```

Put it behind a reverse proxy on your private network and run the outbox watcher
alongside it. Sanitized deployment examples (systemd units, an nginx vhost
snippet) live in [`deploy/`](deploy/).

## Configuration

All config is environment variables (see [`ntfy.env.example`](ntfy.env.example)):

| Var | Default | Meaning |
|-----|---------|---------|
| `DROPBOX_DIR` | `/root/claude-dropbox` | Root holding `in/` and `out/` |
| `HOST` / `PORT` | `127.0.0.1` / `3010` | Where the Node server binds |
| `NTFY_URL` | `https://ntfy.sh` | ntfy server |
| `NTFY_TOPIC` | — | Topic your phone subscribes to (keep it secret) |
| `NTFY_TOKEN` | — | Optional bearer token |
| `DROP_URL` | `http://drop.home` | URL put in the push so a tap opens the app |
