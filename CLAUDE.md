See [AGENTS.md](AGENTS.md) for full guidance on this repo.

Quick reminders for Claude specifically:

- **Receive files from the user:** read them from `$DROPBOX_DIR/in/`
  (default `/root/claude-dropbox/in/`).
- **Send files to the user:** `cdrop <file> ["caption"]` → lands in `out/` and
  pushes an ntfy notification to their phone.
- **No auth by design** — keep this app on a private network boundary only.
- **Rebuild after code changes:** `pnpm build && systemctl restart claude-drop`.
- `ntfy.env` is gitignored (holds a shared push secret); never commit or print it.
