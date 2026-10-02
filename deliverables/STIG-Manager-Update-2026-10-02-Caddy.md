# Update: Caddy 2.11.4 to 2.11.6

Tested on the twin WIN-TJ87SDPMUPH on 2026-10-02.

## What an administrator should do

Apply Step 16.10 of the deployment guide exactly as written. Caddy is a single
binary swapped in place, the downtime is one service restart (a few seconds),
and no maintenance window is needed. The step's checks cover the two new
defaults in 2.11.6 (a 16 KiB request-header cap and a 60-second abort of a
stalled body or response); both were verified on the twin and passed.

## What changes

Security fixes (first):

- **fileserver: Windows 8.3 short names are now rejected in every path
  component, not just the last one.** This deployment serves static files
  (`/branding/*` through the `file_server` route), so this is hardening of a
  route in use.
- **`path_regexp` matcher: Windows backslash bypass fixed** (completes
  CVE-2026-52844). The Caddyfile does not use `path_regexp`; this fix does not
  change anything here.
- **reverseproxy: a request could be sent on the wrong upstream connection
  when a route used `forward_auth` and `reverse_proxy` together**
  (GHSA-6365-7ppr-5r92). The Caddyfile does not use `forward_auth`; not
  applicable here.
- Other fixes (fastcgi HTTPoxy, sticky-session cookie timing, admin API
  allow-list hardening, `handle_path`/`uri` strip canonicalization) cover
  features this deployment does not use.

Behaviour changes that apply to every request through the proxy:

- **Request headers are capped at 16 KiB** (previously Go's 1 MiB default).
  Larger requests now get `431 Request Header Fields Too Large`. Raise the cap
  with the `max_header_size` server option if a client needs it.
- **A body read or response write that makes no progress for more than 60
  seconds is now aborted** (HTTP 499 on the twin). A slow transfer that is
  still progressing is left alone — the timer resets on every read or write.
  Tune with `read_body_idle` / `write_idle` in the `timeouts` server option.
- **Request header fields containing `.` are dropped**, the same way
  underscores were in 2.11.4. Allow specific ones back with
  `expected_dot_headers`.
- **Caddyfiles are validated more strictly**; a config that started before may
  fail now. The live Caddyfile on the twin validates cleanly on 2.11.6.
- **Windows: a reloaded listener sharing a socket no longer wedges** (#7999) —
  a fix that matters for service restarts on this host.

Not used here, so no effect: SAML, `forward_auth`, `path_regexp`, FastCGI,
sticky sessions, active health checks, the `url_pattern` matcher, HTTP/3
behind low-MTU links. Building from source now requires Go 1.26 — irrelevant
for the prebuilt Windows binary.

## What might break, and what the twin showed

| Concern | Tested on the twin? | Result |
|---|---|---|
| 16 KiB header cap breaks login (OIDC token + cookies exceed the cap) | Yes: authenticated login through the Caddy proxy as `stigman-admin`, then an authenticated API call and a collection list. The issued token is 1,073 bytes, far under the cap | Login works, application loads, collection "Watcher Imports" opens. Cap proven active: a 20 KiB request header gets **431**, a 10 KiB header gets **200** |
| 60-second idle timeout aborts a real Watcher import | Yes: a 12 KB scan result was dropped into the watched folder and picked up on the Watcher's next 5-minute cycle; asset `WIN-TJ87SDPMUPH` updated; import recorded in `watcher-history.txt` | Import completed within one cycle. The Watcher logs one warning, "no reviews to post", which is expected on this twin (its STIG library is not fully imported — see the runbook) and not a Caddy fault |
| The 60-second abort itself (does it fire, and does it spare progressing uploads) | Yes, in isolation: a second 2.11.6 instance proxying to a local sink that keeps reading. A stalled 1 KB upload was aborted at **60.0 seconds** with HTTP 499; a progressing upload was never aborted | Fires exactly as documented. Progress resets the timer, so real imports that stream continuously are unaffected |
| Stricter validation rejects the live Caddyfile | Yes: `validate` of `C:\Services\caddy\Caddyfile` with the new binary, before the swap | "Valid configuration" (one cosmetic formatting warning) |
| Dot-containing headers dropped and a client relies on one | No: no client on this stack sends dotted headers (web UI, CKL export, Watcher) | Assessed by inspection; escape hatch `expected_dot_headers` is documented in the step if one ever appears |

## Before you start

- The Caddy 2.11.6 Windows zip downloaded to `C:\Installers` and its SHA-256
  compared with the digest shown beside the file on the GitHub release page
  (twin: `07429393…CC1153`, matched).
- No backup is needed: Caddy has no database. The old binary, renamed beside
  the new one in Step 3, is the rollback.
- Check that the stack is healthy first (twin tool: `Test-Health.ps1`;
  answer: `HEALTHY`, all five services Running), and that Caddy answers with
  the old version:

  ```powershell
  C:\Services\caddy\caddy.exe version
  ```

  Answer before the update on the twin: `v2.11.4`.

## Procedure

Run from an elevated PowerShell, in this order, exactly as run on the twin.

### 1. Download and verify the new binary

```powershell
$ver = '2.11.6'
$url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
(Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
```

Correct result: the printed hash equals the SHA-256 digest shown beside the
file on the GitHub release page. Only then extract:

```powershell
Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
```

Correct result: `C:\Installers\caddy-2.11.6\caddy.exe` exists (the archive
extracts flat on the twin; if your archive nests `caddy.exe` in a folder, use
that path below instead).

### 2. Validate the current Caddyfile with the new binary, before swapping

```powershell
C:\Installers\caddy-2.11.6\caddy.exe validate --config C:\Services\caddy\Caddyfile
```

Correct result: "Valid configuration". It must report success before you
continue; if it reports an error, fix the Caddyfile and validate again.
On the twin it reported "Valid configuration" plus one cosmetic formatting
warning.

### 3. Swap the binary and start

```powershell
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.4.exe.bak
Copy-Item "C:\Installers\caddy-2.11.6\caddy.exe" C:\Services\caddy\caddy.exe -Force
Start-Service Caddy
C:\Services\caddy\caddy.exe version
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Correct result: the version line says `v2.11.6`, the service is `Running`, and
the curl call prints `200` (Caddy serving TLS and proxying `/api/*`). All
three held on the twin.

### 4. Verify the paths the new defaults can break

- **Header cap / login:** log in at `https://YOUR_SERVER_IP/` and confirm the
  application loads and a collection opens. On the twin the same request path
  was exercised without a GUI: a Keycloak token request through the `/realms/*`
  proxy succeeded for `stigman-admin`, the issued access token was 1,073 bytes
  (far under 16 KiB), and an authenticated `GET /api/collections` returned the
  collection "Watcher Imports". The cap itself was proven active with
  `curl.exe -sk -H "X-Big: <20000 chars>" -o NUL -w "%{http_code}"`
  → `431`, while a 10 KiB header → `200`.
- **Idle timeout / Watcher import:** drop a scan result into the watched
  folder and confirm the Watcher imports it. On the twin a 12 KB result
  (`..._XCCDF-Results_Windows_Updates-001.001.xml`, dated 2026-10-02) was
  copied into `C:\Services\stigman-watcher\watched` at 15:40, picked up by the
  Watcher's 15:43 scan, and recorded in `watcher-history.txt`; the asset
  `WIN-TJ87SDPMUPH` is present in collection 1 through the API. The one
  warning, "no reviews to post", is expected on a twin whose STIG library is
  not fully imported and is not a Caddy fault.
- **Full service set:**

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  ```

  Correct result: all five `Running` — as on the twin.

## Check that it worked

```powershell
C:\Services\caddy\caddy.exe version
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/realms/stigman/.well-known/openid-configuration
```

Correct answers on the twin after the update: `v2.11.6`, `200`, `200`, `200`.
The twin health tool's full check also returned `HEALTHY` with all five
services Running and STIG Manager reporting 1.6.17.

## Undo

```powershell
Stop-Service Caddy
Remove-Item C:\Services\caddy\caddy.exe
Rename-Item C:\Services\caddy\caddy-2.11.4.exe.bak caddy.exe
Start-Service Caddy
C:\Services\caddy\caddy.exe version
```

Correct result: `v2.11.4`, service Running, and `https://localhost/`
answering 200 again. **Not run on the twin** — the new version is healthy and
`caddy-2.11.4.exe.bak` is kept in place as the rollback until this update has
stood in production. (An older `caddy-2.11.3.exe.bak` from the previous
update is also on disk and may be deleted once this one has stood.)

## Not verified

- A literal browser click-through of the login page (the twin has no GUI);
  the same request path was verified programmatically through the proxy, and
  the header sizes involved are far under the new cap.
- A client that sends dotted or underscored request headers — none on this
  stack does, so there was nothing to test against; the escape hatches are
  documented above if one ever appears.
- The Watcher on the twin talks directly to the API (`localhost:54000`), not
  through Caddy, so the import itself did not traverse the proxy. The
  60-second abort behaviour through Caddy was proven separately in an
  isolated 2.11.6 instance; on a server where the Watcher is pointed at the
  Caddy URL, confirm the first real import after the update.
