# Update: STIG Manager 1.6.17 to 1.6.18

Tested on a test server on 2026-11-03, including the rollback. A known issue
with signing out was measured on the test server on 2026-11-08 and is described
under "Known issue: signing out needs a second click".

## Summary

Apply this update at the next maintenance window, but only after the release
page publishes the Windows archive. STIG Manager 1.6.18 was published on
2026-11-02, and on 2026-11-03 its release page listed no files at all: only the
automatic source code archives. The same was true on 2026-11-07, on 2026-11-08
and on 2026-11-09. The check in step 2 of this record says when the file is
there. Do not install the
application from any other source.

Plan for about five minutes of downtime. The STIG Manager and Watcher services
are stopped while the binary is replaced, so users cannot sign in during that
time. MySQL, Keycloak and Caddy stay running.

The update includes a database migration, so the database must be backed up
first. The migration changes one setting for collection owners to be aware of:
review aging rules that were set to run more often than once an hour are reset
to one hour and switched off, so that the collection owner can review them and
switch them back on.

## What changes

- **Security, file uploads.** The release updates the multer library, which
  handles uploaded files, from 2.4.0 to 2.5.0. The earlier version is affected
  by a denial of service advisory (GHSA-q7qp-rjg7-q26m, high severity,
  CVSS 7.5): an upload request that is abandoned while a file filter is still
  running can tie up server resources. Version 2.5.0 is the fixed release.
- **Security, outbound HTTP.** The release updates the undici library, which
  STIG Manager uses to reach Keycloak, from version 6.28.1 to 8.12.3. The
  6.28.1 release in use before this update is affected by five published
  advisories, three of them rated high: a certificate validation bypass when
  TLS options are dropped (GHSA-2m5v-pch6-74hx), a denial of service through
  TLS 1.2 renegotiation (GHSA-qrxm-fqhp-jwvm) and a denial of service through
  excessive content encodings (GHSA-xjj6-f33q-929c). Version 8.12.3 is not
  affected by any published advisory. The code paths named in these advisories
  (the WebSocket client, the event source parser, the retry interceptor and
  agent TLS options) are not used by this deployment; the update removes the
  vulnerable library versions in any case.
- **Review aging rules now run at most once an hour.** A review aging rule with
  an interval of less than 3600 seconds is refused by the API with the message
  `request/body/0/triggerInterval must be >= 3600`. The user interface no longer
  accepts a blank interval, which used to be saved as 0. An interval of 0 made
  the rule match every review in its target.
- **Stored review aging rules are reset and disabled by the migration.** Rules
  whose interval was below one hour are set to 3600 seconds and have their
  enabled flag cleared. The collection owner must review each of them and
  switch it back on if the one-hour interval is what was intended. This is the
  only change to data in this release.
- **The review aging task no longer fails on a rule shared by several STIGs.**
  A review whose rule appears in more than one STIG was selected once per
  STIG. The duplicate aborted the metrics refresh for that collection, and a
  failed collection left the task unable to process the collections after it in
  the same run. Benchmark-targeted rules now select only reviews on assets
  assigned that STIG.
- **New label filters on the collection checklist.** The endpoint that returns
  the checklist for a STIG in a collection now accepts `labelId`, `labelName`
  and `labelMatch` query parameters, and the counts it returns cover only the
  assets that match. `labelName` now accepts reserved characters, so a label
  name such as `R&D` can be used.
- **Job run output.** The output of a job run now includes a `seq` property,
  returns `taskId` as a string, and marks the task fields as nullable, so that
  it agrees with the published `JobRunOutput` schema.
- **Maintenance.** The compression library moves from the 1.8.1 range to 1.8.2.
  The denial of service advisory that 1.8.2 fixes (GHSA-vc2v-76pw-4v95) was
  already addressed in the version in use, so this change adds nothing to the
  security of the deployment.

## Test results

| Risk | Result on the test server |
|---|---|
| The new version does not start or the migration fails | The service started cleanly. The log showed "MySQL schema requires 2 updates", migration 0049 (recreates the review aging stored procedure), migration 0050 (resets the rules below the minimum), then "All migrations performed successfully", and the service reached the available state with the database and the identity provider both healthy. |
| The migration changes data that should not change | Only the review aging rules were touched. A test rule with a 600-second interval came back with an interval of 3600 seconds and disabled, exactly as the release notes describe. The rest of the database was unchanged: 40 tables, 2 collections, 1 asset and 579 reviews before and after. |
| Sign-in stops working | A service account signed in through the proxy and made an authenticated API call. A browser sign-in at the approved address of the test server loaded the application over HTTP/2 with no failed requests and no console errors. |
| The Watcher cannot post to the updated API | The Watcher logged "preflight api requests succeeded" and reported the API version 1.6.18, and its scans continued normally every five minutes. |
| Exports fail | The checklist export returned 157,269 bytes and the benchmark export returned 274,489 bytes, both valid ZIP archives. |
| The new API parameters do not work | A checklist request with `labelId` naming a label that does not exist returned HTTP 200 and an empty array; `labelMatch=null` returned HTTP 200 with all 278 rules of the STIG; `labelName` containing `&`, `?` and `#` returned HTTP 200 with an empty array. On version 1.6.17 the same requests were refused with HTTP 400 and the message "Unknown query parameter". |
| The update cannot be rolled back | The rollback below was run in full. Version 1.6.17 started on the restored database, logged "MySQL schema is up to date", and the stack was healthy. The update was then applied a second time with the same results. |
| Signing out ends the session | On 1.6.18 the sign-out stops at a Keycloak confirmation page and the session ends only when the person clicks Logout on it. This is a behaviour of the application, not a fault in the update. See "Known issue: signing out needs a second click" below. |

## Known issue: signing out needs a second click

Measured on the test server on 2026-11-08, on the running 1.6.18 build.

When a person uses the sign-out in the STIG Manager web client, the
application opens a Keycloak page headed "Logging out" that asks "Do you want
to log out?". The session at the identity provider ends only when the person
clicks Logout on that page. Until then, and for good if the person closes the
page or moves away from it:

- the other tabs of the application stay signed in;
- a new tab on the same address opens the application without asking for the
  password.

When Logout on that page was clicked, a new tab asked for the password, so the
session had ended. Whether tabs that were already open stop working at once
after that click was not measured.

Version 1.6.17 uses the same sign-out code, so it behaves the same way. The
behaviour is not caused by the update and is not a fault in the deployment.

Until a STIG Manager release with the fix is available, tell users to click
Logout on the "Logging out" page every time they sign out, particularly on
shared workstations.

A change made upstream after 1.6.18 ends the session without the confirmation
page. It was tested on the test server on 2026-11-08 on a build of the
upstream development branch, which is not a release: the sign-out went
straight to the sign-in page, the other tab lost its sign-in, and a new tab
asked for the password. The change is expected in the next STIG Manager
release. When that release is installed, run the check in step 8 below to
confirm the behaviour has changed.

## Before you start

- **The release must publish the Windows archive.** On 2026-11-03 the release
  page for 1.6.18 listed no files, so the update could not be installed from
  it. Step 2 below checks this and says what to do.
- **Maintenance window.** Allow about five minutes.
- **MySQL root password.** Two steps need it. Type it where a command shows
  `<mysql-root-password>`, and do not save it in a file or script. Each command
  block clears it again with `$env:MYSQL_PWD = $null`.
- **One elevated PowerShell window.** Run every command in one elevated
  PowerShell window, in order. Later steps use variables that earlier steps
  set.
- **A healthy starting point.** Confirm that the stack is healthy before you
  begin:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
  ```

  Expected result: all five services are Running, and the second command prints
  `200`.

## Procedure

### 1. Confirm the current version and the MySQL version

```powershell
(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -N -e "SELECT VERSION();"
$env:MYSQL_PWD = $null
```

Expected result: the first command prints `1.6.17`, and the second prints a
MySQL version of 8.4.0 or later (the test server runs 8.4.13). STIG Manager
1.6.17 and later requires MySQL 8.4.0 or later and will not start on an older
release.

### 2. Check that the release publishes the Windows archive

```powershell
$ver = '1.6.18'
$url = "https://github.com/NUWCDIVNPT/stig-manager/releases/download/$ver/stig-manager-win-$ver.zip"
curl.exe -sIL -o NUL -w "%{http_code}`n" $url
```

Expected result: `200`.

If the command prints `404`, the release page does not publish the file yet.
Stop here, and run the command again later. Do not install a different file and
do not build the application yourself. For 1.6.18 the command printed `404`
each time it was run on 2026-11-03, from 06:30 to 19:16, and it printed `404`
again on 2026-11-07 at 06:36, on 2026-11-08 and on 2026-11-09.

### 3. Back up the database

The release includes a database migration, so the backup is required. The
rollback in this record restores from it.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dump = "C:\Backups\stigman-$stamp.sql"
New-Item -ItemType Directory -Path C:\Backups -Force | Out-Null
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root --databases stigman --routines --triggers --single-transaction --result-file=$dump
$env:MYSQL_PWD = $null
Get-Content $dump -Tail 1
```

Expected result: mysqldump prints nothing, and the last line of the file
begins with `-- Dump completed on`. On the test server the backup was about
7 MB. If that line is missing, stop: the backup is incomplete.

### 4. Download and verify the new binary

```powershell
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\stig-manager-win-$ver.zip"
(Get-FileHash "C:\Installers\stig-manager-win-$ver.zip" -Algorithm SHA256).Hash
```

Expected result: the download completes and the hash is printed. GitHub shows a
SHA-256 digest beside the file on the release page, and the hash of your
download must match it exactly (Get-FileHash prints upper case; the comparison
is not case sensitive). If it does not match, delete the file and download it
again. The digest on the release page is the one to compare against. The
archive tested on the test server came from the project's build workflow, not
from the release page (see "Not verified"). On 2026-11-07 that archive was
downloaded again from the same build workflow and was byte-for-byte the same
file, with the same SHA-256
`E86E84DDC691AA7221862CD0C576B443179398CFE5BFAEC8E6161238D4503A91`, and its
detached signature verified as a good signature from the project's key. If the
release page publishes that same file, the digest shown there will match this
hash.

### 5. Stop the services

The Watcher depends on the STIG Manager service, so it is stopped first.

```powershell
Stop-Service STIGManagerWatcher
Stop-Service STIGManager
Get-Service STIGManagerWatcher, STIGManager | Select-Object Name, Status
```

Expected result: both services report `Stopped`.

### 6. Replace the binary

An earlier update may have left a `stig-manager-win.exe.bak` in the folder. If
it is there, the rename below fails, the new binary is copied over the current
one anyway, and the copy kept for the rollback is an older release. The first
two commands move any such file aside under a dated name.

```powershell
$old = 'C:\Services\stig-manager\stig-manager-win.exe.bak'
if (Test-Path $old) { Rename-Item $old "stig-manager-win.exe.bak-$(Get-Date -Format yyyyMMdd-HHmmss)" }
Rename-Item C:\Services\stig-manager\stig-manager-win.exe stig-manager-win.exe.bak
Expand-Archive "C:\Installers\stig-manager-win-$ver.zip" -DestinationPath "C:\Installers\stigman-$ver" -Force
Copy-Item "C:\Installers\stigman-$ver\stig-manager-win.exe" C:\Services\stig-manager\stig-manager-win.exe
```

Expected result: the commands print nothing. The archive contains
`stig-manager-win.exe` and `stig-manager.bat`; only the executable is copied,
because the service configuration and the environment stay the same. If the
archive extracts into a nested folder, point the Copy-Item command at the
executable inside that folder.

### 7. Start the service and watch the migration

```powershell
Start-Service STIGManager
Get-Content C:\Services\stig-manager\stig-manager-svc.out.log -Tail 40 -Wait
```

Expected result: the log shows these lines in this order (press Ctrl+C to stop
following the log):

```
"type":"migration" ... "message":"MySQL schema requires 2 updates"
"type":"migration" ... "status":"start" ... "name":"0049"
"type":"migration" ... "status":"finish" ... "name":"0049"
"type":"migration" ... "status":"start" ... "name":"0050"
"type":"migration" ... "status":"finish" ... "name":"0050"
"type":"migration" ... "message":"All migrations performed successfully"
"type":"state-changed" ... "currentState":"available" ... "db":true,"oidc":true
```

The last line is the one that matters: the service must reach the available
state with both the database and the identity provider healthy.

### 8. Verify the update and restart the Watcher

```powershell
(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version
Start-Service STIGManagerWatcher
Start-Sleep -Seconds 20
Get-Content C:\Services\stigman-watcher\stigman-watcher-svc.out.log -Tail 10
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
```

Expected result: the first command prints `1.6.18`; the Watcher log ends with
`preflight api requests succeeded` and a line that reports the API version
`1.6.18`; and all five services report `Running`.

Then log in through the browser at the address your users use and open a
collection, to confirm the application loads for a person and not only for the
service account.

If the release notes for the version you are installing mention a change to
sign-out or to session handling, check that signing out really ends the
session. Sign in at the address your users use, open a second tab on the same
address, and use the application's sign-out in the first tab. If a Keycloak
page headed "Logging out" asks "Do you want to log out?", do not click anything
on it yet. Check that the second tab shows the sign-in page rather than the
application, and that a third tab asks for the password instead of opening the
application without it. Then return to the first tab and, if the "Logging out"
page is still shown, click Logout on it. On 1.6.18 and 1.6.17 this check fails;
that is the known issue described above, not a fault in the update. Record the
result either way.

### 9. Review the review aging rules

The migration switched off every review aging rule that had an interval below
one hour. Open each collection, go to its review aging settings, and check the
rules. A rule that is switched off does nothing until the collection owner
switches it back on. This step needs no command; it is a decision for the
collection owner.

## Verify the update

```powershell
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/realms/stigman/.well-known/openid-configuration
(Invoke-RestMethod -Uri 'https://localhost/api/op/configuration').version
```

Expected result: the three commands print `200`, `200` and `200`, and the last
command prints the version, `1.6.18`. On the test server the configuration
answer named STIG Manager 1.6.18.

## Roll back

The rollback needs the backup from step 3, because the migration ran. Restore
the old binary and the database together, in that order, with the services
stopped.

```powershell
Stop-Service STIGManagerWatcher
Stop-Service STIGManager
Remove-Item C:\Services\stig-manager\stig-manager-win.exe -Force
Rename-Item C:\Services\stig-manager\stig-manager-win.exe.bak stig-manager-win.exe
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -e "DROP DATABASE stigman"
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -e "source C:/Backups/stigman-<stamp>.sql"
$env:MYSQL_PWD = $null
Start-Service STIGManager
Start-Sleep -Seconds 20
Get-Content C:\Services\stig-manager\stig-manager-svc.out.log -Tail 15
Start-Service STIGManagerWatcher
```

Replace `<stamp>` with the timestamp in the name of the backup file from step 3.
The path after `source` uses forward slashes because the mysql client treats a
backslash as an escape character.

Expected result: the old service starts, the log shows `MySQL schema is up to
date` followed by the state-changed line with `db` and `oidc` true, and the
Watcher starts and reports the API version `1.6.17`. On the test server the
restore of the 7 MB dump took about four seconds, and the stack was healthy
afterwards.

## Not verified

- The official release archive. On 2026-11-03, and again on 2026-11-07,
  2026-11-08 and 2026-11-09, the release page for 1.6.18 published no files, so
  the binary tested on the test
  server was the archive built by the upstream project's own build workflow for
  the same release tag, taken from the files that workflow published. Its
  detached signature verified against the project's public key, and on
  2026-11-07 the same archive was downloaded again and was byte-for-byte
  identical, with the SHA-256
  `E86E84DDC691AA7221862CD0C576B443179398CFE5BFAEC8E6161238D4503A91`. The
  release archive must still be downloaded from the release page, and its hash
  checked against the digest shown there.
- A sign-in by a person with their own account. The browser sign-in was made
  with the test account.
- The review aging task acting on a collection. The test deployment had no
  review aging rules of its own, so the task had nothing to age. The rule
  handling was tested through the stored procedure change in migration 0049 and
  through the migration's effect on a stored rule.
- The user interface change that refuses a blank interval in the review aging
  rule editor.
- The change upstream made after 1.6.18 to how the application ends a session
  when a person signs out. The change was tested on the test server on
  2026-11-08 on a build of the upstream development branch, which is not a
  release. It must be tested again on the released version when it is
  published.
