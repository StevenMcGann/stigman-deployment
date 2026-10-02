# Update: Caddy 2.11.4 to 2.11.6

Tested on the twin WIN-TJ87SDPMUPH on 2026-10-02.

## What an administrator should do

Apply Caddy 2.11.6 by following guide Step 16.10 as written — it was run end to
end on the twin for the first time today and works with no surprises and no
configuration changes. Keep the old binary as `caddy-2.11.4.exe.bak` until you
have verified the site; it is the rollback.

## What changes

Security fixes in 2.11.6 that matter behind this proxy:

- `handle_path` / `uri strip_prefix` canonicalize the resulting path so it
  cannot bypass path-based authorization (we use `handle_path /branding/*`).
- `path_regexp` normalizes Windows backslashes like the `path` matcher does,
  completing the fix for CVE-2026-52844. We do not use `path_regexp`, but this
  is a Windows host, so the fix is defense in depth.
- file_server rejects Windows 8.3 short names in every path component, and
  fixes ETag collisions (we serve `C:\Services\caddy\branding`).
- reverseproxy flushes partial responses to clients; the admin API normalizes
  request paths and compares allow-lists case-insensitively (localhost:2019).
- FastCGI fixes (HTTPoxy, `SERVER_ADDR`) do not apply: no FastCGI in use.
  The `forward_auth` + `reverse_proxy` cross-connection fix (GHSA-6365-7ppr-5r92)
  does not apply: we use plain `reverse_proxy` only. SAML/identity brokering is
  not in use. Clustering is not in use.

Two new defaults apply to every request through the proxy:

- Request headers are capped at 16 KiB (before, Go's 1 MiB). Bigger → `431`.
- A request body read or response write that makes **no progress** for 60
  seconds is aborted (slowloris mitigation). A transfer that keeps making
  progress, however slowly, is left alone.

Also: Caddyfile validation is stricter (a config that started before may now
fail to start), header fields containing `.` are dropped (as `_` was in 2.11.4),
and the admin `/load` endpoint returns `400` with a valid JSON body when a
config is invalid (was `200` with concatenated JSON).

## What might break, and what the twin showed

| Concern | Tested on the twin? | Result |
|---|---|---|
| Stricter validation rejects the live Caddyfile | Yes — `caddy validate` with the new binary before the swap | `Valid configuration` (only a cosmetic `caddy fmt` warning about line 32) |
| 16 KiB header cap breaks logins | Yes — a ~20.5 KiB Cookie on the Caddy-internal `/branding/` route, before and after the update, and a real OIDC round-trip | 200 on 2.11.4 → **431** on 2.11.6 (the cap is real). The test has to use `/branding/`: the STIG Manager backend refuses headers over 16 KiB by itself on any Caddy version, so a 431 from `/` or `/api/*` says nothing about Caddy. A real access token for this realm is ~1.2 KB; token request + authenticated `/api/collections` through the proxy both work. Normal logins have ample headroom. |
| Idle timeout cuts Watcher imports | Not possible here — the Watcher never crosses Caddy. Its `.env` points at `http://localhost:54000/api` and `http://localhost:8080` | Two full Watcher imports (post + restore) completed normally. The exposure is browser/API-client uploads through the proxy (web-UI CKL/CKLB import on a slow link). |
| Idle timeout cuts stalled requests | Yes — a POST to the Keycloak token endpoint through Caddy declaring 100 body bytes, sending 20, then stalling | 2.11.4: connection still fully open past 80 s. 2.11.6: **aborted at exactly 60.0 s** (client sees 499, zero bytes). A second probe dribbling 2 bytes/second was left alone and completed at ~40 s. Stalled transfers are cut; progressing ones are not. |
| Header fields with `.` dropped | Covered by the OIDC round-trip; not separately exercised | No client traffic in this deployment uses dotted header names. |
| Admin `/load` reload (Appendix C) | Yes — with the live Caddyfile and with a deliberately invalid config | Valid → 200. Invalid → **400** (new in 2.11.6). Site kept serving 200 after both. |
| Undo (rollback to 2.11.4) | Not run — the twin is healthy on 2.11.6 and the old binary is in place | The commands below are the guide's own rollback, unexercised today. |

## Before you start

- Download `caddy_2.11.6_windows_amd64.zip` from
  https://github.com/caddyserver/caddy/releases/tag/v2.11.6 and check its
  SHA-256 against the digest shown beside the file on that page
  (`07429393375227eb669e449764c5245eaac8fc69fc68b2f867717af794cc1153`).
- Check the stack is healthy before you start:
  `Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher` —
  all Running. `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/` → 200.
- Caddy is a single binary; no database, no config changes. The old binary kept
  beside the new one is the rollback, so no backup step is needed.
- No maintenance window is required beyond a few seconds of site downtime while
  Caddy restarts.

## Procedure

Step 16.10 of the deployment guide, as run on the twin, one command at a time.

### 1. Download and verify

```powershell
$ver = '2.11.6'
$url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
(Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
```

The hash must match the digest beside the file on the release page. Then:

```powershell
Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
```

On the twin the archive extracted flat (`C:\Installers\caddy-2.11.6\caddy.exe`;
no nested folder).

### 2. Validate the live Caddyfile with the new binary, before swapping

```powershell
C:\Installers\caddy-2.11.6\caddy.exe validate --config C:\Services\caddy\Caddyfile
```

Correct result: `Valid configuration`. If it reports an error, fix the
Caddyfile first — starting the service with a config the new binary rejects
leaves the site down.

### 3. Swap the binary and start

```powershell
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.4.exe.bak
Copy-Item "C:\Installers\caddy-2.11.6\caddy.exe" C:\Services\caddy\caddy.exe -Force
Start-Service Caddy
C:\Services\caddy\caddy.exe version
```

Correct result: `v2.11.6 h1:sWxeamdlCZvcH4qeDz8bB0mdxgfYTeqV7HxOjXyIRas=`.

### 4. Confirm the site answers through the proxy

```powershell
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Correct result: `Running` and `200`.

## Check that it worked

```powershell
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/realms/stigman/.well-known/openid-configuration
```

All five services Running; both endpoints 200. Then log in through the browser
at `https://<server>/` and open a collection (Step 16.7): a login that worked
before and fails now points at the 16 KiB header cap — if you see `431`
responses, raise the cap with the `max_header_size` server option and reload
Caddy (Appendix C). If a Watcher is installed, drop a result file in its watched
folder and confirm it imports (it does not cross Caddy; this verifies the
Watcher itself).

## Undo

Not run on the twin (it is healthy on 2.11.6); the old binary is in place:

```powershell
Stop-Service Caddy
Remove-Item C:\Services\caddy\caddy.exe
Rename-Item C:\Services\caddy\caddy-2.11.4.exe.bak caddy.exe
Start-Service Caddy
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Correct result: `200`, and `C:\Services\caddy\caddy.exe version` reports
`v2.11.4`. There is no data or config to restore — only the binary changed.

## Not verified

- An interactive browser login (no browser on the twin). Verified by
  equivalents: UI route 200, OIDC discovery 200, token endpoint 200 through the
  proxy, authenticated `/api/*` 200 with a real ~1.2 KB Bearer token.
- The `write_idle` half of the idle timeouts (a backend stalling mid-response)
  shares the same mechanism and 60 s default as the verified body-read side but
  was not directly exercised.
- The rollback above was not executed; the twin is healthy on the new version.
