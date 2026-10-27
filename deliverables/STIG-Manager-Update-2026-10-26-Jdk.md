# Update: Microsoft OpenJDK 17.0.20.1 to 17.0.21.0.2, with removal of the compromised eMudhra root certificates

Tested on a test server on 2026-10-26, including the rollback.

## Summary

Apply this update at the next maintenance window. It does two things:

- It moves Keycloak to Microsoft OpenJDK 17.0.21.0.2. This fixes the 39
  vulnerabilities in Oracle's October 2026 Critical Patch Update that affect
  Java 17.0.20.1. Thirty-four of them can be exploited over a network without
  credentials, and the highest CVSS score is 7.0.
- It removes the compromised eMudhra (emSign) root certificates from the trust
  store of both the new and the old JDK (CVE-2026-114820, CVSS 9.1). No
  Microsoft build fixes this vulnerability yet, so the certificates must be
  removed by hand.

Keycloak is the only component that runs on Java. Keycloak, STIG Manager and the
Watcher are restarted once. Allow about 10 minutes, during which users cannot
sign in. If Keycloak connects to Active Directory over LDAPS, complete the
certificate check in "Before you start" first.

## What changes

- **Java runtime.** Keycloak runs on the new JDK in
  `C:\Program Files\Microsoft\jdk-17.0.21.0.2`, installed from the ZIP file. The
  old JDK folder, `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`, stays in
  place for the rollback.
- **Security fixes in the new JDK.** The new JDK includes the fixes from the
  October 2026 Critical Patch Update. The most relevant to this deployment are
  in TLS (JSSE: CVE-2026-91373, CVE-2026-83376 and CVE-2026-91461) and in
  networking (CVE-2026-91398). Keycloak uses TLS for its outbound connections,
  including LDAPS to Active Directory where that is configured.
- **Trust store.** In October 2026 the private keys of eight eMudhra
  intermediate certificate authority (CA) certificates were compromised
  (CVE-2026-114820). OpenJDK's interim advice is to delete the affected root
  certificates from every installed JDK. The advisory names four roots: emSign
  Root CA - G1, emSign Root CA - G2, emSign ECC Root CA - G3 and Comodo AAA
  Certificate Services.
  - Microsoft's 17.0.21.0.2 build contains one of them, G1.
  - The 17.0.20.1 build contains G1 and ECC G3, and two other eMudhra roots that
    the advisory does not name, C1 and ECC C3. This procedure removes those two
    as well, because the same company operates them and Microsoft's newer build
    no longer includes them.
  - Neither build contains G2 or Comodo AAA.

  When Microsoft releases a build that includes the fix (JDK-8395690), update to
  it. The removal steps will then find nothing to delete.
- **Keycloak.** Keycloak does not change. It stays on 26.8.1, needs no rebuild,
  and its database is not touched.
- **Version format.** The JDK version now has five parts (17.0.21.0.2).
  PowerShell's `[version]` type accepts at most four parts, so
  `[version]'17.0.21.0.2'` fails. Check any scripts of your own that compare
  Java versions this way.
- **Not applicable to this deployment:** fixes for SAML, identity brokering and
  Keycloak clustering.

## Test results

| Risk | Result on the test server |
|---|---|
| Keycloak does not start on the new JDK | Keycloak started cleanly in five stop-and-start cycles. OIDC discovery answered 200 within 15 seconds of `Start-Service`, and the log showed no new errors. |
| Keycloak still runs on the old JDK | The running `java.exe` was in the new JDK folder. Both places that name the JDK were updated. |
| The service wrapper rejects the edited service file | No. `Set-Content -Encoding UTF8` adds a byte order mark to the file, and the service wrapper (WinSW) read it without errors after the update and after the rollback. |
| Removing the eMudhra roots breaks Keycloak's TLS connections | Keycloak was healthy on the cleaned trust store, a service account signed in through the proxy, and OIDC discovery answered 200. The test server has no LDAPS connection to test (see "Not verified"). |
| The trust store entries have different names from the advisory | They do. Microsoft's keytool lists each entry by its full distinguished name, not the short name the advisory uses. The procedure lists the entries first and deletes the names it shows. |
| STIG Manager, MySQL or the Watcher are affected | None of them use Java. The Watcher resumed its scans after every restart. |
| The update cannot be rolled back | The rollback was run, and the update was then applied again. The stack was healthy in both states. |

## Before you start

- **Maintenance window.** Allow about 10 minutes.
- **One PowerShell window.** Run every command in one elevated PowerShell
  window, in order. Later steps use the `$ver` variable that step 2 sets.
- **LDAPS to Active Directory.** If Keycloak connects to Active Directory over
  LDAPS, confirm that your domain controllers' LDAPS certificates do not chain to
  an eMudhra (emSign) root. Certificates issued by your own enterprise CA are not
  affected. If one does chain to an eMudhra root, Keycloak will stop trusting it
  after this update; resolve that before you continue.
- **Backups.** No database backup is needed, because the procedure changes no
  database. It keeps a copy of each file it edits: `keycloak-svc.xml.bak` beside
  the Keycloak service file, and `cacerts.bak` beside each JDK's trust store.
- **Folder names.** This procedure starts from the JDK in
  `C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot` and Keycloak in
  `C:\Services\keycloak-26.8.1`. If step 1 shows different folders on your
  server, use those names wherever this document names these folders.

## Procedure

### 1. Check the current state

Confirm which JDK Keycloak uses, and that the stack is healthy:

```powershell
$svc = [xml](Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.xml -Raw)
($svc.service.env | Where-Object { $_.name -eq 'JAVA_HOME' }).value
[System.Environment]::GetEnvironmentVariable('JAVA_HOME','Machine')
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/realms/stigman/.well-known/openid-configuration
```

Expected result: both JAVA_HOME values are
`C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot`, all five services are
Running, and each `curl.exe` command prints `200`. The value in the service file
is the one the Keycloak service actually uses.

### 2. Download the JDK and verify it

These are the links on Microsoft's OpenJDK download page
(https://learn.microsoft.com/java/openjdk/download). They redirect to
Microsoft's download servers, which is why `curl.exe` needs `-L`.

```powershell
$ver = '17.0.21.0.2'
$jdkZip = "https://aka.ms/download-jdk/microsoft-jdk-${ver}-windows-x64.zip"
curl.exe -sL -o "C:\Installers\microsoft-jdk-${ver}-windows-x64.zip" $jdkZip
curl.exe -sL -o "C:\Installers\microsoft-jdk-${ver}-windows-x64.zip.sha256sum.txt" "$jdkZip.sha256sum.txt"
$published = ((Get-Content "C:\Installers\microsoft-jdk-${ver}-windows-x64.zip.sha256sum.txt") -split '\s+')[0]
$actual = (Get-FileHash "C:\Installers\microsoft-jdk-${ver}-windows-x64.zip" -Algorithm SHA256).Hash
$published -eq $actual
```

Expected result: the last command prints `True`. The file is about 179 MB, and
its published SHA-256 hash is
`49154292866386b2f4f09a3ecf3be07ab80a419149c84ec1d4419b9eec9e4b64`. If the
result is `False`, delete both files and download them again.

### 3. Install the new JDK beside the old one

Use the ZIP file, not the MSI installer. The MSI removes the previous JDK, and
the rollback depends on it.

```powershell
Expand-Archive "C:\Installers\microsoft-jdk-${ver}-windows-x64.zip" -DestinationPath 'C:\Program Files\Microsoft'
Rename-Item "C:\Program Files\Microsoft\jdk-${ver}+1" "jdk-${ver}"
& "C:\Program Files\Microsoft\jdk-${ver}\bin\java.exe" -version
```

Expected result: the last command prints `openjdk version "17.0.21.0.2"`. The
archive extracts to a folder named `jdk-17.0.21.0.2+1`; the rename removes the
`+1` from the folder name.

### 4. Remove the eMudhra root from the new JDK

Back up the trust store, list the eMudhra entries, and delete the one entry the
new JDK contains. `changeit` is the standard default password of the JDK trust
store, not a site secret.

```powershell
Copy-Item "C:\Program Files\Microsoft\jdk-${ver}\lib\security\cacerts" "C:\Program Files\Microsoft\jdk-${ver}\lib\security\cacerts.bak"
& "C:\Program Files\Microsoft\jdk-${ver}\bin\keytool.exe" -list -cacerts -storepass changeit | Select-String emsign,emudhra,aaa_certificate_services
& "C:\Program Files\Microsoft\jdk-${ver}\bin\keytool.exe" -delete -cacerts -storepass changeit -alias 'cn=emsign_root_ca_-_g1,o=emudhra_technologies_limited,ou=emsign_pki,c=in'
```

Expected result: the list shows one entry, beginning
`cn=emsign_root_ca_-_g1`. If the list shows other entries, delete each of them
with the same `-delete` command and its name.

### 5. Remove the eMudhra roots from the old JDK

A rollback returns Keycloak to the old JDK, so its trust store must be cleaned
as well. It contains four eMudhra entries.

```powershell
Copy-Item 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\lib\security\cacerts' 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\lib\security\cacerts.bak'
& 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\keytool.exe' -list -cacerts -storepass changeit | Select-String emsign,emudhra,aaa_certificate_services
& 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\keytool.exe' -delete -cacerts -storepass changeit -alias 'cn=emsign_root_ca_-_g1,o=emudhra_technologies_limited,ou=emsign_pki,c=in'
& 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\keytool.exe' -delete -cacerts -storepass changeit -alias 'cn=emsign_ecc_root_ca_-_g3,o=emudhra_technologies_limited,ou=emsign_pki,c=in'
& 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\keytool.exe' -delete -cacerts -storepass changeit -alias 'cn=emsign_root_ca_-_c1,o=emudhra_inc,ou=emsign_pki,c=us'
& 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\keytool.exe' -delete -cacerts -storepass changeit -alias 'cn=emsign_ecc_root_ca_-_c3,o=emudhra_inc,ou=emsign_pki,c=us'
```

Expected result: the list shows the four entries named in the `-delete`
commands. If a delete reports "alias does not exist", that build does not
contain the certificate and nothing needs to be done.

### 6. Point Keycloak at the new JDK

The JDK is named in two places: the Keycloak service file, which the service
uses, and the machine-wide JAVA_HOME variable, which command-line Keycloak tools
use. Back up the service file, then change both:

```powershell
Copy-Item C:\Services\keycloak-26.8.1\keycloak-svc.xml C:\Services\keycloak-26.8.1\keycloak-svc.xml.bak
$xml = Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.xml -Raw
$xml = $xml.Replace('jdk-17.0.20.101-hotspot', 'jdk-17.0.21.0.2')
Set-Content C:\Services\keycloak-26.8.1\keycloak-svc.xml -Value $xml -Encoding UTF8
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Microsoft\jdk-17.0.21.0.2', 'Machine')
```

Expected result: no output. To confirm the change, run the first three commands
of step 1 again. Both values should now be
`C:\Program Files\Microsoft\jdk-17.0.21.0.2`.

### 7. Restart the services

Stop the services that depend on Keycloak, then Keycloak, and start them again
in order:

```powershell
Stop-Service STIGManagerWatcher   # skip if the Watcher is not installed
Stop-Service STIGManager
Stop-Service Keycloak
Start-Service Keycloak
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher   # skip if the Watcher is not installed
```

Expected result: stopping takes about 15 seconds, most of it for Keycloak, which
prints "Waiting for service ... to stop" warnings. This is normal. The loop
prints `000` while Keycloak starts and then `200`, which took about 15 seconds on
the test server. It stops trying after three minutes. If it never prints `200`,
check the Keycloak log (see "Verify the update") and consider rolling back.

## Verify the update

```powershell
Get-CimInstance Win32_Process -Filter "name='java.exe'" | Select-Object -ExpandProperty ExecutablePath
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/realms/stigman/.well-known/openid-configuration
Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.out.log -Tail 15
& 'C:\Program Files\Microsoft\jdk-17.0.21.0.2\bin\keytool.exe' -list -cacerts -storepass changeit | Select-String emsign,emudhra,aaa_certificate_services
& 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot\bin\keytool.exe' -list -cacerts -storepass changeit | Select-String emsign,emudhra,aaa_certificate_services
```

Expected result:

- The first command prints
  `C:\Program Files\Microsoft\jdk-17.0.21.0.2\bin\java.exe`. This is the check
  that shows which JDK Keycloak is running on. It needs an elevated window; in a
  window without administrator rights it prints nothing.
- All five services are Running, and each `curl.exe` command prints `200`.
- Shortly after the restart, the last lines of the Keycloak log include an
  "Installed features" line and no new ERROR lines. Later, routine warnings
  push that line out of the last 15.
- Both `keytool.exe` commands print nothing.

Then sign in at https://YOUR_SERVER_IP/ in a browser and open a collection. This
tests the sign-in path that people use, which the commands above do not.

## Roll back

If Keycloak does not work correctly on the new JDK, point it back at the old JDK:

```powershell
$xml = Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.xml -Raw
$xml = $xml.Replace('jdk-17.0.21.0.2', 'jdk-17.0.20.101-hotspot')
Set-Content C:\Services\keycloak-26.8.1\keycloak-svc.xml -Value $xml -Encoding UTF8
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot', 'Machine')
```

Then run the commands in step 7 and the checks in "Verify the update". Expected
result: the `java.exe` path is in `jdk-17.0.20.101-hotspot`, and the stack is
healthy.

These commands were run on the test server, and the update was then applied
again. The stack was healthy on the old JDK. Because step 5 cleaned the old
JDK's trust store, a rollback does not restore the compromised certificates. The
rollback takes about a minute once the services are stopped.

## Not verified

- **Signing in with a browser.** The test server has no browser. A service
  account's sign-in through the proxy was tested instead. Sign in with a browser
  after you apply the update.
- **LDAPS to Active Directory.** The test server has no LDAPS connection, so
  LDAPS was not tested with the cleaned trust store. The removed certificates
  are all eMudhra roots. If your domain controllers' certificates do not chain
  to an eMudhra root (see "Before you start"), the removal does not affect them.
- **Checklist export.** Exporting CKL and CKLB files was not tested. STIG
  Manager produces them without Java, so this update is not expected to affect
  them.
