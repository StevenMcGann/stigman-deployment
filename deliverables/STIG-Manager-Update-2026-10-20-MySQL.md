# Update: MySQL 8.4.11 to 8.4.13

Tested on a test server on 2026-10-20, including the rollback.

## Summary

Apply this update at the next maintenance window. MySQL 8.4.13 is Oracle's
October 2026 Critical Patch Update for the MySQL 8.4 LTS series. Oracle's
advisory lists 67 vulnerabilities that affect MySQL Server 8.4.0 through 8.4.12,
15 of which can be exploited over a network without credentials. The highest
CVSS score among them is 9.8. Version 8.4.13 is the fixed release for Windows.

Plan for about 15 minutes of downtime. MySQL, Keycloak, STIG Manager and the
Watcher are stopped during the update, and users cannot sign in until they are
running again. No configuration changes are required.

## What changes

- **Security.** This release fixes the vulnerabilities in Oracle's October 2026
  Critical Patch Update. The advisory lists 8.4.12 as the last affected version.
- **mysqldump.** This release fixes how mysqldump processes and validates
  identifiers that the server supplies. The backup in step 2 uses mysqldump.
- **Reliability.** This release includes several InnoDB crash and corruption
  fixes, a fix to how account host names are matched, and Windows fixes for
  console output and long query identifiers. The bundled libevent library is
  upgraded to 2.1.13.
- **Automatic upgrade on first start.** The first start of 8.4.13 upgrades the
  data dictionary automatically, in about five seconds. There is nothing to run
  by hand.
- **Version reporting.** The error log also prints a four-part version
  (`Server version with update: '8.4.13.0'`). `VERSION()` and `@@version` still
  return `8.4.13`, so existing version checks are not affected.
- **Not applicable to this deployment:** fixes for replication and Group
  Replication, X Plugin, Audit Log, mysqlbinlog, clone, telemetry, the WebAuthn
  client and Linux packaging, and an optimizer fix that applies only when
  `index_merge_union` is turned off. This deployment uses the default setting.

## Test results

| Risk | Result on the test server |
|---|---|
| The new version cannot use the existing data directory | MySQL started cleanly. The automatic data dictionary upgrade completed in about five seconds. |
| The databases are changed or damaged | The stigman database (35 tables, 5 views, 12 routines) and the keycloak database (101 tables) had the same object counts before the update, after it, and after the rollback. |
| Settings saved with SET PERSIST are lost | Kept. `binlog_expire_logs_seconds` was still 604800. |
| The installer changes the MySQL84 service | No change. The service definition was identical before and after, and the installer log shows no service actions. |
| Keycloak, STIG Manager or the Watcher fail on 8.4.13 | All five services ran and the health checks passed. A service account signed in through the proxy, and a Watcher import posted 56 review updates. |
| The update cannot be rolled back | The rollback below was run in full. Version 8.4.11 started, downgraded the data dictionary automatically, and the stack was healthy. The server was then updated to 8.4.13 again with the same results. |

## Before you start

- **Maintenance window.** Allow about 15 minutes.
- **MySQL root password.** Several steps need it. Type it where a command shows
  `<mysql-root-password>`, and do not save it in a file or script. Each command
  block clears it again with `$env:MYSQL_PWD = $null`.
- **One PowerShell window.** Run every command in one elevated PowerShell
  window, in order. Later steps use variables that earlier steps set.
- **The 8.4.11 installer.** A rollback reinstalls 8.4.11, so keep
  `C:\Installers\mysql-8.4.11-winx64.msi`. If it is not there, download it with
  the commands in step 3, replacing `8.4.13` with `8.4.11`. On the test server
  its SHA-256 hash was
  `90D71A61E2DBFD271D81FEFA32867199EB6E1430AB8CEEFB8E976FDF684C7AAB`.
- **A healthy starting point.** Confirm that the stack is healthy:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
  ```

  Expected result: all five services are Running, and the second command prints
  `200`.

## Procedure

### 1. Confirm the current version

```powershell
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe' --version
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -N -e "SELECT @@version;"
$env:MYSQL_PWD = $null
```

Expected result: both commands report 8.4.11. The first reads the installed
program and the second asks the running server.

### 2. Back up both databases

A MySQL update affects both databases on the server, so back up stigman and
keycloak.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root --databases stigman --routines --triggers --single-transaction --result-file="C:\Backups\stigman-$stamp.sql"
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root --databases keycloak --routines --triggers --single-transaction --result-file="C:\Backups\keycloak-db-$stamp.sql"
$env:MYSQL_PWD = $null
Get-Content "C:\Backups\stigman-$stamp.sql" -Tail 1
Get-Content "C:\Backups\keycloak-db-$stamp.sql" -Tail 1
```

Expected result: mysqldump prints nothing, and the last line of each file begins
with `-- Dump completed on`. On the test server the stigman backup was about
7 MB and the keycloak backup about 330 KB. If either line is missing, stop: the
backup is incomplete.

### 3. Download the installer and check its signature

The address below is the one the MySQL 8.4 downloads page
(https://dev.mysql.com/downloads/mysql/8.4.html) links to for the Windows MSI
installer.

```powershell
$ver = '8.4.13'
$url = "https://cdn.mysql.com/Downloads/MySQL-8.4/mysql-$ver-winx64.msi"
curl.exe -s -o "C:\Installers\mysql-$ver-winx64.msi" $url
$LASTEXITCODE
$sig = Get-AuthenticodeSignature "C:\Installers\mysql-$ver-winx64.msi"
$sig.Status
$sig.SignerCertificate.Subject
(Get-FileHash "C:\Installers\mysql-$ver-winx64.msi" -Algorithm SHA256).Hash
```

Expected result: `$LASTEXITCODE` is `0`, the signature status is `Valid`, and
the subject names `Oracle America, Inc.` Oracle does not publish a SHA-256 hash
for this file, so the signature is the integrity check. Record the hash so you
can show which file you installed. On the test server it was
`5D568C5D6525A0297C20EA3293EC221973413026ED763503237B953D5DE77C37`. If the
signature is not `Valid`, delete the file and download it again.

### 4. Stop the services

Stop the services that depend on MySQL first, then MySQL. Caddy stays running.

```powershell
Stop-Service STIGManagerWatcher   # skip if the Watcher is not installed
Stop-Service STIGManager
Stop-Service Keycloak
Stop-Service MySQL84
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
```

Expected result: every service except Caddy reports Stopped. Keycloak takes
about 15 seconds and prints "Waiting for service ... to stop" warnings while it
stops. This is normal.

### 5. Run the installer

```powershell
$ver = '8.4.13'
$p = Start-Process msiexec.exe -ArgumentList '/i', "C:\Installers\mysql-$ver-winx64.msi", '/quiet', '/norestart', '/l*v', "C:\Installers\mysql-$ver-install.log" -Wait -PassThru
$p.ExitCode
```

Expected result: exit code `0` after about 10 seconds. The installer upgrades
MySQL in place. It does not change the data directory, the MySQL84 service, or
settings saved with SET PERSIST.

### 6. Start MySQL and check it

```powershell
Start-Service MySQL84
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe' --version
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -N -e "SELECT @@version; SELECT @@binlog_expire_logs_seconds;"
$env:MYSQL_PWD = $null
Get-Content 'C:\Program Files\MySQL\MySQL Server 8.4\data\*.err' -Tail 40
```

Expected result:

- `Start-Service` takes several seconds and may print "Waiting for service
  'MySQL84' to start..." warnings. This is normal.
- Both version commands report 8.4.13.
- `binlog_expire_logs_seconds` is `604800`, the value set during installation.
  This shows that the saved settings survived the upgrade.
- The end of the error log shows, in this order: the shutdown from step 4, the
  8.4.13 startup, `Server upgrade from '80411' to '80413' started` and
  `... completed` about five seconds apart, and
  `ready for connections. Version: '8.4.13'`.

If any of these is wrong, do not start the other services. Go to "Roll back".

### 7. Start the other services

```powershell
Start-Service Keycloak
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher   # skip if the Watcher is not installed
```

Expected result: the loop prints `000` while Keycloak starts, then `200`. It
stops trying after three minutes. If it never prints `200`, do not continue:
check the Keycloak service log (`keycloak-svc.out.log` in the Keycloak folder
under `C:\Services`). If the Watcher does not start the first time, start it
again; it can fail to start when STIG Manager has only just started.

## Verify the update

```powershell
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
Get-Content C:\Services\stig-manager\stig-manager-svc.out.log -Tail 15
```

Expected result:

- All five services are Running.
- The second command prints `200`.
- The STIG Manager log shows `MySQL schema is up to date`, a `state-changed`
  line with `"db":true` and `"oidc":true`, and a MySQL preflight line that
  reports `"version":"8.4.13"`.

Then:

- Sign in at https://YOUR_SERVER_IP/ in a browser and open a collection.
- If the Watcher is installed, confirm that it still imports. When the next scan
  result arrives in its watched folder (by default
  `C:\Services\stigman-watcher\watched`), the file name should appear in
  `C:\Services\stigman-watcher\watcher-history.txt` after the Watcher's next
  scan, which runs every few minutes.

## Roll back

Use this section only if the update must be reversed. A rollback reinstalls a
version with known vulnerabilities, so schedule the update again as soon as the
cause is understood.

Do not run the 8.4.11 installer over 8.4.13. Windows Installer refuses
(`NEWERVERSIONDETECTED` in its log, exit code 1603) and nothing changes. The
rollback has four parts, all of which were run on the test server on
2026-10-20.

### a. Stop the services

Run the commands in step 4. The uninstall in part b leaves the data directory
in place; on the test server, every file survived it. To keep a copy of the data
directory anyway, run this while MySQL is stopped:

```powershell
Copy-Item 'C:\Program Files\MySQL\MySQL Server 8.4\data' C:\Backups\mysqldata-backup -Recurse
```

### b. Uninstall 8.4.13

Find the product code of the installed version:

```powershell
Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'MySQL Server 8.4*' } | Select-Object DisplayName, DisplayVersion, PSChildName
```

The `PSChildName` value on the 8.4.13 row is the product code, a GUID in braces.
On the test server it was `{2DB42E4F-3AD1-4B53-818B-AE89FF2F651B}`. Put it in
place of `<product-code>`:

```powershell
$p = Start-Process msiexec.exe -ArgumentList '/x', '<product-code>', '/quiet', '/norestart', '/l*v', 'C:\Installers\mysql-uninstall.log' -Wait -PassThru
$p.ExitCode
```

Expected result: exit code `0` after about seven seconds. This removes the
MySQL program files and the MySQL84 service. It does not remove the data
directory. Keycloak and STIG Manager still name MySQL84 as a dependency, and
that dependency works again once the service is recreated in part c.

### c. Install 8.4.11 and recreate the service

```powershell
$p = Start-Process msiexec.exe -ArgumentList '/i', 'C:\Installers\mysql-8.4.11-winx64.msi', '/quiet', '/norestart', '/l*v', 'C:\Installers\mysql-8.4.11-install.log' -Wait -PassThru
$p.ExitCode
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe' --install MySQL84
```

Expected result: exit code `0` after about six seconds, then
`Service successfully installed.` The installer does not create the service,
which is why the last command is needed. It recreates MySQL84 exactly as it was.
Do not run mysqld with any `--initialize` option; that creates a new, empty data
directory.

### d. Start the services and check them

Run steps 6 and 7, then the checks in "Verify the update", with these
differences:

- Both version commands report 8.4.11.
- The error log shows `Server downgrade from '80413' to '80411' started` and
  `... completed` about a second apart, before
  `ready for connections. Version: '8.4.11'`.
- The MySQL preflight line in the STIG Manager log reports
  `"version":"8.4.11"`.

The data dictionary downgrades itself, so the backups from step 2 are not needed
for a rollback.

### If the databases are damaged

Restore the step 2 backups only if the databases are damaged. MySQL84 must be
running, and Keycloak, STIG Manager and the Watcher must be stopped. Replace
`<stamp>` with the timestamp in the backup file names:

```powershell
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -e "DROP DATABASE stigman"
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -e "source C:/Backups/stigman-<stamp>.sql"
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -e "DROP DATABASE keycloak"
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -e "source C:/Backups/keycloak-db-<stamp>.sql"
$env:MYSQL_PWD = $null
```

Each command prints nothing when it succeeds. The paths use forward slashes
because the mysql client treats a backslash as an escape character. Then start
the other services as in step 7.

## Not verified

- **Signing in with a browser.** This was not tested. A service account's
  sign-in through the proxy was tested instead. Sign in with a browser after you
  apply the update.
- **Restoring the backups after a rollback.** The restore commands were tested
  on 2026-10-16, but the rollback on 2026-10-20 did not need them. This record
  does not cover a server that will not start at all.
- **Checklist export.** Exporting CKL and CKLB files after the update was not
  tested.
