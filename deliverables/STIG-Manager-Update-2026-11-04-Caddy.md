# Update: Caddy 2.11.7 to 2.11.8

Tested on a test server on 2026-11-04, including the rollback.

## Summary

Apply this update. Caddy 2.11.8 is a patch release that carries nine security
fixes, including the completion of the fix for CVE-2026-55458 in the reverse
proxy that serves this deployment, and a change that rejects malformed requests
before they reach any route. The web interface is unavailable for a few seconds
while Caddy restarts. No configuration changes are required.

## What changes

Security fixes, in the order they matter here:

- The reverse proxy now strips hop-by-hop headers from interim (1xx) responses
  and from copied response headers in `handle_response`, which completes the fix
  for CVE-2026-55458. Browser and API traffic to Keycloak and STIG Manager
  passes through this proxy, but the Caddyfile this deployment uses has
  neither `handle_response` nor `copy_response_headers`, so this fix protects
  a configuration that adds them later rather than changing behaviour today.
- A request whose `Host` header contains dot segments or slashes, or which is
  made up only of dots, is now rejected with HTTP 400 before any route runs.
  Such a host could previously escape the intended directory when it was used
  in a file path.
- The `file` matcher no longer resolves a path such as `/.env/./` to a regular
  file, which had allowed a path rule such as `path *.env` to be bypassed.
- The `rewrite` handler now escapes the file matcher's remainder before it
  rewrites, so a double-encoded path such as `..%252f` cannot become `../`
  after the path rules have run.
- When neither `HOME` nor `XDG_DATA_HOME` is set, Caddy's data directory falls
  back to the working directory, and a `file_server` serving that directory
  could expose certificates and private keys. That directory is now always
  hidden.
- Files excluded with `hide` no longer appear in `browse` listings, and hidden
  `precompressed` sidecars are no longer served.
- The `query` log filter now redacts the parameters that follow a `#` in a
  request URI. This deployment keeps no query log filter.

The following security fixes apply only to features this deployment does not
use, and change nothing here: PHP and FastCGI handling (`SCRIPT_FILENAME` and
`PATH_INFO` normalisation, the trailing-slash redirect, and a `Location`
response without a `Status`), and Encrypted Client Hello.

Changes in behaviour that affect this deployment:

- **Malformed `Host` values are rejected.** Measured on the test server: a
  request carrying `Host: ..` returned HTTP 200 on 2.11.7 and HTTP 400 on
  2.11.8; a request carrying `Host: ...` returned HTTP 200 on 2.11.7 and HTTP
  400 on 2.11.8. A request carrying `Host: bad/host` returned HTTP 400 on
  both versions. Browsers send the address that was typed, so only a crafted
  or malformed request is affected; the deployment's own address and
  `localhost` were served normally on both versions.
- **A request body is no longer lost over HTTP/2.** When the proxy paused
  reading a request body, for example while uploading to a slow upstream, the
  body could be lost and the request answered with HTTP 502. This fault was
  introduced in 2.11.6 and is fixed here. Browsers use HTTP/2 with this proxy,
  so it matters to people using the web interface.
- **Idle timeouts.** Per-route `timeouts` now take precedence over the
  server-wide `read_body_idle` and `write_idle`, a nested `timeouts` block
  uses the innermost one, and a deadline set by a handler caps the idle
  timeouts instead of being overridden by them. This deployment sets no
  `timeouts`, so the server-wide defaults introduced in 2.11.6 continue to
  apply: a 16 KiB request-header limit and an abort of a body read or response
  write that makes no progress for more than 60 seconds.
- **Stricter configuration validation.** A Caddyfile that earlier releases
  accepted silently is now rejected in more cases: more than one `expression`
  line in a matcher set, unknown TLS curve or protocol names, a repeated
  `sni_regexp` in a TLS policy, an out-of-range `ip_mask` log filter, two
  `basic_auth` users with the same name, and a port longer than 11 characters.
  The live Caddyfile must be checked with the new binary before it replaces the
  running one (step 2 of the procedure).
- **Compression.** The `encode` directive now compresses a response even when
  the request carried `Cache-Control: no-transform`, and adds
  `Vary: Accept-Encoding` to every response that could be encoded. This
  deployment's Caddyfile has no `encode` directive and the adapted
  configuration contains no compression handler, so no response changes.
- **`request_body max_size`.** A request whose `Content-Length` is over the
  limit is now rejected with HTTP 413 as soon as it arrives, even if nothing
  would have read the body. This deployment sets no limit.
- **The Windows service.** The service no longer gets stuck in `START_PENDING`
  after a start.

Other changes have no effect on this deployment: PHP and FastCGI handling,
Encrypted Client Hello, client-certificate verification modes, ACME automation
policies, `caddy hash-password`, the admin API, the new `log_level` directive,
the new `{time.now.rfc3339}` placeholder, the new `not` matcher for TLS
connection policies, the CEL `tls()` matcher, and the load-balancing fixes.

## Test results

| Risk | Result on the test server |
|---|---|
| The new version rejects the Caddyfile | No. `caddy validate` reported `Valid configuration` and exit code 0 against the live Caddyfile, with the same formatting warning that 2.11.7 gave. |
| Requests that used to be served are now rejected | Only requests with an invalid or dots-only `Host`. `Host: ..` and `Host: ...` returned 200 on 2.11.7 and 400 on 2.11.8; `Host: bad/host` returned 400 on both. The approved address and `localhost` were served on both versions. |
| The web interface or the API stops answering | No. The root page, `/api/op/configuration` and the OIDC discovery document each answered HTTP 200 on 2.11.8, over HTTP/1.1 and over HTTP/2. |
| Sign-in through the proxy breaks | No. A service account received a token through the proxy and made an authenticated API call. A browser at the approved address loaded the sign-in page and then the web interface over HTTP/2, with no failed requests and no console errors. |
| The 16 KiB request-header limit changes | No. A 10 KiB header was accepted (HTTP 200) and a 20 KiB header was rejected (HTTP 431) on 2.11.8. A later measurement, on 2026-11-05, showed that the rejection came from the STIG Manager application, which refuses request headers totalling more than 16 KiB, and not from Caddy, whose own limit is about 20 KiB; see the change record for Caddy 2.11.9 (2026-11-05). |
| A request body is lost over HTTP/2 | No. A 50,000-byte request body reached the STIG Manager API over HTTP/2 and over HTTP/1.1. Both requests were answered by the API (HTTP 400, invalid JSON), not by the proxy (HTTP 502). |
| The 60-second limit on stalled transfers changes | Not tested. The changes concern the precedence of per-route timeouts and of a handler's own deadlines. This deployment sets no `timeouts`, so the server-wide defaults continue to apply unchanged. |
| Hop-by-hop headers are stripped from interim responses | Not directly testable in this configuration. The Caddyfile uses neither `handle_response` nor `copy_response_headers`, and neither Keycloak nor the STIG Manager API sends interim responses. |
| Compression behaviour changes | No. The adapted configuration contains no `encode` handler, so responses are not compressed on either version: the index page was served uncompressed (914 bytes, no `Content-Encoding` header). |
| Watcher imports break | No. A scan result placed in the watched folder was queued for parsing, parsed, and listed in `watcher-history.txt` on the next scan. The Watcher connects to the STIG Manager API directly, not through Caddy, so this checks the stack rather than Caddy. |
| The rollback does not work | It works. Caddy 2.11.7 was restored, its version line and the site were checked, the health and sign-in checks passed, and 2.11.8 was then applied again and every check was repeated. |

## Before you start

- **The download.** Step 1 downloads `caddy_2.11.8_windows_amd64.zip` from the
  release page (https://github.com/caddyserver/caddy/releases/tag/v2.11.8). You
  will compare its SHA-256 hash with the `sha256:` digest that GitHub shows
  beside the file. The digest of the file tested on the test server was
  `eaf062366aeba9d782af7f70edb4b49097652be1af31e8141f9f2761aa25cb1f`, for a
  file of 18,387,917 bytes. Caddy's own `caddy_2.11.8_checksums.txt` lists
  SHA-512 digests, not SHA-256.
- **A healthy starting point.** Confirm that the stack is healthy:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
  ```

  Expected result: all five services are Running, and the second command prints
  `200`.
- **If your server is still on 2.11.6 or older.** Update to 2.11.7 first, then
  to 2.11.8, using the same steps and naming the file you replace
  `caddy-<your version>.exe.bak`. The request-header limit and the idle
  timeouts arrive with 2.11.6 and are described in the update record for that
  release (2026-10-02). A direct update from a version older than 2.11.7 was
  not tested.
- **Backups.** No backup is needed. Caddy has no database, and the old program
  file kept beside the new one is the rollback.
- **One PowerShell window.** Run every command in one elevated PowerShell
  window, in order. Later steps use the `$ver` variable that step 1 sets.

## Procedure

### 1. Download, verify and extract

```powershell
$ver = '2.11.8'
$url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
(Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
```

Expected result: the hash equals the SHA-256 digest beside the file on the
release page, and `caddy.exe` is extracted directly into
`C:\Installers\caddy-2.11.8`.

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
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.7.exe.bak
Copy-Item "C:\Installers\caddy-$ver\caddy.exe" C:\Services\caddy\caddy.exe -Force
Start-Service Caddy
C:\Services\caddy\caddy.exe version
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: the version begins `v2.11.8`, Caddy is Running, and the last
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

This rollback was run on the test server, and the update was then applied again.

```powershell
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.8.exe.bak
Rename-Item C:\Services\caddy\caddy-2.11.7.exe.bak caddy.exe
Start-Service Caddy
C:\Services\caddy\caddy.exe version
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: the version begins `v2.11.7`, Caddy is Running, and the last
command prints `200`. On the test server the health check and the service
account sign-in check both passed after the rollback.

To apply 2.11.8 again after a rollback, repeat step 3, using the copy kept at
`C:\Installers\caddy-2.11.8\caddy.exe`.

## Not verified

- **Signing in with a browser.** The browser check on the test server used the
  deployment's test account, not a person's own account, and does not cover a
  federated sign-in through Active Directory. Sign in with a browser after you
  apply the update.
- **The 60-second limit on stalled transfers, and the precedence of per-route
  timeouts.** Neither was tested, because this deployment sets no `timeouts`
  and the changes affect only deployments that do.
- **The stripping of hop-by-hop headers from interim responses.** It cannot be
  reached through this Caddyfile, which uses neither `handle_response` nor
  `copy_response_headers`.
- **A direct update from a version older than 2.11.7.** The test server was
  already on 2.11.7.
- **The Watcher posting new reviews.** The scan result used for the test
  matched results already held in STIG Manager, so the Watcher reported that
  there were no reviews to post. That is the expected result for a repeated
  scan, not a fault.
