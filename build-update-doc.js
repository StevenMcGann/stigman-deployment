const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, PageNumber, PageBreak, TableOfContents, VerticalAlign
} = require("docx");

const CONTENT_W = 9360; // US Letter, 1" margins
const border = { style: BorderStyle.SINGLE, size: 1, color: "BFBFBF" };
const borders = { top: border, bottom: border, left: border, right: border };
const HDR_FILL = "1F4E79";
const ALT_FILL = "EEF3F8";
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function tc(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text: String(text), bold: !!opts.bold, color: opts.color || (opts.hdr ? "FFFFFF" : "000000"), size: opts.size || 20 })];
  return new TableCell({
    borders,
    width: { size: opts.w, type: WidthType.DXA },
    shading: { fill: opts.hdr ? HDR_FILL : (opts.fill || "FFFFFF"), type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: (Array.isArray(text) ? text : [new Paragraph({ children: runs })]).map(x => x instanceof Paragraph ? x : new Paragraph({ children: [x] }))
  });
}
function cellP(text, opts = {}) {
  return new TableCell({
    borders,
    width: { size: opts.w, type: WidthType.DXA },
    shading: { fill: opts.fill || "FFFFFF", type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [new TextRun({ text: String(text), bold: !!opts.bold, color: opts.color || "000000", size: opts.size || 20 })] })]
  });
}
function headerRow(cells, widths) {
  return new TableRow({ tableHeader: true, children: cells.map((c, i) => tc(c, { hdr: true, w: widths[i], size: 20 })) });
}
function row(cells, widths, fill) {
  return new TableRow({ children: cells.map((c, i) => cellP(c, { w: widths[i], fill, size: 20 })) });
}
function makeTable(headers, rows, widths) {
  const trs = [headerRow(headers, widths)];
  rows.forEach((r, idx) => trs.push(row(r, widths, idx % 2 ? ALT_FILL : "FFFFFF")));
  return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: trs });
}
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); }
function p(t, opts = {}) { return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, size: 22, bold: !!opts.bold, italics: !!opts.italics })] }); }
function bullet(t, level = 0) { return new Paragraph({ numbering: { reference: "bul", level }, spacing: { after: 40 }, children: [new TextRun({ text: t, size: 22 })] }); }
function num(t) { return new Paragraph({ numbering: { reference: "steps", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 22 })] }); }
function code(t) {
  return new Paragraph({
    spacing: { before: 40, after: 80 },
    shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: "1F4E79", space: 6 } },
    children: [new TextRun({ text: t, font: "Consolas", size: 18 })]
  });
}
function note(label, t, color) {
  return new Paragraph({
    spacing: { before: 60, after: 120 },
    shading: { fill: color || "FFF4E5", type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: color === "FDE7E9" ? "C00000" : "E69500", space: 6 } },
    children: [new TextRun({ text: label + "  ", bold: true, size: 20 }), new TextRun({ text: t, size: 20 })]
  });
}

const doc = new Document({
  creator: "STIG Manager Maintenance (automated)",
  title: "STIG Manager Stack Update - Production Change Procedure",
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 44, bold: true, color: "1F4E79", font: "Arial" }, paragraph: { spacing: { after: 120 } } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: "1F4E79", font: "Arial" }, paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: "2E5496", font: "Arial" }, paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bul", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 270 } } } },
      ]},
      { reference: "steps", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } },
      ]},
    ]
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F4E79", space: 4 } }, children: [new TextRun({ text: "STIG Manager Stack Update – Production Change Procedure", size: 16, color: "808080" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "UNCLASSIFIED  |  Prepared 2026-06-04  |  Page ", size: 16, color: "808080" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "808080" }), new TextRun({ text: " of ", size: 16, color: "808080" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: "808080" })] })] }) },
    children: [
      new Paragraph({ style: "Title", spacing: { before: 1200, after: 120 }, children: [new TextRun("STIG Manager Software Stack Update")] }),
      new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Production Change Procedure", size: 30, color: "595959" })] }),
      new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: "Validated in a lab environment on 2026-06-04 prior to production rollout.", italics: true, size: 22, color: "595959" })] }),

      makeTable(
        ["Field", "Value"],
        [
          ["Document title", "STIG Manager Stack Update - Production Change Procedure"],
          ["Prepared", "2026-06-04 (automated stack release check)"],
          ["Lab environment", "Windows Server 2022 Standard"],
          ["Production target", "Windows Server 2019"],
          ["Classification", "UNCLASSIFIED // test data"],
          ["Change risk", "LOW - patch/point releases within established major versions"],
          ["Est. maintenance window", "30-45 minutes (services briefly unavailable)"],
        ],
        [2600, 6760]
      ),

      new Paragraph({ pageBreakBefore: true, spacing: { after: 120 }, children: [new TextRun({ text: "Contents", bold: true, size: 28, color: "1F4E79" })] }),
      new TableOfContents("", { hyperlink: true, headingStyleRange: "1-2" }),

      // 1
      new Paragraph({ pageBreakBefore: true, children: [] }),
      h1("1. Purpose & Summary"),
      p("This procedure documents the software releases identified during the scheduled STIG Manager stack release check on 2026-06-04, the breaking-change risk assessment for each, and the validated step-by-step procedure for applying the updates in production. All steps below were executed and verified in the lab environment before this document was issued."),
      p("Outcome of the lab run: all five Windows services (MySQL, Keycloak, STIG Manager, the STIG Manager Watcher, and Caddy) returned to a fully healthy, authenticated state after the updates. See Section 5 for the recorded validation evidence."),

      h2("1.1 Updates in scope"),
      makeTable(
        ["Component", "Prior version", "Target version", "Action"],
        [
          ["Caddy (reverse proxy)", "2.11.3", "2.11.4", "UPDATE - drop-in binary swap"],
          ["Keycloak (IdP)", "26.6.2", "26.6.3", "UPDATE - new folder + rebuild + repoint service"],
          ["STIG Manager (API/UI)", "1.6.10 / 1.6.12*", "1.6.12", "UPDATE to 1.6.12 (DB migration via 1.6.11)"],
          ["STIG Manager Watcher", "1.6.9", "1.6.9", "NONE - already current"],
          ["MySQL (database)", "8.4.9 LTS", "8.4.9 LTS", "NONE - already latest 8.4 LTS"],
        ],
        [2700, 2000, 2000, 2660]
      ),
      note("Note:", "*The lab host was already running STIG Manager 1.6.12 (updated by a prior maintenance run); the recorded memory of \"1.6.10\" was stale. Verify the production version first (Section 6, Step 2). If production is below 1.6.12, the 1.6.11 schema migration will run automatically on first start - back up the database beforehand (Section 4)."),

      // 2
      h1("2. Releases Identified"),
      p("Versions and release notes were reviewed from the official GitHub release pages and vendor download sites on 2026-06-04:"),
      bullet("STIG Manager: latest 1.6.12 (1.6.11 -> 1.6.12 on 1-2 Jun 2026). Source: github.com/NUWCDIVNPT/stig-manager/releases"),
      bullet("Keycloak: latest stable 26.6.3 (released 4 Jun 2026). Source: github.com/keycloak/keycloak/releases"),
      bullet("Caddy: latest stable 2.11.4. Source: github.com/caddyserver/caddy/releases"),
      bullet("STIG Manager Watcher: latest 1.6.9 - already deployed; no change. Source: github.com/NUWCDIVNPT/stigman-watcher/releases"),
      bullet("MySQL Community Server: 8.4.9 remains the latest 8.4 LTS release. The 9.x line is the separate Innovation/newer-LTS track; the deployment intentionally stays on the 8.4 LTS branch. No change."),

      // 3
      h1("3. Risk Assessment"),
      p("All updates are point/patch releases within the major versions already in production. No major-version upgrades, no Java upgrade (Keycloak continues on Microsoft OpenJDK 17), and no MySQL change are involved. Overall breaking-change risk is assessed LOW."),

      h2("3.1 Caddy 2.11.3 -> 2.11.4"),
      makeTable(["Aspect", "Assessment"], [
        ["Change type", "Security patches and minor fixes within 2.11.x"],
        ["Config impact", "None - Caddyfile format unchanged"],
        ["Breaking risk", "Very low - single self-contained binary, instant rollback"],
        ["TLS impact (prod)", "None - cert source (AD CS / CA-issued) is unaffected by the binary swap"],
      ], [2600, 6760]),

      h2("3.2 Keycloak 26.6.2 -> 26.6.3"),
      p("26.6.3 is a security release addressing roughly 16 CVEs (OIDC/UMA token handling, SSRF, CORS reflection, WebAuthn registration validations, LDAP federation DoS, token-exchange privilege escalation, refresh-token reuse, and others) plus assorted bug fixes. It is a patch release within the 26.6.x stream."),
      makeTable(["Aspect", "Assessment"], [
        ["Change type", "Security patch (same minor, 26.6.x)"],
        ["DB migration", "No destructive schema change; a startup check for missing DB indexes was added. Keycloak applies any needed schema automatically on first start."],
        ["Config impact", "keycloak.conf carried forward unchanged; build-time options (db=mysql) preserved via kc.bat build"],
        ["LDAP/AD (prod)", "Federation config persists in the DB. Re-verify an AD login after upgrade (see CVE fixes touching LDAP federation)."],
        ["Breaking risk", "Low. Caveat: released same day as this check (4 Jun 2026) - recommend a short soak in the lab/staging before production if schedule permits."],
      ], [2600, 6760]),
      note("Recommendation:", "Apply for the security content. Because 26.6.3 is brand-new, allow the lab instance to run for an observation period (e.g., 24-72h) and confirm AD-federated logins before scheduling the production change, unless an in-scope CVE warrants immediate action."),

      h2("3.3 STIG Manager 1.6.10/1.6.11 -> 1.6.12"),
      p("1.6.11 introduced a \"Review Aging\" service job (disabled by default; must be explicitly enabled per collection) together with security/dependency updates and a forward-only database schema migration. 1.6.12 is a follow-up fix: the 1.6.11 client bundle omitted SM/TaskConfig.js, which broke the Collection Manager - 1.6.12 restores it. Always land on 1.6.12, never 1.6.11."),
      makeTable(["Aspect", "Assessment"], [
        ["Change type", "Point releases; new optional feature + UI build fix"],
        ["DB migration", "YES - 1.6.11 adds a schema migration (applied automatically on start; forward-only). Lab confirmed schema at migration 47, \"up to date\"."],
        ["Default behavior", "Review Aging is OFF by default - no behavior change unless an admin enables it"],
        ["Breaking risk", "Low-moderate, driven solely by the one-way DB migration. Mitigated by a full mysqldump before upgrade."],
      ], [2600, 6760]),
      note("Important:", "The 1.6.11 migration cannot be automatically reversed. A verified database backup (Section 4) is mandatory before starting STIG Manager 1.6.12 against a database currently below schema 47.", "FDE7E9"),

      // 4
      h1("4. Pre-Update Requirements"),
      bullet("Scheduled maintenance window with users notified (services are briefly offline during restarts)."),
      bullet("Administrative (elevated) PowerShell access on the production host."),
      bullet("Production credential vault values on hand (MySQL root, app DB users, Keycloak admin) - do NOT reuse the lab test passwords."),
      bullet("Confirm free disk space (installers ~ 250 MB; backups vary with DB size)."),
      bullet("Download installers from official sources and stage under the Installers folder:"),
      code("stig-manager-win-1.6.12.zip   (NUWCDIVNPT/stig-manager 1.6.12)"),
      code("keycloak-26.6.3.zip            (keycloak/keycloak 26.6.3)"),
      code("caddy_2.11.4_windows_amd64.zip (caddyserver/caddy v2.11.4)"),
      p("Take full database backups before any change (run as the MySQL root account):", { bold: true }),
      code("$env:MYSQL_PWD = '<MYSQL_ROOT_PASSWORD>'"),
      code("& 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe' -u root `"),
      code("    --single-transaction --routines --triggers --databases stigman  > C:\\Backups\\stigman-db.sql"),
      code("& 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe' -u root `"),
      code("    --single-transaction --routines --triggers --databases keycloak > C:\\Backups\\keycloak-db.sql"),
      code("$env:MYSQL_PWD = $null"),
      note("Note:", "Use the root account, not the per-app users - the application accounts lack SHOW VIEW / PROCESS rights and produce an incomplete dump (observed in the lab). Confirm each dump ends with \"Dump completed\". Also copy the current caddy.exe and stig-manager-win.exe aside for binary rollback."),

      // 5
      h1("5. Lab Validation Results (2026-06-04)"),
      p("The full procedure was executed against the lab host and verified end-to-end:"),
      makeTable(["Check", "Result"], [
        ["All five services Running after update", "PASS"],
        ["Caddy version", "v2.11.4"],
        ["STIG Manager API via HTTPS (/api/op/configuration)", "version 1.6.12, lastMigration 47, schema up to date"],
        ["STIG Manager UI root via Caddy", "HTTP 200"],
        ["Keycloak startup", "26.6.3 started, profile prod, no errors"],
        ["Realm endpoint /realms/stigman via Caddy", "HTTP 200"],
        ["Live OIDC token grant (admin-cli)", "SUCCESS - access_token issued"],
        ["Watcher service-account preflight + scan", "preflight succeeded; remoteApiVersion 1.6.12"],
      ], [5400, 3960]),

      // 6
      h1("6. Production Update Procedure"),
      p("Paths below mirror the standard deployment layout (C:\\Services\\...). Run all service operations from an elevated PowerShell session. Substitute production credentials and hostnames where shown in <angle brackets>."),

      h2("6.1 Caddy 2.11.3 -> 2.11.4"),
      num("Expand caddy_2.11.4_windows_amd64.zip to a temp folder and confirm: caddy.exe version -> v2.11.4."),
      num("Stop the service: Stop-Service Caddy"),
      num("Replace the binary: Copy-Item <temp>\\caddy.exe 'C:\\Services\\caddy\\caddy.exe' -Force"),
      num("Start and verify: Start-Service Caddy ; caddy.exe version"),

      h2("6.2 STIG Manager -> 1.6.12"),
      num("Verify current version first: curl -sk https://<host>/api/op/configuration  (if already 1.6.12, skip this section)."),
      num("Confirm the database backup from Section 4 completed successfully."),
      num("Expand stig-manager-win-1.6.12.zip (contains stig-manager-win.exe and stig-manager.bat)."),
      num("Stop the dependent first, then the API (the Watcher depends on STIGManager):"),
      code("Stop-Service STIGManagerWatcher -Force; Stop-Service STIGManager -Force"),
      num("Back up then replace the binary:"),
      code("Copy-Item C:\\Services\\stig-manager\\stig-manager-win.exe ...\\stig-manager-win.exe.bak -Force"),
      code("Copy-Item <temp>\\stig-manager-win.exe C:\\Services\\stig-manager\\stig-manager-win.exe -Force"),
      num("Start the API: Start-Service STIGManager  (the 1.6.11 schema migration runs automatically here)."),
      num("Confirm migration success in C:\\Services\\stig-manager\\stig-manager-svc.out.log - expect \"MySQL schema is up to date\" and no error, and version 1.6.12 from the API."),
      num("Start the watcher: Start-Service STIGManagerWatcher  (confirm \"preflight ... succeeded\" in its log)."),

      h2("6.3 Keycloak 26.6.2 -> 26.6.3"),
      p("Install side-by-side in a new versioned folder so the previous version remains intact for rollback."),
      num("Expand keycloak-26.6.3.zip and move it to C:\\Services\\keycloak-26.6.3."),
      num("Carry forward configuration and the WinSW wrapper from the current 26.6.2 folder:"),
      code("Copy-Item ...keycloak-26.6.2\\conf\\keycloak.conf      ...keycloak-26.6.3\\conf\\ -Force"),
      code("Copy-Item ...keycloak-26.6.2\\keycloak-svc.exe         ...keycloak-26.6.3\\ -Force"),
      code("Copy-Item ...keycloak-26.6.2\\keycloak-svc.xml         ...keycloak-26.6.3\\ -Force"),
      note("Check:", "If cache-ispn.xml, providers\\, or themes\\ were customized in production, copy those too. In the lab cache-ispn.xml matched the stock default and there were no custom providers/themes."),
      num("Build the optimized server (reads db=mysql etc. from keycloak.conf):"),
      code("$env:JAVA_HOME = 'C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot'"),
      code("& C:\\Services\\keycloak-26.6.3\\bin\\kc.bat build     # expect: BUILD EXIT 0"),
      num("Stop the chain that depends on Keycloak, then Keycloak itself:"),
      code("Stop-Service STIGManagerWatcher -Force; Stop-Service STIGManager -Force; Stop-Service Keycloak -Force"),
      num("Repoint the Windows service to the new folder (uninstall old WinSW service, install new):"),
      code("& C:\\Services\\keycloak-26.6.2\\keycloak-svc.exe uninstall"),
      code("& C:\\Services\\keycloak-26.6.3\\keycloak-svc.exe install"),
      num("Confirm service binPath now points to keycloak-26.6.3 and DEPENDENCIES still lists MySQL84 (sc.exe qc Keycloak)."),
      num("Start Keycloak and wait for readiness:"),
      code("Start-Service Keycloak   # poll /realms/stigman/.well-known/openid-configuration until HTTP 200"),
      num("Confirm \"Keycloak 26.6.3 ... started\" and \"Profile prod activated\" in keycloak-svc.out.log."),
      num("Start the application chain: Start-Service STIGManager ; Start-Service STIGManagerWatcher."),
      num("Production only: verify an Active Directory (LDAP-federated) user can log in via the browser."),

      // 7
      h1("7. Rollback Procedure"),
      p("Each component rolls back independently. Always restore from the backups taken in Section 4."),
      h2("7.1 Caddy"),
      bullet("Stop-Service Caddy; restore the saved caddy.exe (2.11.3); Start-Service Caddy."),
      h2("7.2 STIG Manager"),
      bullet("Stop the watcher and API; restore stig-manager-win.exe from the .bak/backup; restart."),
      bullet("If the database migration had already run and the prior binary cannot read the new schema, restore the stigman database from the mysqldump backup before starting the old binary."),
      h2("7.3 Keycloak"),
      bullet("The previous 26.6.2 folder is left intact. To revert: Stop-Service Keycloak; uninstall the 26.6.3 WinSW service; reinstall from C:\\Services\\keycloak-26.6.2\\keycloak-svc.exe; Start-Service Keycloak."),
      bullet("Only if a schema change had been applied: restore the keycloak database from backup before starting 26.6.2."),
      note("Cleanup:", "Once the new versions have soaked and are confirmed stable, the superseded folders (e.g., keycloak-26.6.1, keycloak-26.6.2) and stale binary backups may be removed to reclaim space. Retain at least the immediately-previous version until the next successful update."),

      // 8
      h1("8. Post-Update Validation Checklist"),
      makeTable(["#", "Validation step", "Expected"], [
        ["1", "Get-Service MySQL84, Keycloak, STIGManager, STIGManagerWatcher, Caddy", "All Running"],
        ["2", "caddy.exe version", "v2.11.4"],
        ["3", "GET https://<host>/api/op/configuration", "version 1.6.12; no migration error"],
        ["4", "GET https://<host>/ (UI root)", "HTTP 200"],
        ["5", "GET https://<host>/realms/stigman/.well-known/openid-configuration", "HTTP 200"],
        ["6", "Browser login via OIDC (and AD federation in prod)", "Successful authentication"],
        ["7", "Watcher log shows preflight + scan succeeded", "No auth/API errors"],
        ["8", "Reboot test (optional) - services auto-start in dependency order", "Full stack healthy after reboot"],
      ], [600, 6160, 2600]),

      // Appendix
      h1("Appendix A. Key Paths & Versions (post-update)"),
      makeTable(["Item", "Value"], [
        ["MySQL", "8.4.9 LTS - service MySQL84"],
        ["Keycloak", "26.6.3 - C:\\Services\\keycloak-26.6.3 (WinSW service 'Keycloak', JDK 17)"],
        ["STIG Manager", "1.6.12 - C:\\Services\\stig-manager (WinSW service 'STIGManager')"],
        ["STIG Manager Watcher", "1.6.9 - C:\\Services\\stigman-watcher (WinSW service 'STIGManagerWatcher')"],
        ["Caddy", "2.11.4 - C:\\Services\\caddy (sc.exe service 'Caddy')"],
        ["Service start order", "MySQL84 -> Keycloak -> STIGManager -> STIGManagerWatcher (Caddy independent)"],
        ["Lab backup location", "C:\\Backups\\stigman-update-2026-06-04 (DB dumps + prior binaries/config)"],
      ], [2800, 6560]),
      p(""),
      p("End of document.", { italics: true }),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  const out = require("path").join(__dirname, "deliverables", "STIG-Manager-Update-2026-06-04-Production.docx");
  fs.writeFileSync(out, buf);
  console.log("WROTE " + out + "  (" + buf.length + " bytes)");
});
