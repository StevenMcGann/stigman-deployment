# Update: Caddy 2.11.6 to 2.11.7

Tested on a test server on 2026-10-03. The rollback was not run.

## Summary

Apply this update. Caddy 2.11.7 fixes problems that 2.11.6 introduced with its
new default idle timeouts: a possible crash and connections cut off while still
in use. The Caddy project recommends it for everyone on 2.11.6.

The web interface is unavailable for a few seconds while Caddy restarts. No
configuration changes are required.

## What changes

2.11.7 fixes three problems with the idle timeouts introduced in 2.11.6, all in
the reverse proxy that serves this deployment:

- A streaming response to a request that had a body was cut off 60 seconds
  after the body was read, even while data was still flowing (Caddy issue
  #8103). This was reproduced on 2.11.6 on the test server and did not occur on
  2.11.7.
- Over HTTP/2, a stream with no traffic for 60 seconds could be reset (#8118).
  This was reproduced on 2.11.6 and did not occur on 2.11.7.
- Over HTTP/2, Caddy could crash while the proxy was still reading a request
  body (#8101). This could not be reproduced on either version. Browsers use
  HTTP/2 with this proxy, so these two HTTP/2 fixes matter most to people using
  the web interface.

The 16 KiB request header limit and the 60-second limit on stalled transfers
introduced in 2.11.6 are unchanged.

Other changes have no effect on this deployment: empty placeholders for missing
cookies and TLS fields (the Caddyfile uses neither), optional support for the new
`Incremental` header (nothing in this stack sends it), faster TLS handshakes,
Unix socket cleanup on reload, a Set-Cookie fix for JSON configurations, and a
`caddy fmt` fix.

## Test results

| Risk | Result on the test server |
|---|---|
| Streaming responses are still cut off at 60 seconds (#8103) | Fixed. Over HTTP/1.1, a 100-second streaming response was cut off at 60 seconds on 2.11.6 and completed on 2.11.7. Over HTTP/2 it completed on both versions. |
| Quiet HTTP/2 streams are still reset (#8118) | Fixed. On 2.11.6 a stream that paused for 70 seconds was reset after 60 seconds. On 2.11.7 it completed. |
| The 60-second limit on stalled transfers no longer works | It still works. A stalled upload over HTTP/1.1 and a stalled download over HTTP/2 were both stopped after 60 seconds, on both versions. |
| The HTTP/2 crash (#8101) | Not reproduced on either version, in eight different test patterns and with more than 65 concurrent uploads. |
| The 16 KiB header limit changes | No change. A 10 KiB header was accepted and a 20 KiB header was rejected (431) on both versions. |
| The new version rejects the Caddyfile | No. `caddy validate` reported a valid configuration, with the same formatting warning as 2.11.6. |
| Sign-in through the proxy breaks | No. A service account received a token through the proxy and made an authenticated API call. |
| Watcher imports break | No. A scan result placed in the watched folder was imported: 56 reviews posted, none rejected. The Watcher connects to STIG Manager directly, not through Caddy, so this checks the stack rather than Caddy. |

## Before you start

- **The download.** Step 1 downloads `caddy_2.11.7_windows_amd64.zip` from the
  release page (https://github.com/caddyserver/caddy/releases/tag/v2.11.7). You
  will compare its SHA-256 hash with the `sha256:` digest that GitHub shows
  beside the file. Caddy's own `caddy_2.11.7_checksums.txt` lists SHA-512
  digests, not SHA-256.
- **A healthy starting point.** Confirm that the stack is healthy:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
  ```

  Expected result: all five services are Running, and the second command prints
  `200`.
- **If your server is still on 2.11.4.** Update directly to 2.11.7 with the same
  steps, naming the old file `caddy-2.11.4.exe.bak` in step 3. Also read the
  update record for Caddy 2.11.6 (2026-10-02): the header limit and idle timeouts
  it describes arrive with this update. A direct update from 2.11.4 to 2.11.7 was
  not tested.
- **Backups.** No backup is needed. Caddy has no database, and the old program
  file kept beside the new one is the rollback.
- **One PowerShell window.** Run every command in one elevated PowerShell
  window, in order. Later steps use the `$ver` variable that step 1 sets.

## Procedure

### 1. Download, verify and extract

```powershell
$ver = '2.11.7'
$url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
(Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
```

Expected result: the hash equals the SHA-256 digest beside the file on the
release page, and `caddy.exe` is extracted directly into
`C:\Installers\caddy-2.11.7`.

### 2. Check the Caddyfile with the new version

```powershell
& "C:\Installers\caddy-$ver\caddy.exe" validate --config C:\Services\caddy\Caddyfile
```

Expected result: `Valid configuration` and exit code 0. A warning about the
Caddyfile's formatting is expected and does not affect the service. If the
command reports an error, fix the Caddyfile before you continue; starting
Caddy with a configuration it rejects leaves the site down.

### 3. Replace the program file and start Caddy

```powershell
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.6.exe.bak
Copy-Item "C:\Installers\caddy-$ver\caddy.exe" C:\Services\caddy\caddy.exe -Force
Start-Service Caddy
C:\Services\caddy\caddy.exe version
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: the version begins `v2.11.7`, Caddy is Running, and the last
command prints `200`.

## Verify the update

```powershell
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/realms/stigman/.well-known/openid-configuration
```

Expected result: all five services are Running, and both `curl.exe` commands
print `200`.

Then sign in at https://YOUR_SERVER_IP/ in a browser and open a collection. If
the Watcher is installed, confirm that it still imports: when the next scan
result arrives in its watched folder (by default
`C:\Services\stigman-watcher\watched`), the file name should appear in
`C:\Services\stigman-watcher\watcher-history.txt` after the Watcher's next scan.

When you are satisfied, delete the old `.bak` files in `C:\Services\caddy`.
Until then, they are the rollback.

## Roll back

This rollback was not run on the test server, because the new version passed
every check.

```powershell
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.7.exe.bak
Rename-Item C:\Services\caddy\caddy-2.11.6.exe.bak caddy.exe
Start-Service Caddy
C:\Services\caddy\caddy.exe version
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: the version begins `v2.11.6`, Caddy is Running, and the last
command prints `200`.

## Not verified

- **Signing in with a browser.** This was not tested. The same request path
  was tested through the proxy with a service account, over HTTP/1.1 and
  HTTP/2. Sign in with a browser after you apply the update.
- **The HTTP/2 crash (#8101).** It could not be reproduced on either version.
  The fix rests on the Caddy project's reports; 2.11.7 contains it either way.
- **A direct update from 2.11.4 to 2.11.7.** The test server was already on
  2.11.6.
- **The rollback.** It was not run.
