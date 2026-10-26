# Update: Microsoft OpenJDK 17.0.20.1 to 17.0.21.0.2 (with eMudhra root removal)

Tested on the twin WIN-TJ87SDPMUPH on 2026-10-26.

## What an administrator should do

Apply it in the next maintenance window, following guide Step 16.12. It does two
things: it moves Keycloak's Java runtime from 17.0.20.1 to 17.0.21.0.2, which
fixes the 39 October-CPU vulnerabilities that affect our 17.0.20.1 line (34
remotely exploitable, maximum CVSS 7.0); and it removes the compromised eMudhra
root certificates that both the old and the new JDK still trust (CVE-2026-114820,
CVSS 9.1 — no Microsoft build fixes this yet). Only Keycloak runs on Java, so the
window is one stop-and-start of Keycloak, STIG Manager and the Watcher, about
ten minutes. Log in through the browser during the window; that path is not
covered by the twin's checks.

## What changes

- The JDK Keycloak runs on moves from `C:\Program Files\Microsoft\
  jdk-17.0.20.101-hotspot` (17.0.20.1) to `C:\Program Files\Microsoft\
  jdk-17.0.21.0.2` (17.0.21.0.2), installed from the ZIP. The old folder stays
  as the rollback.
- Security: the October 2026 CPU (OpenJDK advisory 2026-10-20; Oracle
  cpuoct2026.html) lists 39 patches affecting Oracle Java SE 17.0.20.1, 34
  remotely exploitable, max CVSS 7.0 (CVE-2026-91415). Relevant to this stack:
  Networking/SOCKS5 CVE-2026-91398 (6.8) and the JSSE/TLS fixes CVE-2026-91373
  (5.3), CVE-2026-83376 (3.7), CVE-2026-91461 (3.7) — TLS handling that
  Keycloak's production LDAPS federation rests on.
- Security, NOT fixed by this release: the private keys of eight eMudhra
  intermediate CA certificates were compromised (openjdk.org/emudhra; OpenJDK
  advisories 2026-10-21 and 2026-10-24, the latter superseding the former with
  CVE-2026-114820 / JDK-8395690, CVSS 9.1, javax.net.ssl, affecting 17.0.21.0.2
  and earlier). The interim action is to delete the affected roots from the
  truststore of every installed JDK. The advisory names four roots: emSign
  Root CA – G1, emSign Root CA – G2, emSign ECC Root CA – G3 and Comodo AAA
  Certificate Services. Microsoft's 17.0.21.0.2 truststore contains one of
  them (G1). The older 17.0.20.1 build contains G1 and ECC G3, plus two more
  eMudhra roots the advisory does not name (C1 and ECC C3); these are removed
  too, because the same company operates them and Microsoft's own 17.0.21.0.2
  build no longer ships them. Neither build contains G2 or Comodo AAA (checked
  by listing both stores on the twin).
- Keycloak itself does not change: version 26.8.1, no kc.bat build (the JVM is
  not baked into the optimized image), no database change, no schema change.
- JDK versions are now five-part ("17.0.21.0.2"); `java -version` prints the
  same string the download page uses. If any monitoring of your own casts
  versions to `[version]`, that type holds at most four parts and will either
  throw or compare wrong — the twin's tooling hit both and was fixed.
- CPU fixes for SAML, identity brokering and Keycloak clustering are not in use
  here and change nothing for this deployment.

## What might break, and what the twin showed

| Concern | Tested on the twin? | Result |
|---|---|---|
| Keycloak fails to start on the new JDK | Yes — five full stop/start cycles | Started clean every time; OIDC discovery answered 200 within 15 s of `Start-Service`; log shows the "Installed features" line and no new ERROR lines |
| The repoint misses one of JAVA_HOME's two homes | Yes | Both places updated (env line in keycloak-svc.xml, machine variable); `Get-CimInstance Win32_Process ... ExecutablePath` proves the running binary is the new one |
| WinSW rejects the rewritten service XML (Set-Content writes a BOM) | Yes — the documented `.Replace()` + `Set-Content -Encoding UTF8` edit, then restart, in both directions | BOM is written; the wrapper reads the file without complaint |
| Removing the eMudhra roots breaks Keycloak's TLS | Yes, as far as the twin can | Restarted Keycloak on the old JDK with the cleaned truststore: healthy, sign-in through the proxy works, OIDC discovery 200. Production's LDAPS path itself is not present on the twin — see "Not verified" |
| keytool alias names differ from the advisory's | Yes | Microsoft names truststore entries by full DN, not the advisory's short aliases. Listed first, then deleted what was there: one entry in 17.0.21.0.2, four in 17.0.20.101. "alias does not exist" errors are harmless |
| The Watcher, STIG Manager or MySQL are affected | Nothing to test — none run on Java | Unaffected; the Watcher resumed its 5-minute scans after every cycle |
| Version tooling mishandles 5-part versions | Yes — selftest | Found and fixed on the twin: `[version]'17.0.21.0.2'` throws ("portion was too short or too long"). The agent's version comparison silently truncated the fifth part, which would have made a 17.0.21.0.3 respin read as "current"; it now folds parts beyond the fourth losslessly. Install-Java.ps1's newest-zip selection had the same defect and was rewritten (zero-padded parts); a selftest with two staged zips picks the newest |

## Before you start

- Have the ZIP and its checksum in C:\Installers:
  `microsoft-jdk-17.0.21.0.2-windows-x64.zip` (178.6 MB) and
  `microsoft-jdk-17.0.21.0.2-windows-x64.zip.sha256sum.txt`, from the 17.0.21.0.2
  section of learn.microsoft.com/java/openjdk/download. Published SHA-256:
  `49154292866386b2f4f09a3ecf3be07ab80a419149c84ec1d4419b9eec9e4b64`.
  The aka.ms links redirect — curl.exe needs `-L`.
- Confirm the stack is healthy and note what you are running on (guide 16.12
  step 1): the env line in keycloak-svc.xml and the machine JAVA_HOME must both
  name the old folder, and the three URL checks must answer 200.
- **If production uses Keycloak LDAPS federation with Active Directory**: check
  which CA the AD LDAPS certificate chains to before the window. The removal
  deletes eMudhra-operated roots (emSign / eMudhra Inc); an enterprise CA of
  your own is unaffected, but if any trusted endpoint's chain roots in eMudhra,
  Keycloak would stop trusting it after this change.
- No database backup is required for this update; the JDK touches no schema.
  Backups made during the procedure: `keycloak-svc.xml.bak` beside the service
  XML, and `cacerts.bak` beside each JDK's keystore.

## Procedure

Guide Step 16.12 carries the full text with the expected result of each step.
In summary, as run on the twin:

1. Download and verify the ZIP (SHA-256 comparison must print True).
2. `Expand-Archive` into `C:\Program Files\Microsoft`, then
   `Rename-Item '...\jdk-17.0.21.0.2+1' 'jdk-17.0.21.0.2'` (the archive folder
   carries a `+1` build suffix). `java -version` must print
   `openjdk version "17.0.21.0.2"`.
3. Remove the eMudhra roots from BOTH JDKs' cacerts (back up each keystore
   first): list with
   `keytool -list -cacerts -storepass changeit | Select-String emsign,emudhra`,
   delete each listed alias with `keytool -delete -cacerts -storepass changeit
   -alias <DN>`. One entry in the new JDK, four in the old.
4. Repoint both JAVA_HOME places: the env line in keycloak-svc.xml
   (`$xml.Replace('jdk-17.0.20.101-hotspot','jdk-17.0.21.0.2')` +
   `Set-Content -Encoding UTF8`) and the machine variable.
5. Restart: stop STIGManagerWatcher, STIGManager, Keycloak; start Keycloak and
   poll `http://localhost:8080/realms/stigman/.well-known/openid-configuration`
   until 200 (about 15 s); start STIGManager, then the Watcher.

Twin timings: stopping the three services 15.6 s (Keycloak dominates); each
stop-and-start cycle 50–60 s; extract-and-rename under a minute.

## Check that it worked

- `Get-CimInstance Win32_Process -Filter "name='java.exe'" |
  Select-Object -ExpandProperty ExecutablePath` prints the NEW folder.
- `Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher` —
  all Running.
- 200 from `https://localhost/`, `https://localhost/api/op/configuration`
  (still STIG Manager 1.6.17), and the OIDC discovery URL.
- Browser login at https://YOUR_SERVER_IP/ and open a collection.
- Keycloak log tail: "Installed features" line, no new ERROR lines.
- `keytool -list -cacerts -storepass changeit | Select-String emsign,emudhra`
  prints nothing on either JDK.

## Undo

Run on the twin, twice (17.0.21.0.2 → 17.0.20.101 → 17.0.21.0.2), with the exact
commands below:

```powershell
$xml = Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.xml -Raw
$xml = $xml.Replace('jdk-17.0.21.0.2', 'jdk-17.0.20.101-hotspot')
Set-Content C:\Services\keycloak-26.8.1\keycloak-svc.xml -Value $xml -Encoding UTF8
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot', 'Machine')
```

Then the same restart as step 5. The rolled-back state was healthy end to end,
and the old JDK's truststore had already been cleaned, so the rollback does not
reintroduce the compromised roots. Re-applying forward is the step-4 command
with the arguments the other way round, and it was re-run and verified the same
way. The whole undo takes about a minute once the services are stopped.

## Not verified

- A person's browser login. The twin has no browser; its sign-in test uses the
  Watcher's service account through the proxy. Production should log in through
  the browser during the window.
- CKL/CKLB export on the new JDK — it is served by STIG Manager (Node), not
  Java, so the JDK change cannot affect it, but it was not exercised this round.
- Production's LDAPS federation to Active Directory on the cleaned truststore.
  The twin has no LDAPS. The removed roots are eMudhra-operated; if your AD
  chain does not root in eMudhra (check per "Before you start"), the removal
  cannot affect it.
- No Microsoft build fixes CVE-2026-114820 (JDK-8395690) yet. Watch the
  OpenJDK release notes for a build naming JDK-8395690; when it ships, update
  to it and the root-removal step finds nothing left to do.
- The OpenJDK advisories also list fixes for Java 8/11/21/25/27 lines and
  OpenJFX; only the 17-line rows were assessed for this deployment.
