# Update: Caddy 2.11.8 to 2.11.9

Tested on a test server on 2026-11-05, including the rollback.

## Summary

Apply this update. Caddy 2.11.9 is a patch release that repairs a fault introduced
by 2.11.8 and adds security fixes, most of them in FastCGI, which this deployment
does not use. The web interface is unavailable for a few seconds while Caddy
restarts. No configuration changes are required: the live Caddyfile validated
unchanged under 2.11.9.

## What changes

Security fixes, all of them in FastCGI or in the merging of TLS connection
policies:

- A client could override any `HTTP_*` variable that the FastCGI transport's
  `env` subdirective set, by sending a request header of the same name
  (GHSA-q34h-28rj-5hjm). Configured values now win.
- On Windows, NTFS 8.3 short names and alternate data streams could make
  FastCGI run a script that a path rule was meant to deny
  (GHSA-9cr8-wmhh-39pm).
- Encoded slashes and dot segments could make a path matcher that contains
  `%` approve one script while a different script ran.
- Over HTTP/2, a `host` field sent next to `:authority` could make the
  application see a different host than the one Caddy routed the request to.
- A stricter `client_auth` could be silently dropped when two TLS connection
  policies were merged.
- The `go-jose` library was updated to version 4.1.6 for GHSA-mgcc-cww5-fp2q.

None of these fixes change this deployment. Caddy here serves the web interface
and proxies to Keycloak and to the STIG Manager API over HTTP; it serves no PHP,
uses no FastCGI, and the Caddyfile sets no `client_auth` and no TLS connection
policy. The updated `go-jose` library is carried by the new binary, but Caddy's
own OpenID Connect features are not used either, because Keycloak provides
OpenID Connect to this deployment.

Changes in behaviour that affect this deployment: none that were observed. The
following changes were assessed and have no effect here:

- **PHP directory indexes.** 2.11.8 matched a directory that was named with a
  trailing slash instead of the `index.php` inside it, which broke PHP
  applications. 2.11.9 fixes that. This deployment serves no PHP.
- **Path matchers with placeholders.** A placeholder such as `{env.FOO}` is no
  longer lower-cased before it is looked up, and its value is compared with the
  request path without regard to case. Every path matcher in this Caddyfile is
  a literal path (`/realms/*`, `/resources/*`, `/admin/*`, `/api/*`,
  `/branding/*`); no placeholder is used.
- **Conflicting `client_auth` is now a configuration error.** Two site blocks
  that share a TLS connection policy for the same host name but set different
  `client_auth` values are now rejected instead of the second value being
  dropped. This Caddyfile has one site block and no `client_auth`.
- **FastCGI requests that are ambiguous about which script they run are
  answered with HTTP 400.** Not applicable; no FastCGI.
- **FastCGI `env` values now take precedence over request headers.** Not
  applicable; no FastCGI.
- **A new `plain_time_format` option for plain-text directory listings.** This
  Caddyfile uses `file_server` without `browse`, so no directory listing is
  produced.
- **Fewer allocations** in path cleaning, header rewriting and weighted
  round-robin selection. A performance change only.

The behaviour introduced by 2.11.8 still holds under 2.11.9: a request whose
`Host` header is invalid, or made up only of dots, is rejected with HTTP 400
before any route runs. This was measured on both versions.

## Test results

| Risk | Result on the test server |
|---|---|
| The new version rejects the Caddyfile | No. `caddy validate` reported `Valid configuration` and exit code 0 against the live Caddyfile, with the same formatting warning that 2.11.8 gave. |
| Requests that used to be served are now rejected | No. A request carrying `Host: ..`, `Host: ...` or `Host: bad/host` was answered with HTTP 400 on both 2.11.8 and 2.11.9; the deployment's own address and `localhost` were answered with HTTP 200 on both. |
| The web interface or the API stops answering | No. The root page, `/api/op/configuration` and the OpenID Connect discovery document each answered HTTP 200 after the update, over HTTP/1.1 and over HTTP/2. The service started without error. |
| Sign-in through the proxy breaks | No. The Watcher's service account received a token through the proxy and made an authenticated API call. A browser at the approved address loaded the sign-in page and then the web interface over HTTP/2, with no failed requests and no console errors. |
| The request-header limit changes | No. The same limits were measured before and after the update. Caddy refuses a request whose headers total more than about 20 KiB: on a path that Caddy serves itself (`/branding/logo.png`), a request carrying a 20,300-byte header was answered with HTTP 200 and a request carrying a 20,400-byte header with HTTP 431, on both 2.11.8 and 2.11.9. The STIG Manager application refuses a request whose headers total more than 16 KiB: a request carrying a 16,300-byte header was answered with HTTP 200 when sent straight to the application on port 54000 and with HTTP 431 when sent through the proxy, because the proxy adds forwarding headers of its own; a 16,200-byte header was answered with HTTP 200 through the proxy. This limit belongs to the application, not to Caddy, so it applies whichever version of Caddy is installed. |
| The PHP and FastCGI fixes change behaviour here | No. This deployment uses neither, and the Caddyfile contains no PHP, FastCGI or `try_files` directive. |
| The Watcher stops importing | No. A scan result placed in the watched folder was queued for parsing, parsed, and listed in `watcher-history.txt` on the next scan. The Watcher connects to the STIG Manager API directly, not through Caddy, so this checks the stack rather than Caddy. |
| The rollback does not work | It works. Caddy 2.11.8 was restored, its version line and the site were checked, and 2.11.9 was then applied again and every check was repeated. |

## Before you start

- **The download.** Step 1 downloads `caddy_2.11.9_windows_amd64.zip` from the
  release page (https://github.com/caddyserver/caddy/releases/tag/v2.11.9). You
  will compare its SHA-256 hash with the `sha256:` digest that GitHub shows
  beside the file. The digest of the file tested on the test server was
  `ad93112d335ee687100c4c9f11bced16ca590377976b7fe7883882b9e797e472`, for a
  file of 18,384,117 bytes. Caddy's own `caddy_2.11.9_checksums.txt` lists
  SHA-512 digests, not SHA-256; the SHA-512 digest of that file is
  `98753d5d42650383d00619ac70917a217141f9e92314185bf6c1b8b439cfcfdf8393da0ebb4675c8cb3b23d29a19aabe99dc5aca64fa1bfc3a1ba22509b06871`.
- **A healthy starting point.** Confirm that the stack is healthy:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
  ```

  Expected result: all five services are Running, and the second command prints
  `200`.
- **If your server is older than 2.11.8.** Update to 2.11.8 first, using the
  update record for that release (2026-11-04), then apply this record. The
  request-header limit and the idle timeouts arrive with 2.11.6 and are
  described in the update record for that release (2026-10-02). A direct update
  from a version older than 2.11.8 was not tested.
- **Backups.** No backup is needed. Caddy has no database, and the old program
  file kept beside the new one is the rollback.
- **One PowerShell window.** Run every command in one elevated PowerShell
  window, in order. Later steps use the `$ver` variable that step 1 sets.

## Procedure

### 1. Download, verify and extract

```powershell
$ver = '2.11.9'
$url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
(Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
```

Expected result: the hash equals the SHA-256 digest beside the file on the
release page, and `caddy.exe` is extracted directly into
`C:\Installers\caddy-2.11.9`.

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
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.8.exe.bak
Copy-Item "C:\Installers\caddy-$ver\caddy.exe" C:\Services\caddy\caddy.exe -Force
Start-Service Caddy
C:\Services\caddy\caddy.exe version
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: the version begins `v2.11.9`, Caddy is Running, and the last
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
Remove-Item C:\Services\caddy\caddy.exe -Force
Rename-Item C:\Services\caddy\caddy-2.11.8.exe.bak caddy.exe
Start-Service Caddy
C:\Services\caddy\caddy.exe version
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: the version begins `v2.11.8`, Caddy is Running, and the last
command prints `200`. The service runs the program file at
`C:\Services\caddy\caddy.exe`, so the old program file must be put back under
that name before Caddy is started.

To apply 2.11.9 again after a rollback, repeat step 3, using the copy kept at
`C:\Installers\caddy-2.11.9\caddy.exe`.

## Not verified

- **Signing in with a browser.** The browser check on the test server used the
  deployment's test account, not a person's own account, and does not cover a
  federated sign-in through Active Directory. Sign in with a browser after you
  apply the update.
- **HTTP/3.** The checks on the test server used HTTP/1.1 and HTTP/2. The
  browser check negotiated HTTP/2. HTTP/3 was not tested.
- **The PHP and FastCGI fixes.** They were not tested, because this deployment
  uses neither.
- **The 60-second limit on stalled transfers.** It was not re-tested, because
  this deployment sets no `timeouts` and the defaults introduced with 2.11.6
  continue to apply unchanged.
- **A direct update from a version older than 2.11.8.** The test server was
  already on 2.11.8.
- **The Watcher posting new reviews.** The scan result used for the test
  matched results already held in STIG Manager, so the Watcher reported that
  there were no reviews to post. That is the expected result for a repeated
  scan, not a fault.
