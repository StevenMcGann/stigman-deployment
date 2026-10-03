# Update: Caddy 2.11.6 to 2.11.7

Tested on the twin WIN-TJ87SDPMUPH on 2026-10-03.

## What an administrator should do

Apply it: follow guide Step 16.10 as written. Caddy 2.11.7 is a patch that fixes
regressions 2.11.6 introduced in the new default idle timeouts — a crash and
dropped streams under load — and upstream explicitly recommends it for anyone on
2.11.6. The step was run end to end on the twin today; every command worked as
written, and the two new-default behaviors (16 KiB header cap, 60-second stalled
body abort) behave identically after the swap.

## What changes

2.11.7 fixes the 2.11.6 idle-timeout regressions, all in the proxy path this
deployment uses daily:

- A streaming response to a request that had a body was cut off exactly 60
  seconds after the body was read, even while the stream was making progress
  (upstream #8103). Reproduced on the twin's 2.11.6 and gone on 2.11.7 — this is
  the reason to upgrade.
- Over HTTP/2, Caddy could crash with a nil pointer while the reverse proxy was
  still reading a request body after the handler returned (#8101), and quiet
  HTTP/2 streams could be reset after 60 seconds of write idle (#8118). Tested
  on the twin over HTTP/2 — TLS 1.3 with ALPN h2 negotiated, the same way a
  browser uses this proxy (the live service was checked too: it answers h2):
  the quiet-stream reset reproduces on 2.11.6 and is gone on 2.11.7; the crash
  did not reproduce on either version in any shape the twin can drive
  (details below). A browser talks HTTP/2 to this proxy, so these two fixes
  are the ones that matter most to people using the web UI in production.

Also: placeholders for missing cookies/TLS fields are empty again (the live
Caddyfile uses neither); support for the new `Incremental` header (RFC 10036) is
opt-in by the upstream and nothing on this stack sends it; faster TLS handshakes;
Unix-socket cleanup on reload (Windows: not in use); Set-Cookie splitting fix
(JSON config only: not in use); `caddy fmt` brace fix. None of these change this
deployment's behavior beyond the idle-timeout fixes.

The 16 KiB request-header cap and the 60-second stalled-body abort introduced in
2.11.6 are unchanged in 2.11.7 (verified below).

## What might break, and what the twin showed

| Concern | Tested on the twin? | Result |
|---|---|---|
| Streaming responses to requests with a body cut at 60 s (#8103) | Yes — isolated Caddy instance + local sink; a POST with a 1 KiB body answered by a response ticking every 10 s for 100 s | On 2.11.6: cut at 60.3 s, 5 of 10 ticks received, curl exit 18. On 2.11.7: all 10 ticks, 100.3 s, curl exit 0. Fixed. HTTP/1.1 only — the same test over HTTP/2 completed on both versions (10 of 10 ticks, 100 s), matching upstream's finding. |
| Quiet HTTP/2 stream reset (#8118) | Yes — over HTTP/2 (TLS + ALPN h2 negotiated, like a browser): a GET answered by one chunk, a 70 s pause, a second chunk; the pause is longer than the 60 s default `write_idle` | On 2.11.6 the stream was reset with an h2 INTERNAL_ERROR stream error at +60.1 s, 1 of 2 chunks received. On 2.11.7: both chunks, clean end at +70.0 s. Fixed. |
| The intended 60-second stalled-body abort disappears | Yes — same rig; a POST that sends half of a 1 KiB body then stalls | 2.11.6: HTTP 499 at 60.0 s. 2.11.7: HTTP 499 at 60.0 s. Identical — the regression fix did not remove the timeout. |
| The intended stalled-write abort disappears over HTTP/2 | Yes — over HTTP/2: a GET of 1 MiB while the client reads nothing, so the proxy's write blocks on the h2 flow-control window | Stream reset at +60.0 s on both versions. The intended abort is retained over h2. |
| HTTP/2 crash while the proxy still reads a request body (#8101) | Attempted, over HTTP/2, in eight shapes: stalled, slowly dripped and fully blasted request bodies, with the upstream answering early over HTTP/1.1 (the production shape) and over HTTP/2 (the reporter's stack), consuming the body slowly or fast, or closing; plus repeated storms totalling over 65 concurrent uploads against an early-responding upstream | No crash on either version. The panic needs a request-body read to start in the instant after the handler returns and the h2 response-writer state is released; in every shape the twin can drive, the transport aborts the body write about 3 ms after the handler returns, before a new read can start. Two wild crash reports (upstream #8101) show the race is real; it was not reproducible here. |
| 16 KiB header cap changes | Yes — /branding/ on the live service (served by Caddy itself, so STIG Manager's own 16 KiB backend cap cannot mask the result), measured before and after | 10 KiB header → 200, 20 KiB → 431 on both versions. Unchanged. |
| Live Caddyfile rejected by the new binary | Yes — `validate` with the 2.11.7 binary before the swap | "Valid configuration", exit 0, one known cosmetic fmt warning (same as on 2.11.6). |
| Login / token through the proxy breaks | Yes — a service-account sign-in through the proxy after the swap (not a browser login) | Token issued through the proxy (1,198 bytes), authenticated API call 200. |
| Watcher imports break | Yes — MS_Edge scan result placed in the watched folder after the swap | Parsed, asset + STIG data received, 56 reviews posted, 0 rejected, recorded in watcher-history.txt. (The Watcher talks to localhost:54000 directly and does not traverse Caddy, so this is a stack check, not a Caddy check.) |

## Before you start

- Download `caddy_2.11.7_windows_amd64.zip` from
  https://github.com/caddyserver/caddy/releases/tag/v2.11.7 and check its SHA-256
  against the digest GitHub shows beside the asset:
  `(Get-FileHash C:\Installers\caddy_2.11.7_windows_amd64.zip -Algorithm SHA256).Hash`
  must equal the `sha256:` digest on the release page. (Caddy's own
  `caddy_2.11.7_checksums.txt` lists SHA-512 digests, not SHA-256 — do not look
  for the SHA-256 there.)
- Check the stack is healthy first:
  `Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher` shows
  all Running, and
  `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration`
  prints `200`.
- This record was tested from 2.11.6. If your server is still on 2.11.4, go
  straight to 2.11.7 with the same steps (name the old binary
  `caddy-2.11.4.exe.bak`), and read the 2026-10-02 Caddy record as well: the
  header cap and idle timeout it describes arrive with this update. A direct
  2.11.4 to 2.11.7 update was not run on the twin.
- No backup step: Caddy has no database; the old binary kept beside the new one
  is the rollback.

## Procedure

Guide Step 16.10, as run on the twin, one command at a time.

1. Download and verify (Step 1):

   ```
   $ver = '2.11.7'
   $url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
   Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
   (Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
   Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
   ```

   Correct result: the hash equals the SHA-256 digest beside the asset on the
   release page; the zip extracts caddy.exe flat into C:\Installers\caddy-2.11.7
   (no nested folder on the twin).

2. Validate the live Caddyfile with the new binary (Step 2):

   ```
   & "C:\Installers\caddy-$ver\caddy.exe" validate --config C:\Services\caddy\Caddyfile
   ```

   Correct result: "Valid configuration" and exit code 0. (A cosmetic warning
   about Caddyfile formatting, pointing at line 32, is expected on this
   deployment and does not stop the service.)

3. Swap the binary and start (Step 3):

   ```
   Stop-Service Caddy
   Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.6.exe.bak
   Copy-Item "C:\Installers\caddy-$ver\caddy.exe" C:\Services\caddy\caddy.exe -Force
   Start-Service Caddy
   C:\Services\caddy\caddy.exe version
   Get-Service Caddy | Select-Object Name, Status
   curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
   ```

   Correct result: `v2.11.7 …`, Caddy Running, and `200` from the proxy check.

## Check that it worked

- `Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher` — all
  Running.
- `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/` and the same for
  `https://localhost/realms/stigman/.well-known/openid-configuration` — both
  print `200`.
- Log in through a browser at https://YOUR_SERVER_IP/ and open a collection
  (guide Step 16.10, part 4). The twin has no browser: there, a service account
  was issued a token through the proxy and made one authenticated API call,
  which exercises the same route but is not a person's login.
- If the Watcher is installed: place a scan result in the watched folder; it
  must appear in watcher-history.txt on the next 5-minute cycle.
- Once verified, delete the old `.bak` binaries; until then they are the undo.

All of the above except the browser login ran on the twin after the swap and
passed.

## Undo

Not run on the twin (the new version passed every check):

```
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.7.exe.bak
Rename-Item C:\Services\caddy\caddy-2.11.6.exe.bak caddy.exe
Start-Service Caddy
C:\Services\caddy\caddy.exe version
```

Correct result: `v2.11.6 …`, Caddy Running, 200 from
`https://localhost/api/op/configuration`.

## Not verified

- A literal browser click-through of login (the twin has no GUI); the same
  request path was verified programmatically through the proxy, over HTTP/1.1
  and over HTTP/2.
- The HTTP/2 crash (#8101) — not reproduced on either version on the twin, over
  HTTP/2, in eight shapes plus over 65 concurrent uploads (see the table). The quiet-
  stream reset (#8118) was reproduced over HTTP/2 and is confirmed fixed. The
  crash claim stands on the two upstream reports; a browser does use HTTP/2
  through this proxy, and 2.11.7 contains the fix either way.
- A direct update from 2.11.4 to 2.11.7 (the twin was already on 2.11.6).
- Behavior of a Watcher pointed at the public HTTPS address — this deployment's
  Watcher points at localhost:54000, so its imports never traverse Caddy.

## Guide corrections found while testing

- Step 16.10 Step 2's validate command, as previously written
  (`C:\Installers\caddy-$ver\caddy.exe validate …`), fails when typed as shown:
  in command position PowerShell does not expand `$ver`, so the admin gets
  "term not recognized". Fixed in build-install-guide.js to
  `& "C:\Installers\caddy-$ver\caddy.exe" validate …`; both guides rebuilt.
- The prerequisites list and the version table named the bare
  `caddy_windows_amd64.exe` asset and version 2.11.6. The 2.11.7 release (like
  2.11.6's) ships Windows builds only as `caddy_2.11.7_windows_amd64.zip`, and
  upstream recommends against staying on 2.11.6. Both now name the zip and
  2.11.7; Install-Caddy.ps1 already extracts caddy.exe from the zip form.
