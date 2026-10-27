# Update: Keycloak 26.8.0 to 26.8.1

Tested on a test server on 2026-10-13, including the rollback.

## Summary

Apply this update. Keycloak 26.8.1, released on 2026-10-13, is a security patch
release with 22 vulnerability fixes. It requires no configuration changes, and
the procedure is the same as for earlier Keycloak updates in the 26.x series.

Allow about 15 minutes. Keycloak, STIG Manager and the Watcher are stopped from
step 5 until step 6 is complete, and users cannot sign in during that time. Keep
the `C:\Services\keycloak-26.8.0` folder until you have verified the update; the
rollback uses it.

## What changes

Security fixes that apply to this deployment:

- **jackson-databind** (#53388, #53393). Vulnerability fixes in the JSON library
  that Keycloak uses throughout, including for OIDC token handling. This applies
  to every deployment.
- **#51887.** Usernames could be discovered from the response time of sign-in
  attempts with an empty password. This affects the sign-in page that this
  deployment serves through Caddy.
- **#53071.** A session cache in the admin REST API allowed reads and writes
  across realms. This server has two realms (master and stigman), so an
  administrator of one realm could have reached the other.
- **#53160.** The admin API's `roles/{role-name}/groups` endpoint disclosed
  groups the caller was not allowed to view. This completes an incomplete fix
  from 26.7.2.
- **#53070.** Two-factor setup could be bypassed through
  `/realms/{realm}/login-actions/restart`. The stigman realm does not require
  two-factor authentication today, so this fix has no immediate effect here.

Other changes:

- **#52927** (a bug fix, not a security fix). In the Admin Console, signing out
  one session of a user could end a different session of the same user.
- **Semicolons in query strings.** Keycloak no longer treats a semicolon as a
  separator between query parameters (`?a=1;b=2` is now one parameter, not
  two). This is the one change in the 26.8.1 migration guide that applies to
  every deployment. STIG Manager's web client and the Watcher separate
  parameters with `&`. If anything else at your site signs in through this
  Keycloak, check that it does not use semicolons.
- **Database.** Keycloak made no schema changes on its first start. It records
  its new version in its `MIGRATION_MODEL` table, which the older version notices
  after a rollback (see "Roll back"). No realm export or import is needed.
- **LDAPS to Active Directory.** The release contains no LDAP or federation
  fixes that would change LDAPS behavior.
- **Not applicable to this deployment:** fixes for identity brokering, SAML,
  fine-grained admin permissions, Authorization Services, PAR, token exchange,
  X.509, Kerberos, SMTP, conditional OTP, refresh token revocation, clustering,
  organizations, the Docker registry endpoint, metrics, dynamic client
  registration and a build tool, and several small internal fixes with nothing
  for an administrator to do. The breaking changes in the migration guide all
  concern features in this list.

## Test results

| Risk | Result on the test server |
|---|---|
| `kc.bat build` fails because JAVA_HOME names a removed JDK | It failed once: a user-level JAVA_HOME still named a JDK folder that an earlier Java update had removed. Setting JAVA_HOME from the service file, as step 4 does, fixed it, and the build completed. |
| The first start migrates the database | No migration ran. Keycloak logged `Keycloak 26.8.1 ... started in 11.126s` and `Profile prod activated`. |
| Changing the service loses its dependencies or start type | No. After the change, the service still depended on MySQL84 and still started automatically (delayed start). |
| Sign-in through OIDC breaks | No. Realm discovery answered 200 directly and through Caddy. A service account received a token through the proxy and made an authenticated API call. |
| The Watcher cannot sign in or import | No. The Watcher signed in at startup, and a scan result placed in its watched folder was imported: 56 reviews updated, none rejected. |
| The rollback fails once 26.8.1 has used the database | The rollback below was run after the update, and 26.8.1 was then restored. Keycloak 26.8.0 started in about 20 seconds with one expected warning, the stack was healthy, and the database backup was not needed. |
| Brute-force lockout behaves differently | Not tested. Lockout behavior is unchanged from 26.8.0, and no release note concerns it. |

## Before you start

- **The download.** Step 2 downloads `keycloak-26.8.1.zip` to `C:\Installers`.
  You will compare its SHA-256 hash with the digest shown beside the file on the
  GitHub release page. On the test server the hash was
  `4CD312C889AF358A819A74A6C6F068F9EA159A6959E49924607CEC95CFD4C1A4` and the
  file was 174,193,327 bytes.
- **MySQL root password.** Step 1 needs it. Type it where the command shows
  `<mysql-root-password>`, and do not save it in a file or script.
- **One PowerShell window.** Run every command in one elevated PowerShell
  window, in order. Do not open a new window between setting `$env:JAVA_HOME`
  and running the build in step 4.
- **A healthy starting point.** Confirm that the stack is healthy:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
  ```

  Expected result: all five services are Running, and the second command prints
  `200`.

## Procedure

### 1. Back up the configuration and the database

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item C:\Services\keycloak-26.8.0\conf\keycloak.conf "C:\Backups\keycloak.conf.$stamp.bak"
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root --databases keycloak --routines --triggers --single-transaction --result-file="C:\Backups\keycloak-db-$stamp.sql"
$env:MYSQL_PWD = $null
```

Expected result: both files exist in `C:\Backups`, and mysqldump prints nothing.
On the test server the database backup was 327,118 bytes.

### 2. Download, verify and extract

```powershell
$ver = '26.8.1'
Invoke-WebRequest -Uri "https://github.com/keycloak/keycloak/releases/download/$ver/keycloak-$ver.zip" -OutFile "C:\Installers\keycloak-$ver.zip"
(Get-FileHash "C:\Installers\keycloak-$ver.zip" -Algorithm SHA256).Hash
```

Compare the hash with the SHA-256 digest shown beside the file on the GitHub
release page. Continue only if they match:

```powershell
Expand-Archive "C:\Installers\keycloak-26.8.1.zip" -DestinationPath C:\Services
```

Expected result: `Test-Path C:\Services\keycloak-26.8.1\bin\kc.bat` prints
`True`.

### 3. Copy the configuration into the new folder

```powershell
$old = 'C:\Services\keycloak-26.8.0'; $new = 'C:\Services\keycloak-26.8.1'
Copy-Item "$old\conf\*" "$new\conf" -Recurse -Force
Copy-Item "$old\keycloak-svc.exe" "$new\keycloak-svc.exe" -Force
Copy-Item "$old\keycloak-svc.xml" "$new\keycloak-svc.xml" -Force
```

Expected result: `$new\conf` contains `keycloak.conf`, `cache-ispn.xml` and the
`truststores` folder, as the old folder does.

### 4. Build Keycloak for optimized start

```powershell
$svc = [xml](Get-Content "$new\keycloak-svc.xml" -Raw)
$env:JAVA_HOME = ($svc.service.env | Where-Object { $_.name -eq 'JAVA_HOME' }).value
Test-Path $env:JAVA_HOME
cd C:\Services\keycloak-26.8.1
.\bin\kc.bat build
```

Expected result: `Test-Path` prints `True`, and the build ends with
`Server configuration updated and persisted`. A message that run-time options
are ignored during the build is normal. If the build fails with
"...does not exist", the window has an outdated JAVA_HOME: run the two
`$env:JAVA_HOME` lines and the build again in the same window.

### 5. Point the service at the new folder

```powershell
Stop-Service STIGManagerWatcher; Stop-Service STIGManager; Stop-Service Keycloak
sc.exe config Keycloak binPath= "C:\Services\keycloak-26.8.1\keycloak-svc.exe"
sc.exe qc Keycloak
```

Expected result: `BINARY_PATH_NAME` names `keycloak-26.8.1`, and `DEPENDENCIES`
still lists MySQL84. Type `sc.exe`, not `sc` (in PowerShell, `sc` runs
`Set-Content`), and keep the space after `binPath=`.

### 6. Start the services in order

```powershell
Start-Service Keycloak
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher
Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.out.log -Tail 15
(Invoke-RestMethod 'http://localhost:8080/realms/stigman/.well-known/openid-configuration').issuer
```

Expected result: the loop prints `000` while Keycloak starts, then `200` (after
about 10 seconds on the test server). The log shows `Keycloak 26.8.1 ... started`
and `Profile prod activated`; this release logs no migration lines. The issuer
is your server's realm address. If the Watcher does not start the first time,
start it again; it can fail to start when STIG Manager has only just started.

## Verify the update

```powershell
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: all five services are Running, and both `curl.exe` commands
print `200`.

Then sign in at https://YOUR_SERVER_IP/ in a browser and open a collection.
This tests the interactive sign-in path, which the commands above do not. If the
Watcher is installed, confirm that it still imports: when the next scan result
arrives in its watched folder (by default `C:\Services\stigman-watcher\watched`),
the file name should appear in `C:\Services\stigman-watcher\watcher-history.txt`
after the Watcher's next scan.

## Roll back

Keep `C:\Services\keycloak-26.8.0` until you have verified the update. To roll
back, point the service at the old folder:

```powershell
Stop-Service STIGManagerWatcher; Stop-Service STIGManager; Stop-Service Keycloak
sc.exe config Keycloak binPath= "C:\Services\keycloak-26.8.0\keycloak-svc.exe"
```

Then start the services in the order of step 6, and read the log in the old
folder, because that is the version now running:

```powershell
Start-Service Keycloak
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher
Get-Content C:\Services\keycloak-26.8.0\keycloak-svc.out.log -Tail 15
```

Then repeat the checks in "Verify the update".

The rollback was run on the test server on 2026-10-13, after the update, and the
server was then returned to 26.8.1. The results:

- The loop printed `000`, `000`, `200`: Keycloak 26.8.0 answered about 20
  seconds after `Start-Service`.
- The 26.8.0 log shows `Keycloak 26.8.0 ... started` and one warning, which is
  expected after a rollback. Keycloak starts anyway:
  `WARN [org.keycloak.storage.datastore.DefaultMigrationManager] Possibly incorrect state of migration. You are trying to run server version '26.8.0' against database, which was already migrated to newer version '26.8.1'.`
- Do not read the 26.8.1 log after a rollback. It ends with "Keycloak stopped",
  from the stop you just performed, which looks like a failed start.
- All five services were Running, both `curl.exe` commands printed `200`, and a
  service account signed in through the proxy. `sc.exe qc Keycloak` still showed
  delayed automatic start and the MySQL84 dependency.
- The database backup from step 1 was not needed, and 26.8.0 changed nothing in
  the database.

The rollback was safe without a database restore because 26.8.1 changed no
database schema, and 26.8.0 accepts the newer version entry with a warning. This
is true of this release only. If a future release changes the schema, plan to
restore the step 1 backup as part of its rollback.

## Not verified

- **Signing in with a browser.** The test server has no browser. A service
  account's sign-in and the realm's discovery endpoints were tested instead.
  Sign in with a browser after you apply the update.
- **Admin Console actions**, including the sign-out fix (#52927). These need an
  interactive administrator sign-in.
- **Checklist export.** Exporting CKL and CKLB files from the web interface
  needs a browser and was not tested.
- **LDAPS to Active Directory.** The test server has no LDAPS connection. The
  release contains no LDAP fixes, so no change in that behavior is expected.
- **Restoring the database backup.** The rollback did not need it. The restore
  commands were tested separately on 2026-10-16 and are in Step 16.9 of the
  deployment guide.
- **A Watcher import on 26.8.0 after the rollback.** Only the Watcher's sign-in
  was checked in that state. The import was tested on 26.8.1, before the
  rollback and after returning to 26.8.1.
