# Deploying Claude Drop

Reference deployment: a Node/Nitro build behind nginx, reachable only over a
private network (Tailscale here), with split-DNS resolving the hostname.

> **Security:** Claude Drop has no authentication. The private network boundary
> *is* the security. Never expose it on a public interface.

## 1. Build

```bash
pnpm install
cp ntfy.env.example ntfy.env     # set a long, unguessable NTFY_TOPIC
pnpm build                       # → .output/server/index.mjs
```

## 2. systemd

Copy the two unit files here into `/etc/systemd/system/` (adjust the paths
inside them to where you cloned the repo), then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now claude-drop.service claude-drop-notify.service
```

## 3. Reverse proxy + DNS

Add `nginx.conf.example` as a vhost (it proxies to `127.0.0.1:3010`), `nginx -t`,
reload. Point the hostname at the machine's **private** IP via your split DNS,
e.g. dnsmasq:

```
address=/drop.home/100.64.0.0      # ← your Tailscale/VPN IP
```

## 4. Verify

```bash
systemctl status claude-drop
curl -s 'http://127.0.0.1:3010/api/files?box=out'   # → {"box":"out","files":[]}
```

Then open the hostname from a phone on the same private network.
