# Update: MySQL 8.4.11 to 8.4.13

Tested on the twin WIN-TJ87SDPMUPH on 2026-10-20.

## What an administrator should do

Apply it. This is Oracle's October 2026 Critical Patch Update for MySQL — 29 of
the 98 patches are remotely exploitable without authentication, and every
MySQL Server and MySQL Client in the 8.4.0–8.4.11 range is affected; 8.4.13 is
the fixed Windows release. Follow guide Section 16.11 and verify as it says.
Schedule a maintenance window: the stack is down for a few minutes (the
MySQL installer itself takes about ten seconds; the whole procedure is ten to
fifteen minutes including the Keycloak start).

## What changes

- Security fixes for the October 2026 CPU (MySQL: 98 patches, 29 remotely
  exploitable without authentication, maximum CVSS 9.8; Server and Client
  8.4.0–8.4.11 affected). Oracle publishes no per-CVE list in a Windows
  patch; the fixed release is the 8.4 line's answer.
- Optimizer correctness (Bug #114885, rode in from the Docker-only 8.4.12):
  with index_merge_union=off, disjunctive queries could silently return
  incomplete results. STIG Manager runs many such queries; missing rows in a
  review list would be quietly wrong data.
- mysqldump fixes (server-supplied identifier processing and validation) —
  the tool our backup and rollback procedures (16.8, 16.9) are built on.
- Windows-specific fixes: optimizer long query-identifier formatting,
  client console output handling. Account host-matching fix; several InnoDB
  crash/corruption robustness fixes; bundled libevent upgraded to 2.1.13.
- New four-part version identity (VERSION_WITH_UPDATE(), a "Server version
  with update: '8.4.13.0'" log line, and a version_with_update update-history
  entry in data\mysql_upgrade_history). VERSION() and @@version keep the
  three-part form, so every version check in the guide still works.
- First start after the swap adjusts the data dictionary automatically
  ("Server upgrade from '80411' to '80413' started/completed", about five
  seconds). Nothing to run by hand; the same happens in reverse on rollback.
- Not applicable to this deployment (one line): Group Replication and all
  replication/replica fixes, X Plugin, Audit Log, mysqlbinlog tools,
  EL/RPM packaging, WebAuthn client, clone, telemetry component — none in use.

## What might break, and what the twin showed

| Concern | Tested on the twin? | Result |
|---|---|---|
| New binaries refuse the existing data directory | Yes — ran the upgrade and started | Clean start; the automatic data-dictionary step (about 5 s) completed and the server answered at 8.4.13 |
| Persisted settings (SET PERSIST) lost | Yes — SELECT after start | binlog_expire_logs_seconds still 604800, mysqld-auto.cnf untouched |
| Installer mangles the MySQL84 service | Yes — sc.exe qc before/after, MSI log grep | Identical service definition; zero service actions in the install log |
| Installer touches the data directory | Yes — file counts and listing before/after | Every data file survived; file counts change by themselves between running and stopped (session temp tablespaces removed at shutdown, one binlog file added per start) — file count is not the health check |
| Data-dictionary step breaks the two schemas | Yes — object counts after upgrade and after rollback | stigman 35 tables / 5 views / 12 routines, keycloak 101 tables, identical before and after the whole round trip; STIG Manager logged "MySQL schema is up to date" |
| Keycloak / STIG Manager incompatible with new server | Yes — full stack bring-up, sign-in, write test | All five services Running, health check green, sign-in through the proxy works, a Watcher import posted 56 review updates |
| Rollback needed but impossible | Yes — ran the rollback end to end | Windows Installer refuses an older MSI over a newer one (NEWERVERSIONDETECTED, 1603). The tested rollback is: uninstall, install old, re-register the service (below). 8.4.11 started with an automatic data-dictionary downgrade and the stack was healthy on it |
| mysql_upgrade_history / version identity changes confuse tools | Yes — read the file and log each start | The file records each version as a row; VERSION() still prints "8.4.13"; STIG Manager, Keycloak and the Watcher all started against it without complaint |

## Before you start

- The installer: mysql-8.4.13-winx64.msi from
  https://dev.mysql.com/downloads/mysql/8.4.html ("Windows (x86, 64-bit), MSI
  Installer"; "No thanks, just start my download").
  Authenticode signature must be Valid with signer "Oracle America, Inc."
  (Oracle publishes no SHA-256). Twin's file, for reference:
  SHA-256 5D568C5D6525A0297C20EA3293EC221973413026ED763503237B953D5DE77C37.
- Keep the PREVIOUS version's MSI (mysql-8.4.11-winx64.msi) in C:\Installers
  before you start; it is the rollback half. On the twin:
  SHA-256 90D71A61E2DBFD271D81FEFA32867199EB6E1430AB8CEEFB8E976FDF684C7AAB.
- Back up BOTH schemas first (guide 16.11 step 2): mysqldump stigman and
  keycloak. The exit code must be 0 and each file must end in
  "-- Dump completed on".
- Confirm the current version, both ways:
  `& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe' --version`
  (must print 8.4.11) and
  `& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -N -e "SELECT @@version;"`
  (must print 8.4.11).

## Procedure

Follow guide Section 16.11, steps 1–6, exactly. Condensed, as run on the twin
(all from an elevated PowerShell; full commands in the guide):

1. Review the release notes; confirm 8.4.11 both ways (above).
2. Back up both schemas (above).
3. Download the MSI, verify the Authenticode signature (Valid, Oracle
   America, Inc.), record the SHA-256.
4. Stop the stack: Stop-Service STIGManagerWatcher, STIGManager, Keycloak,
   MySQL84 (in that order; Caddy stays up). All must report Stopped except
   Caddy. Keycloak takes about fifteen seconds and prints "Waiting" warnings —
   normal.
5. Run the installer:
   `$p = Start-Process msiexec.exe -ArgumentList '/i', "C:\Installers\mysql-8.4.13-winx64.msi", '/quiet', '/norestart', '/l*v', "C:\Installers\mysql-8.4.13-install.log" -Wait -PassThru`
   — `$p.ExitCode` must be 0. On the twin: 0, ten seconds.
6. Start and verify: Start-Service MySQL84 (about eight seconds, "Waiting for
   service 'MySQL84' to start..." warnings are normal), then mysqld --version
   and `SELECT @@version;` must both print 8.4.13 and
   `SELECT @@binlog_expire_logs_seconds;` must print the pre-update value
   (604800). The error log must show, in order: your shutdown, the new startup
   banner, "Server upgrade from '80411' to '80413' started" and "... completed"
   (about five seconds apart), then "ready for connections. Version: '8.4.13'".
   Then Start-Service Keycloak, poll the OIDC discovery URL to 200, Start-Service
   STIGManager, Start-Service STIGManagerWatcher.

## Check that it worked

- `Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher` —
  all Running.
- `curl.exe -sk https://localhost/api/op/configuration` — 200, and the
  JSON names the same STIG Manager version as before (the MySQL update does
  not change it; on the twin 1.6.17).
- STIG Manager log (Get-Content C:\Services\stig-manager\stig-manager-svc.out.log
  -Tail 15): "MySQL schema is up to date" and the state-changed line with
  db and oidc both true. The mysql preflight line also names the new server
  version ("version":"8.4.13") — a direct confirmation of what STIG Manager
  is talking to.
- Keycloak: OIDC discovery answers 200 on localhost:8080.
- Log in through the browser at https://YOUR_SERVER_IP/ and open a collection.
  (On the twin, the sign-in check was the Watcher's service account through
  the proxy; a person's browser login was not exercised.)
- If the Watcher is installed: "preflight api requests succeeded" in its log,
  and place one scan result in the watched folder and see it counted in the
  Watcher's history file on the next scan. On the twin this posted 56 review
  updates, proving writes end to end.

## Undo

Ran on the twin, end to end, on 2026-10-20 (8.4.13 back to 8.4.11). Do not
install the old MSI over the new one — Windows Installer refuses
(NEWERVERSIONDETECTED, exit 1603) and changes nothing. The rollback is three
parts (guide 16.11 step 7 has the full text):

1. Stop the stack as in step 4 above. Optionally copy the data directory
   aside while stopped (`Copy-Item 'C:\Program Files\MySQL\MySQL Server 8.4\data' C:\Backups\mysqldata-backup -Recurse`)
   — the uninstall does not remove it (verified on the twin), this is belt
   and braces.
2. Find the installed product code and uninstall it:
   `Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like 'MySQL Server 8.4*' } | Select-Object DisplayName, DisplayVersion, PSChildName`
   then
   `$p = Start-Process msiexec.exe -ArgumentList '/x', '<the PSChildName GUID>', '/quiet', '/norestart', '/l*v', 'C:\Installers\mysql-uninstall.log' -Wait -PassThru`
   — exit 0 in about seven seconds. This removes the binaries AND the
   MySQL84 service, and leaves the data directory in place. Keycloak's and
   STIG Manager's dependencies re-resolve once the service returns.
3. Install the previous MSI (same msiexec /i form, exit 0 in about six
   seconds — it does NOT recreate the service), then re-register the service:
   `& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe' --install MySQL84`
   ("Service successfully installed." — the same command the install scripts
   use; do not run any --initialize variant, the existing data directory is
   kept).
4. Start and verify as in step 6. Differences: the error log shows
   "Server downgrade from '80413' to '80411' started" and "... completed"
   (about one second) before "ready for connections. Version: '8.4.11'";
   mysql_upgrade_history gains a row naming 8.4.11; versions print 8.4.11;
   the step-2 backups are NOT needed unless the data itself was damaged.

On the twin the rollback took under five minutes of wall time, the object
counts and persisted settings were identical to the pre-update baseline, the
stack was healthy and sign-in worked on 8.4.11, and the twin was then moved
forward to 8.4.13 again with the same healthy results. A rollback reopens the
CPU's security holes — schedule the forward update again as soon as the cause
is understood.

## Not verified

- A person's browser login (open the collection in a browser) — the twin has
  no browser; the sign-in check used the Watcher's service account through
  the proxy.
- Restoring the step-2 dumps after a failed MySQL update — never needed on
  the twin; the restore halves themselves are the commands tested on
  2026-10-16 (guide 16.8/16.9). The physical data-directory copy in the undo
  is optional and was taken but not needed.
- Oracle's per-CVE risk matrix for the October CPU was not yet published at
  check time (2026-10-20 07:40 ET); the pre-announcement numbers (98/29/9.8,
  Server and Client 8.4.0–8.4.11 affected) are what this record relies on.
- CKL / CKLB export after the update was not exercised this round.
