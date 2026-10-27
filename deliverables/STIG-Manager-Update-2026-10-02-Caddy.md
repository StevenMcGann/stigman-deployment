# Update: Caddy 2.11.4 to 2.11.6

Tested on a test server on 2026-10-02. The rollback was not run.

> **Note:** Caddy 2.11.7 (2026-10-03) fixes problems introduced in 2.11.6. If
> your server is on 2.11.4, the 2026-10-03 update record explains how to update
> directly to 2.11.7. Read this record as well: the security fixes and new
> defaults described here arrive with that update.

## Summary

Caddy 2.11.6 contains security fixes for the paths this deployment serves, and
introduces two new defaults that apply to every request: a 16 KiB limit on
request headers, and a 60-second limit on transfers that stop making progress.
No configuration changes are required.

The web interface is unavailable for a few seconds while Caddy restarts. Keep
the old program file as `caddy-2.11.4.exe.bak` until you have verified the
update; it is the rollback.

## What changes

Security fixes that apply to this deployment:

- `handle_path` and `uri strip_prefix` now normalize the resulting path, so it
  cannot be used to bypass path-based rules. This deployment uses
  `handle_path /branding/*`.
- `path_regexp` now handles Windows backslashes the way the `path` matcher does,
  completing the fix for CVE-2026-52844. This deployment does not use
  `path_regexp`, but the server runs on Windows, so the fix adds protection.
- The static file server rejects Windows 8.3 short names in every part of a path,
  and fixes duplicate ETags. This deployment serves `C:\Services\caddy\branding`
  this way.
- The reverse proxy passes partial responses on to clients, and the admin API
  (localhost:2019 only) normalizes request paths and compares its allow lists
  without regard to case.

New defaults that apply to every request through the proxy:

- **Request headers are limited to 16 KiB** (previously 1 MiB). A larger header
  is rejected with status 431.
- **A transfer that makes no progress for 60 seconds is stopped.** This protects
  against slow-request attacks. A transfer that keeps making progress, however
  slowly, is not affected.

Other changes:

- Caddyfile validation is stricter, so a configuration that started before may
  now fail. Step 2 checks the Caddyfile before the change.
- Header fields whose names contain a period are dropped, as fields containing an
  underscore already were.
- The admin `/load` endpoint returns status 400 with a valid JSON body when a
  configuration is invalid (previously 200).
- **Not applicable to this deployment:** fixes for FastCGI and for
  `forward_auth` combined with `reverse_proxy`. This deployment uses neither.

## Test results

| Risk | Result on the test server |
|---|---|
| Stricter validation rejects the Caddyfile | No. `caddy validate` with the new version reported a valid configuration, with one formatting warning that does not affect the service. |
| The 16 KiB header limit breaks sign-in | No. A real access token for this realm is about 1.2 KB, and a token request and an authenticated API call through the proxy both worked. The limit itself was confirmed: a 20 KiB header was accepted by 2.11.4 and rejected (431) by 2.11.6. |
| The 60-second limit cuts off Watcher imports | Not possible. The Watcher connects to STIG Manager and Keycloak directly, not through Caddy. Two Watcher imports completed normally. The limit can affect uploads made through the proxy from a browser or API client, for example a checklist import over a slow connection. |
| The 60-second limit cuts off slow requests | A request that stopped sending data was stopped at 60 seconds on 2.11.6 (on 2.11.4 it stayed open). A request that kept sending 2 bytes per second was not affected and completed. |
| The admin `/load` reload stops working | No. A valid configuration returned 200 and an invalid one returned 400. The site kept serving after both. |

## Before you start

- **The download.** Step 1 downloads `caddy_2.11.6_windows_amd64.zip` from the
  release page (https://github.com/caddyserver/caddy/releases/tag/v2.11.6). Its
  SHA-256 hash must match the digest shown beside the file on that page:
  `07429393375227eb669e449764c5245eaac8fc69fc68b2f867717af794cc1153`.
- **A healthy starting point.** Confirm that the stack is healthy:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
  ```

  Expected result: all five services are Running, and the second command prints
  `200`.
- **Backups.** No backup is needed. Caddy has no database and no configuration
  change, and the old program file kept beside the new one is the rollback.
- **One PowerShell window.** Run every command in one elevated PowerShell
  window, in order. Step 1 sets the `$ver` variable that its second command
  uses.

## Procedure

### 1. Download and verify

```powershell
$ver = '2.11.6'
$url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
(Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
```

The hash must match the digest beside the file on the release page. Then
extract it:

```powershell
Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
```

Expected result: `caddy.exe` is extracted directly into
`C:\Installers\caddy-2.11.6`.

### 2. Check the Caddyfile with the new version

```powershell
C:\Installers\caddy-2.11.6\caddy.exe validate --config C:\Services\caddy\Caddyfile
```

Expected result: `Valid configuration`. A warning about the Caddyfile's
formatting is expected and does not affect the service. If the command reports
an error, fix the Caddyfile before you continue; starting Caddy with a
configuration it rejects leaves the site down.

### 3. Replace the program file and start Caddy

```powershell
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-2.11.4.exe.bak
Copy-Item "C:\Installers\caddy-2.11.6\caddy.exe" C:\Services\caddy\caddy.exe -Force
Start-Service Caddy
C:\Services\caddy\caddy.exe version
```

Expected result: `v2.11.6 h1:sWxeamdlCZvcH4qeDz8bB0mdxgfYTeqV7HxOjXyIRas=`.

### 4. Confirm that the site answers through the proxy

```powershell
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: Caddy is Running, and the second command prints `200`.

## Verify the update

```powershell
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/realms/stigman/.well-known/openid-configuration
```

Expected result: all five services are Running, and both `curl.exe` commands
print `200`.

Then sign in at https://YOUR_SERVER_IP/ in a browser and open a collection. If
a sign-in that worked before now fails, and the browser receives status 431, the
16 KiB header limit is the cause. Raise the limit with the `max_header_size`
server option in the Caddyfile, then reload Caddy as described in Appendix C of
the deployment guide.

If the Watcher is installed, confirm that it still imports: when the next scan
result arrives in its watched folder (by default
`C:\Services\stigman-watcher\watched`), the file name should appear in
`C:\Services\stigman-watcher\watcher-history.txt` after the Watcher's next scan.
The Watcher does not connect through Caddy, so this checks the Watcher itself.

## Roll back

This rollback was not run on the test server, because the new version passed
every check.

```powershell
Stop-Service Caddy
Remove-Item C:\Services\caddy\caddy.exe
Rename-Item C:\Services\caddy\caddy-2.11.4.exe.bak caddy.exe
Start-Service Caddy
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: the last command prints `200`, and
`C:\Services\caddy\caddy.exe version` reports `v2.11.4`. There is no data or
configuration to restore; only the program file changed.

## Not verified

- **Signing in with a browser.** The test server has no browser. Instead, the
  web interface and OIDC discovery answered 200 through the proxy, a service
  account received a token, and an authenticated API call with that token
  succeeded. Sign in with a browser after you apply the update.
- **A backend that stops partway through a response.** The 60-second limit also
  applies when the server side stops sending. That case uses the same mechanism
  and default as the tested request case, but was not tested directly.
- **The rollback.** It was not run.
