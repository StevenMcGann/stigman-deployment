# Update: Keycloak 26.8.1 to 26.8.2

Tested on a test server on 2026-11-06, including the rollback.

## Summary

Apply this update. Keycloak 26.8.2, released on 2026-11-05, is a security
release with 34 vulnerability fixes, including a stored cross-site scripting
fault on the sign-in page and a session-takeover fault in the logout path. It
requires no configuration changes, and the procedure is the same as for earlier
Keycloak updates in the 26.x series.

Allow about 15 minutes. Keycloak, STIG Manager and the Watcher are stopped from
step 5 until step 6 is complete, and users cannot sign in during that time. Keep
the `C:\Services\keycloak-26.8.1` folder until you have verified the update; the
rollback uses it.

One change in this release reduces what a delegated administrator may do: from
26.8.2 onwards, creating, changing or removing a protocol mapper on a client
needs permission to manage the realm, not only permission to manage clients. If
your site has administrators who hold only "Manage clients" and who also edit
protocol mappers, give them the realm-level "Allowed protocol mapper types for
client administrators" option in the realm settings, or have a realm
administrator make those changes. The installation scripts in `install\` are not
affected: they use the built-in `admin-cli` client and continue to work
unchanged.

## What changes

Security fixes that apply to this deployment:

- **CVE-2026-107889.** Stored cross-site scripting on the login page through a
  bypass of the input sanitiser. This is the sign-in page that every person uses
  to reach STIG Manager.
- **CVE-2026-107124.** Session takeover: a logout request carrying an
  injected `id_token_hint` could end another user's session and let the attacker
  take it over.
- **CVE-2026-112201.** The record of a failed sign-in trusted the number of rows
  the database reported as changed. This deployment runs MySQL 8.4 and its realm
  has brute-force protection switched on, so the count that decides whether a
  user is locked out comes straight from this path.
- **CVE-2026-103112.** Account takeover through a race in authentication.
- **CVE-2026-96447.** Stateless tokens could fall back to a `preferred_username`
  that let an identity be bound to a different account after a client was
  recreated.
- **CVE-2026-97848.** A protocol mapper with `jsonType=JSON` could forge a
  `resource_access` claim, bypassing the earlier fix for the same problem.
- **CVE-2026-111497.** Out-of-bounds write in the bundled Brotli decoder.
- **CVE-2026-19688.** The Admin REST API accepted any access token whose
  subject held administrative rights, whatever the token had been issued for.
- **CVE-2026-97847, CVE-2026-96457 and CVE-2026-109081.** Realm administration
  hardening: a client manager could take over the realm, a group administrator
  could move a group past a deny rule, and a principal holding only
  "Create client" could add a role to the realm's default roles.
- **CVE-2026-96453.** `kcadm` and `kcreg` accepted any self-signed server
  certificate when they were given a custom trust store. See "Other changes"
  below for the one case in which this matters.

Changes in behaviour that apply to this deployment:

- **The Admin REST API now checks the audience of the token.** Keycloak creates
  a built-in client scope named `kc-admin-api` in every realm and adds it as a
  default scope to the built-in `admin-cli` and `security-admin-console`
  clients. A token from any other client or service account is refused with
  HTTP 401 unless that client has the scope as well. On the test server the
  admin token issued by `admin-cli` changed from the scopes "profile email" with
  no audience to the scopes "kc-admin-api profile email" with the audience of
  this realm's Admin REST API, and every Admin REST API call used by the
  installation scripts continued to answer HTTP 200 — including the calls that
  a token from the master realm makes against the `stigman` realm. The scripts
  in `install\` therefore need no change.
- **Protocol mapper management needs permission to manage the realm.** Before
  this release, an administrator who held only "Manage clients" could create,
  change or remove protocol mappers on clients and client scopes, which could
  be used to map administrative roles or other sensitive claims into a token.
  From 26.8.2 onwards that requires permission to manage the realm, unless the
  realm administrator allows specific mapper types in the realm settings.
- **Client registration policies restrict default roles and full scope.**
  Dynamic Client Registration can no longer change the realm's default-role
  composite or turn on "Full scope allowed". This deployment does not use
  Dynamic Client Registration.
- **Automatic account linking needs a trusted email address.** An identity
  provider that does not report the address as verified is refused unless
  "Trust Email" is switched on for that provider. This deployment does not use
  identity brokering.
- **User storage synchronisation runs at the configured period again.** A
  regression in earlier 26.x releases made the effective interval about twice
  the configured value whenever one synchronisation took longer than about a
  second. If your site federates with Active Directory over LDAPS and you
  lowered `fullSyncPeriod` or `changedSyncPeriod` to compensate, review those
  two values.
- **Rolling upgrades are not supported by this release.** The release installs a
  new client registration policy that earlier 26.8.x servers do not know. This
  server runs a single Keycloak instance, which is stopped before the new
  version starts, so the upgrade is not a rolling one.
- **A database change that is not a schema change.** Keycloak records its new
  version in the `MIGRATION_MODEL` table and adds the `kc-admin-api` client
  scope to each realm. It changed no table and added no Liquibase changeset, so
  the rollback below does not need the database backup.
- **Not applicable to this deployment:** fixes for SAML (several denial of
  service and assertion-validation faults, the SAML 1.1 parser, the SAML
  redirect-binding signature bypass, holder-of-key assertions and `ProxyRestriction`
  handling), the organisation features, the Device Authorization Grant, Dynamic
  Client Registration, CIBA, UMA, token exchange, and identity brokering. The
  one exception to the SAML list is CVE-2026-96453 above: it applies to `kcadm`
  or `kcreg` only when they are given a custom trust store, and then only to a
  server certificate that is self-signed and not imported into that trust store.
  This deployment's Keycloak serves plain HTTP behind Caddy and uses the
  public trust store, so nothing changes.

## Test results

| Risk | Result on the test server |
|---|---|
| The new Admin REST API audience check breaks the installation scripts | It did not. The admin token gained the `kc-admin-api` scope and an audience, and all nine Admin REST API calls that `install\Import-Realm.ps1` and `install\Install-Watcher.ps1` make — including the calls a master-realm token makes against the `stigman` realm — answered HTTP 200 before and after the update. |
| The new protocol mapper rule breaks a delegated administrator | It does, as intended, and the change was measured on both versions: a user holding only "Manage clients" created a protocol mapper and received HTTP 201 on 26.8.1, and HTTP 403 on 26.8.2. A realm administrator received HTTP 201 on both. Reading protocol mappers was still allowed (HTTP 200) on both. |
| The realm import in Section 4.4 no longer works | It works. A realm was created through the same Admin REST API call the script makes, with a client that carries a protocol mapper; the mapper was imported with the realm, and the new realm was given the `kc-admin-api` client scope automatically. The test realm was deleted afterwards. |
| `kc.bat build` fails because JAVA_HOME names a removed JDK | It did not. The JAVA_HOME was read from the service file, as step 4 does, and the build finished in 20 seconds with "Server configuration updated and persisted". |
| The first start migrates the database | It did, and it was a data migration only: the log showed "migrated realm stigman to 26.8.2" and "migrated realm master to 26.8.2". The table count stayed at 101 and no new row appeared in `DATABASECHANGELOG`; the only new row was the 26.8.2 entry in `MIGRATION_MODEL`. |
| Changing the service loses its dependencies or start type | It did not. `sc.exe qc Keycloak` still showed delayed automatic start and the MySQL84 dependency after the change. |
| Sign-in through OIDC breaks | It did not. Realm discovery answered 200 directly and through Caddy, and the Watcher service account received a token through the proxy and made an authenticated API call. |
| A browser sign-in breaks | It did not. A browser signed in at the approved address over HTTP/2, the application loaded with 80 resources and the service worker active, and there were no failed requests and no console errors. |
| Sign-out breaks | It did not. A browser signed in, ended the session at Keycloak's logout endpoint, and the application then asked for the account to sign in again. No console errors. |
| The Watcher cannot sign in or import | It did not. The Watcher signed in at startup, and a scan result placed in its watched folder was imported: the asset and its STIG data were received and the file was queued for parsing. The Watcher reported "no reviews to post" because the file was a copy of a result already stored, which is the normal message for a file with nothing new in it. |
| Checklist export breaks | It did not. The CKL export returned 157,267 bytes and the CKLB export 274,486 bytes. |
| The rollback fails once 26.8.2 has used the database | It did not. The rollback below was run after the update: 26.8.1 started, the stack was healthy, and the database backup was not needed. 26.8.2 was then applied again and the stack was healthy on it. |

## Before you start

- **The download.** Step 2 downloads `keycloak-26.8.2.zip` to `C:\Installers`.
  You will compare its SHA-256 hash with the digest shown beside the file on the
  GitHub release page. On the test server the hash was
  `321FFEE62EC28FAB18FE885D8CD62CC814EDCE72A35CD062DC81B504C1A406B3` and the
  file was 173,780,410 bytes.
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
Copy-Item C:\Services\keycloak-26.8.1\conf\keycloak.conf "C:\Backups\keycloak.conf.$stamp.bak"
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root --databases keycloak --routines --triggers --single-transaction --result-file="C:\Backups\keycloak-db-$stamp.sql"
$env:MYSQL_PWD = $null
```

Expected result: both files exist in `C:\Backups`, and mysqldump prints nothing.
On the test server the database backup was 328,436 bytes.

### 2. Download, verify and extract

```powershell
$ver = '26.8.2'
Invoke-WebRequest -Uri "https://github.com/keycloak/keycloak/releases/download/$ver/keycloak-$ver.zip" -OutFile "C:\Installers\keycloak-$ver.zip"
(Get-FileHash "C:\Installers\keycloak-$ver.zip" -Algorithm SHA256).Hash
```

Compare the hash with the SHA-256 digest shown beside the file on the GitHub
release page. Continue only if they match:

```powershell
Expand-Archive "C:\Installers\keycloak-26.8.2.zip" -DestinationPath C:\Services
```

Expected result: `Test-Path C:\Services\keycloak-26.8.2\bin\kc.bat` prints
`True`.

### 3. Copy the configuration into the new folder

```powershell
$old = 'C:\Services\keycloak-26.8.1'; $new = 'C:\Services\keycloak-26.8.2'
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
cd C:\Services\keycloak-26.8.2
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
sc.exe config Keycloak binPath= "C:\Services\keycloak-26.8.2\keycloak-svc.exe"
sc.exe qc Keycloak
```

Expected result: `BINARY_PATH_NAME` names `keycloak-26.8.2`, and `DEPENDENCIES`
still lists MySQL84. Type `sc.exe`, not `sc` (in PowerShell, `sc` runs
`Set-Content`), and keep the space after `binPath=`.

### 6. Start the services in order

```powershell
Start-Service Keycloak
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher
Get-Content C:\Services\keycloak-26.8.2\keycloak-svc.out.log -Tail 15
(Invoke-RestMethod 'http://localhost:8080/realms/stigman/.well-known/openid-configuration').issuer
```

Expected result: the loop prints `000` while Keycloak starts, then `200` (after
about 10 seconds on the test server). The log shows `Keycloak 26.8.2 ... started`
and `Profile prod activated`. On the first start after the upgrade it also shows
`migrated realm stigman to 26.8.2` and `migrated realm master to 26.8.2`; a
later start shows no migration lines, because the database has already been
migrated. The issuer is your server's realm address. If the Watcher does not
start the first time, start it again; it can fail to start when STIG Manager has
only just started.

## Verify the update

```powershell
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

Expected result: all five services are Running, and both `curl.exe` commands
print `200`.

Then sign in at https://YOUR_SERVER_IP/ in a browser, open a collection, and
sign out again. This tests the interactive sign-in and sign-out paths, which
the commands above do not. If the Watcher is installed, confirm that it still
imports: when the next scan result arrives in its watched folder (by default
`C:\Services\stigman-watcher\watched`), the file name should appear in
`C:\Services\stigman-watcher\watcher-history.txt` after the Watcher's next
scan.

## Roll back

Keep `C:\Services\keycloak-26.8.1` until you have verified the update. To roll
back, point the service at the old folder:

```powershell
Stop-Service STIGManagerWatcher; Stop-Service STIGManager; Stop-Service Keycloak
sc.exe config Keycloak binPath= "C:\Services\keycloak-26.8.1\keycloak-svc.exe"
```

Then start the services in the order of step 6, and read the log in the old
folder, because that is the version now running:

```powershell
Start-Service Keycloak
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher
Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.out.log -Tail 15
```

Then repeat the checks in "Verify the update".

The rollback was run on the test server on 2026-11-06, after the update, and the
server was then returned to 26.8.2. The results:

- The loop printed `000`, `000`, `200`: Keycloak 26.8.1 answered about 15
  seconds after `Start-Service`.
- The 26.8.1 log shows `Keycloak 26.8.1 ... started` and one warning, which is
  expected after a rollback. Keycloak starts anyway:
  `WARN [org.keycloak.storage.datastore.DefaultMigrationManager] Possibly incorrect state of migration. You are trying to run server version '26.8.1' against database, which was already migrated to newer version '26.8.2'.`
- Do not read the 26.8.2 log after a rollback. It ends with "Keycloak stopped",
  from the stop you just performed, which looks like a failed start.
- All five services were Running and both `curl.exe` commands printed `200`.
- The database backup from step 1 was not needed: 26.8.2 added no table and no
  Liquibase changeset, so 26.8.1 runs on the migrated database without error.

The rollback is safe without a database restore because 26.8.2 changed no
database schema, and 26.8.1 accepts the newer version entry with a warning. This
is true of this release only. If a future release changes the schema, plan to
restore the step 1 backup as part of its rollback.

## Not verified

- **The stored cross-site scripting fault on the login page (CVE-2026-107889).**
  The fault was not reproduced. The sign-in page was loaded in a browser and
  rendered normally, with no console errors.
- **The session takeover through an injected `id_token_hint` (CVE-2026-107124).**
  The attack was not reproduced. The logout path was tested for correct
  behaviour, not against the attack. The session notes that this release adds
  could not be watched either, because this deployment keeps user sessions in
  memory rather than in the database.
- **The failed sign-in count on MySQL (CVE-2026-112201).** The fault depends on
  the number of rows the database reports as changed, which cannot be made to
  misreport from outside the server. The brute-force protection was left as it
  is.
- **LDAPS federation to Active Directory.** The test server has no Active
  Directory. The user-storage synchronisation change in this release is
  described under "What changes"; it affects only realms that federate.
- **The Admin Console.** Its screens were not walked through by hand. The Admin
  REST API that the console uses was tested.
- **Dynamic Client Registration.** It is not used by this deployment.
- **A clustered rolling upgrade.** This server runs a single Keycloak instance.
