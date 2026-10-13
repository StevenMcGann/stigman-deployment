# Update: Keycloak 26.8.0 to 26.8.1

Tested on the twin WIN-TJ87SDPMUPH on 2026-10-13.

## What an administrator should do

Apply it, following guide Step 16.9 as written. This is a security patch release (22 CVE
fixes) that shipped on 2026-10-13; nothing in it changes this deployment's configuration or
behaviour, and the update procedure is unchanged from 26.7.4 → 26.8.0. Keep the
C:\Services\keycloak-26.8.0 folder until you are satisfied, as Step 16.9 says — it is the
rollback.

## What changes

Keycloak 26.8.1 is a patch release in the 26.x line. Security fixes first:

- CVE fixes in **jackson-databind** (#53388, #53393) — the JSON library used throughout
  Keycloak, including OIDC token handling. This is the fix that applies to every deployment.
- **#51887** username enumeration via empty-password timing — the login page this deployment
  serves through Caddy.
- **#53071** cross-realm read/write through a per-request session cache (admin REST API). Two
  realms exist here (master and stigman), so an authenticated admin of one realm is the
  attacker of the other.
- **#53160** the admin API's roles/{role-name}/groups endpoint disclosed groups the caller
  could not view (an incomplete fix from 26.7.2, completed).
- **#52927** (bug, not a CVE) the Admin Console's per-session "Sign out" could terminate a
  different, unrelated session of the same user.
- **#53070** 2FA setup enforcement bypass via /realms/{realm}/login-actions/restart — the
  stigman realm does not enforce 2FA today, so this is latent protection, not a live fix.

Everything else in the release does not apply to this deployment, in one line each: all
identity-brokering fixes (#50945, #51381, #52321, #53471, #52984), SAML (#53116, #53354),
fine-grained admin permissions (#53057, #53060, #53158, #53417, #53693), Authorization
Services/UMA (#53072, #53073), PAR (#53111), token exchange (#53187, #52139, #53029), X.509
(#53419, #52063, #52982), Kerberos (#53159, #52680), SMTP (#53674 — no SMTP server is
configured in the realm), conditional OTP (#53112 — no OTP flows are configured),
revokeRefreshToken race (#51312 — the option is off), clustering/JGroups (#53824, #53825,
#53430 — this is a single-node server), organizations (#49786, #52449), Docker registration
endpoint (#49009), broker-endpoint metrics (#53338), and simple-git (#53582, a build-time
tool).

The 26.8.1 migration guide was read in full: every breaking and notable change targets a
feature listed above as not in use, so no configuration change is required. No realm
export/import work; Keycloak migrates its own schema automatically, and in this patch
release it logged no migration lines at all — the schema did not change.

LDAPS federation with Active Directory (production): the release contains no LDAP or
federation fixes that would change LDAPS behaviour. The FGAP item (#53693) concerns
fine-grained admin permissions, which are not used.

## What might break, and what the twin showed

| Concern | Tested on the twin? | Result |
|---|---|---|
| kc.bat build fails against a stale JAVA_HOME | Yes — hit it. The first build attempt, run in a fresh window without re-setting `$env:JAVA_HOME`, failed: a user-level JAVA_HOME still named `jdk-17.0.19.10`, whose `bin\java.exe` the 17.0.20.1 update had removed. Setting `$env:JAVA_HOME` from the service XML as Step 16.9 step 4 says fixed it. | Build then completed: "Server configuration updated and persisted", exit code 0. The guide's step-4 wording was widened to name the user-level variable as well as the machine-wide one; the stale variable was removed from the twin. |
| Schema migration on first start | Yes — watched the start log | No migration lines (patch release, schema unchanged); "Keycloak 26.8.1 ... started in 11.126s", "Profile prod activated" |
| Service re-point loses dependencies or start type | Yes — `sc.exe qc Keycloak` after the change | BINARY_PATH_NAME names the new folder; DEPENDENCIES still MySQL84; START_TYPE still AUTO_START (DELAYED) |
| OIDC login broken | Yes — realm discovery direct and through Caddy; a service-account token issued through the proxy and an authenticated API call | `http://localhost:8080/realms/stigman/.well-known/openid-configuration` 200; `https://localhost/realms/stigman/.well-known/openid-configuration` 200; token issued, API call answered (1 collection) |
| Watcher cannot authenticate or import | Yes — the Watcher restarted and then a scan result was placed in its watched folder | Preflight token request and API requests succeeded at startup; the placed MS_Edge XCCDF file was queued, parsed, and posted: 56 reviews updated, 0 rejected, file recorded in watcher-history.txt |
| Brute-force lockout behaves differently | No — unchanged from 26.8.0 (lockouts stored in the database, survive restart); no release note touches it | Not re-tested |

## Before you start

- The download: `keycloak-26.8.1.zip` in C:\Installers, with its SHA-256 compared against the
  digest shown on the GitHub release page (on the twin it was
  `4CD312C889AF358A819A74A6C6F068F9EA159A6959E49924607CEC95CFD4C1A4`, 174,193,327 bytes).
- A backup of the keycloak.conf and the keycloak database schema (step 1 below makes both).
- About 15 minutes with the three dependent services stopped; users cannot log in while
  Keycloak is down.
- Check first, and the answer that means "go on":
  `Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher` — all Running.
  `curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration` — 200.

## Procedure

Run from one elevated PowerShell window, in this order. Do not open a new window between
setting `$env:JAVA_HOME` and running the build.

### 1. Back up

```
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item C:\Services\keycloak-26.8.0\conf\keycloak.conf "C:\Backups\keycloak.conf.$stamp.bak"
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root --databases keycloak --routines --triggers --single-transaction --result-file="C:\Backups\keycloak-db-$stamp.sql"
$env:MYSQL_PWD = $null
```

Correct result: both files exist in C:\Backups and mysqldump prints no error. On the twin the
dump was 327,118 bytes, exit code 0. Type the real MySQL root password; never save it in a
file or a script.

### 2. Download, verify, and extract

```
$ver = '26.8.1'
Invoke-WebRequest -Uri "https://github.com/keycloak/keycloak/releases/download/$ver/keycloak-$ver.zip" -OutFile "C:\Installers\keycloak-$ver.zip"
(Get-FileHash "C:\Installers\keycloak-$ver.zip" -Algorithm SHA256).Hash
```

Compare that hash with the SHA-256 digest shown beside the file on the GitHub release page.
Only if they match:

```
Expand-Archive "C:\Installers\keycloak-26.8.1.zip" -DestinationPath C:\Services
```

Correct result: `Test-Path C:\Services\keycloak-26.8.1\bin\kc.bat` prints True.

### 3. Migrate configuration into the new folder

```
$old = 'C:\Services\keycloak-26.8.0'; $new = 'C:\Services\keycloak-26.8.1'
Copy-Item "$old\conf\*" "$new\conf" -Recurse -Force
Copy-Item "$old\keycloak-svc.exe" "$new\keycloak-svc.exe" -Force
Copy-Item "$old\keycloak-svc.xml" "$new\keycloak-svc.xml" -Force
```

Correct result: `$new\conf` contains keycloak.conf, cache-ispn.xml and the truststores
subfolder, exactly as the old folder does.

### 4. Build for optimized start

```
$svc = [xml](Get-Content "$new\keycloak-svc.xml" -Raw)
$env:JAVA_HOME = ($svc.service.env | Where-Object { $_.name -eq 'JAVA_HOME' }).value
Test-Path $env:JAVA_HOME    # must print True
cd C:\Services\keycloak-26.8.1
.\bin\kc.bat build
```

Correct result: the build ends with "Server configuration updated and persisted". The
"run time options ... ignored during build time" message is normal. If it fails with
"...does not exist", your window inherited a stale JAVA_HOME — re-run the two
`$env:JAVA_HOME` lines and the build in the same window.

### 5. Cut over the service

```
Stop-Service STIGManagerWatcher; Stop-Service STIGManager; Stop-Service Keycloak
sc.exe config Keycloak binPath= "C:\Services\keycloak-26.8.1\keycloak-svc.exe"
sc.exe qc Keycloak
```

Correct result: BINARY_PATH_NAME names keycloak-26.8.1; DEPENDENCIES still lists MySQL84.
Type `sc.exe`, not `sc` (that is Set-Content), and keep the space after `binPath=`.

### 6. Start in order and verify

```
Start-Service Keycloak
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher
Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.out.log -Tail 15
(Invoke-RestMethod 'http://localhost:8080/realms/stigman/.well-known/openid-configuration').issuer
```

Correct result: the loop prints 200 (a 000 while Keycloak starts is normal; on the twin it
was 200 after 10 seconds). The log shows "Keycloak 26.8.1 ... started" and "Profile prod
activated" — this patch release logged no migration lines. The issuer is your server's realm
URL. If the Watcher does not come up first time, start it a second time — it loses the start
race after STIG Manager restarts.

## Check that it worked

```
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

All five services Running; both addresses answer 200. Then log in through
https://YOUR_SERVER_IP/ in a browser and open a collection — that confirms the interactive
OIDC path no shell command covers. If the Watcher is installed, place a scan result in its
watched folder and confirm on its next scan that the file appears in its history file.

On the twin, beyond those checks, a service-account token was issued through the proxy and
an authenticated API call answered, and a placed MS_Edge XCCDF result was imported by the
Watcher (56 reviews updated, 0 rejected).

## Undo

Keep C:\Services\keycloak-26.8.0 until you are satisfied. To undo:

```
Stop-Service STIGManagerWatcher; Stop-Service STIGManager; Stop-Service Keycloak
sc.exe config Keycloak binPath= "C:\Services\keycloak-26.8.0\keycloak-svc.exe"
```

then start again in the order of step 6 and repeat the checks. Because this patch release
made no schema change (no migration lines on first start), the 26.8.0 folder starts against
the database exactly as it left it; the database dump from step 1 is not needed unless
Keycloak refuses to start. The undo was NOT run on the twin: the update was verified and the
twin stays on 26.8.1.

## Not verified

- A person's browser login through https:// — there is no browser session on the twin. The
  service-account sign-in and the realm's discovery endpoints were verified instead. Do the
  browser login on production after applying.
- Admin Console interactive flows, including the #52927 per-session sign-out fix — needs an
  interactive admin login.
- CKL / CKLB export from the web UI — needs a browser session.
- LDAPS federation with Active Directory — not configured on the twin; no LDAP fixes are in
  this release, so nothing suggests a change in that behaviour.
- Production servers' own environment (the JAVA_HOME trap depends on each server's user-level
  variables; the guide now covers it either way).
