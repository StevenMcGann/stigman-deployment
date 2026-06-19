const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, ExternalHyperlink,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, TableOfContents
} = require("docx");

// ── Reusable builders ──────────────────────────────────
const codePr = { font: "Consolas", size: 18 };
const codeShade = { fill: "F5F5F5", type: ShadingType.CLEAR, color: "auto" };
const codeBlockProps = { shading: codeShade, spacing: { before: 40, after: 40 }, indent: { left: 360 } };
const notePr = { font: "Calibri", size: 22, italics: true, color: "666666" };
const importantPr = { font: "Calibri", size: 22, italics: true, color: "C00000" };

function code(t) { const para = new Paragraph({ ...codeBlockProps, children: [new TextRun({ ...codePr, text: t })] }); para.__code = { text: t }; return para; }
function codeComment(t) { const para = new Paragraph({ ...codeBlockProps, children: [new TextRun({ ...codePr, text: t, color: "808080" })] }); para.__code = { text: t, color: "808080" }; return para; }
// Merge consecutive code()/codeComment() paragraphs into ONE shaded paragraph
// whose lines are separated by soft line breaks (<w:br/>). A single paragraph
// copies as one contiguous block, so the line breaks survive a paste into a
// terminal or editor. Emitting each line as its own paragraph (the previous
// approach) let some .docx viewers flatten the breaks to spaces on copy, which
// silently broke multi-line commands — e.g. a leading "-- " SQL comment then
// swallowed every statement below it, so the DB/user were never created and
// MySQL reported no error.
function mergeCodeBlocks(children) {
  const out = [];
  for (let i = 0; i < children.length; i++) {
    const el = children[i];
    if (el && el.__code) {
      const group = [el.__code];
      while (i + 1 < children.length && children[i + 1] && children[i + 1].__code) { group.push(children[++i].__code); }
      const runs = group.map((g, idx) => new TextRun({ ...codePr, ...(g.color ? { color: g.color } : {}), ...(idx > 0 ? { break: 1 } : {}), text: g.text }));
      out.push(new Paragraph({ ...codeBlockProps, children: runs }));
    } else {
      out.push(el);
    }
  }
  return out;
}
function note(t) {
  return new Paragraph({ spacing: { before: 120, after: 120 }, indent: { left: 360 },
    children: [new TextRun({ ...notePr, bold: true, text: "Note: " }), new TextRun({ ...notePr, text: t })] });
}
function important(t) {
  return new Paragraph({ spacing: { before: 120, after: 120 }, indent: { left: 360 },
    shading: { fill: "FFF2F2", type: ShadingType.CLEAR, color: "auto" },
    children: [new TextRun({ ...importantPr, bold: true, text: "Important: " }), new TextRun({ ...importantPr, text: t })] });
}
function h1(t) { return new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] }); }
function h2(t) { return new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] }); }
function p(t) { return new Paragraph({ spacing: { after: 100 }, children: [new TextRun(t)] }); }
function pRuns(...runs) { return new Paragraph({ spacing: { after: 100 }, children: runs }); }
function pBold(t) { return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t, bold: true })] }); }
function blank() { return new Paragraph({}); }
function pb() { return new Paragraph({ children: [new PageBreak()] }); }
function bullet(t, lvl = 0) { return new Paragraph({ numbering: { reference: "bullets", level: lvl }, children: [new TextRun(t)] }); }
function bulletRuns(runs, lvl = 0) { return new Paragraph({ numbering: { reference: "bullets", level: lvl }, children: runs }); }
function numItem(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers", level: lvl }, children: [new TextRun(t)] }); }
function numItemRuns(runs, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers", level: lvl }, children: runs }); }

// Second independent numbering sequence (restarts at 1)
function numItem2(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers2", level: lvl }, children: [new TextRun(t)] }); }
function numItem3(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers3", level: lvl }, children: [new TextRun(t)] }); }
function numItem4(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers4", level: lvl }, children: [new TextRun(t)] }); }
function numItem5(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers5", level: lvl }, children: [new TextRun(t)] }); }
function numItem6(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers6", level: lvl }, children: [new TextRun(t)] }); }
function numItem7(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers7", level: lvl }, children: [new TextRun(t)] }); }
function numItem7Runs(runs, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers7", level: lvl }, children: runs }); }
function numItem8(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers8", level: lvl }, children: [new TextRun(t)] }); }
function numItem9(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers9", level: lvl }, children: [new TextRun(t)] }); }
function numItem10(t, lvl = 0) { return new Paragraph({ numbering: { reference: "numbers10", level: lvl }, children: [new TextRun(t)] }); }
function checklist(t) { return new Paragraph({ numbering: { reference: "checklist", level: 0 }, children: [new TextRun(t)] }); }

const tBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const tBorders = { top: tBorder, bottom: tBorder, left: tBorder, right: tBorder };
function tc(text, opts = {}) {
  return new TableCell({ borders: tBorders, width: { size: opts.w || 2340, type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    shading: opts.hdr ? { fill: "2E75B6", type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text, bold: !!opts.hdr, color: opts.hdr ? "FFFFFF" : "000000", font: opts.mono ? "Consolas" : "Calibri", size: opts.mono ? 18 : 20 })] })] });
}

// ── Document ───────────────────────────────────────────
const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 24 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Calibri", color: "2E75B6" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 1 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Calibri", color: "2E75B6" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      { level: 1, format: LevelFormat.BULLET, text: "◦", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
    ]},
    { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers2", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers3", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers4", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers5", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers6", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers7", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers8", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers9", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "numbers10", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    { reference: "checklist", levels: [
      { level: 0, format: LevelFormat.BULLET, text: "☐", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
    ]},
  ]},
  sections: [{
    properties: {
      page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
    },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: "STIG Manager OSS — Installation & Production Transition Guide", size: 16, color: "999999" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Page ", size: 16, color: "999999" }), new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "999999" })] })] }) },
    children: mergeCodeBlocks([
      // ── Title Page ──
      blank(), blank(), blank(),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "STIG Manager OSS", bold: true, size: 56 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Installation & Production Transition Guide", bold: true, size: 40 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Step-by-Step Deployment and Hardening Instructions", size: 28, color: "666666" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "Version 1.6.12  —  June 2026", size: 24, color: "666666" })] }),
      pb(),

      // ── TOC ──
      h1("Table of Contents"),
      new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 1: Prerequisites
      // ══════════════════════════════════════════════════
      h1("1. Prerequisites and Software Downloads"),
      p("This guide walks you through installing STIG Manager OSS on a Windows Server. STIG Manager is a web application for managing DISA STIG assessments, replacing manual .ckl file management with a centralized platform."),
      blank(),

      h2("Required Software"),
      p("Download all of the following before starting the installation:"),
      blank(),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2600, 1400, 2680, 2680],
        rows: [
          new TableRow({ children: [tc("Component",{hdr:true,w:2600}), tc("Version",{hdr:true,w:1400}), tc("Download",{hdr:true,w:2680}), tc("Purpose",{hdr:true,w:2680})] }),
          new TableRow({ children: [tc("MySQL Community Server",{w:2600}), tc("8.4.9 (MSI)",{w:1400}), tc("dev.mysql.com/downloads/mysql",{w:2680}), tc("Database backend",{w:2680})] }),
          new TableRow({ children: [tc("Microsoft OpenJDK",{w:2600}), tc("17.0.19 (MSI)",{w:1400}), tc("learn.microsoft.com/java/openjdk",{w:2680}), tc("Java runtime for Keycloak",{w:2680})] }),
          new TableRow({ children: [tc("Keycloak",{w:2600}), tc("26.6.3 (ZIP)",{w:1400}), tc("keycloak.org/downloads",{w:2680}), tc("Identity/auth provider (OIDC)",{w:2680})] }),
          new TableRow({ children: [tc("STIG Manager",{w:2600}), tc("1.6.12 (ZIP)",{w:1400}), tc("github.com/NUWCDIVNPT/stig-manager",{w:2680}), tc("The application",{w:2680})] }),
          new TableRow({ children: [tc("STIG Manager Watcher",{w:2600}), tc("1.6.9 (ZIP)",{w:1400}), tc("github.com/NUWCDIVNPT/stigman-watcher",{w:2680}), tc("Automated file import (optional, Section 10)",{w:2680})] }),
          new TableRow({ children: [tc("Caddy Server",{w:2600}), tc("2.11.4 (EXE)",{w:1400}), tc("github.com/caddyserver/caddy/releases",{w:2680}), tc("Reverse proxy with auto-TLS",{w:2680})] }),
          new TableRow({ children: [tc("WinSW",{w:2600}), tc("2.12.0 (EXE)",{w:1400}), tc("github.com/winsw/winsw/releases",{w:2680}), tc("Windows service wrapper",{w:2680})] }),
        ],
      }),
      blank(),
      note("The versions listed are the baseline this guide was written and validated against. Newer patch releases generally work, but follow Section 16 (Applying Updates) when moving to a newer version."),
      note("For STIG Manager and the Watcher, download the Windows standalone binary (stig-manager-win-x.x.x.zip / stigman-watcher-win-x.x.x.zip) from the GitHub Releases pages. For Caddy, download the Windows amd64 binary from the GitHub Releases page for the version above (the caddyserver.com download page only serves the newest build). For WinSW, download WinSW-x64.exe."),
      blank(),

      h2("Server Requirements"),
      bullet("Windows Server 2019 or 2022"),
      bullet("At least 4 GB RAM (8 GB recommended)"),
      bullet("At least 10 GB free disk space"),
      bullet("Administrator access to the server"),
      bullet("Port 443 (HTTPS) open for web access"),
      blank(),

      h2("Prepare the Working Directory"),
      p("Copy all downloaded installer files to a single working directory on the server. This guide assumes C:\\Installers:"),
      code("New-Item -ItemType Directory -Path C:\\Installers -Force"),
      p("Copy the following files into C:\\Installers:"),
      bullet("mysql-8.4.9-winx64.msi"),
      bullet("microsoft-jdk-17.0.19-windows-x64.msi"),
      bullet("keycloak-26.6.3.zip"),
      bullet("stig-manager-win-1.6.12.zip"),
      bullet("stigman-watcher-win-1.6.9.zip (optional, Section 10)"),
      bullet("caddy_windows_amd64.exe (2.11.4)"),
      bullet("WinSW-x64.exe"),
      bullet("stigman-realm.json (provided with this guide)"),
      blank(),
      p("Also copy the service configuration files from the deliverables\\service-configs folder:"),
      bullet("Caddyfile"),
      bullet("keycloak.conf"),
      bullet("keycloak-svc.xml"),
      bullet("stig-manager-svc.xml"),
      bullet("stigman-watcher-svc.xml (optional, Section 10)"),
      note("The service config files are pre-built and ready to use. You will only need to update the server IP/hostname and database passwords to match your environment."),
      blank(),

      h2("Directory Structure"),
      p("Create the services directory. All services will be installed under C:\\Services:"),
      code("New-Item -ItemType Directory -Path C:\\Services -Force"),
      blank(),
      p("After installation, the directory structure will be:"),
      code("C:\\Services\\"),
      code("  keycloak-26.6.3\\     Keycloak identity provider"),
      code("  stig-manager\\        STIG Manager application"),
      code("  stigman-watcher\\     STIG Manager Watcher (optional)"),
      code("  caddy\\               Caddy reverse proxy"),
      blank(),

      h2("Open the Firewall"),
      p("Open port 443 for HTTPS access from network clients:"),
      code("New-NetFirewallRule -DisplayName 'STIG Manager HTTPS' -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow"),
      note("If your organization uses Group Policy to manage firewall rules, this may need to be done through GPO instead."),
      blank(),

      h2("Two Ways to Install: Scripts (Recommended) or Manual Steps"),
      p("The stock Windows Server console (Windows PowerShell 5.1 with PSReadLine 2.0 in conhost) cannot reliably paste multi-line commands: a pasted block is often run one line at a time, and characters can be dropped or merged. This silently breaks multi-step commands such as the SQL in Section 2.3 — and it happens no matter whether you copy from the Word document or the Markdown guide, because the problem is the console doing the pasting, not the document."),
      important("Because of this, the recommended way to install is to run the provided scripts, which perform every step with no copy-pasting. Use the manual steps only if you specifically want to perform each action yourself."),
      blank(),
      pBold("Scripted installation (recommended):"),
      pRuns(
        new TextRun("Step 1 — Edit "),
        new TextRun({ text: "install\\stigman-config.ps1", font: "Consolas", size: 20 }),
        new TextRun(" and set your server address and passwords:"),
      ),
      code("notepad install\\stigman-config.ps1"),
      p("Step 2 — From an elevated (Administrator) PowerShell, run the installer:"),
      code("powershell -NoProfile -ExecutionPolicy Bypass -File .\\install\\Install-All.ps1"),
      p("The installer performs Sections 2 through 7 in order and is safe to re-run (each step skips work already done). When it finishes, continue at Section 8 (Verify the Installation)."),
      note("Prefer to go step by step? Each phase also has its own script in the install\\ folder (Initialize-MySql.ps1, Create-Databases.ps1, Install-Java.ps1, Install-Keycloak.ps1, Install-StigManager.ps1, Install-Caddy.ps1, Register-Services.ps1, Import-Realm.ps1). Run them in that order, each as shown in Step 2."),
      note("Sections 2–7 below document the same actions manually, for reference and troubleshooting. If you do follow them by hand, paste one line at a time — do not paste a whole block at once."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 2: MySQL
      // ══════════════════════════════════════════════════
      h1("2. Install MySQL 8.4"),
      p("MySQL stores all STIG Manager data (assessments, collections, STIGs) and Keycloak user/session data."),
      blank(),

      h2("Step 2.1: Run the MySQL Installer"),
      p("Run from an elevated PowerShell:"),
      code("Start-Process msiexec.exe -ArgumentList '/i', 'C:\\Installers\\mysql-8.4.9-winx64.msi', '/quiet' -Wait"),
      p("MySQL will be installed to C:\\Program Files\\MySQL\\MySQL Server 8.4\\"),
      blank(),

      h2("Step 2.2: Initialize the Database"),
      p("MySQL needs to be initialized before first use. This creates the data directory, system tables, and registers the Windows service."),
      blank(),
      code("cd 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin'"),
      code(".\\mysqld.exe --initialize-insecure --console"),
      code(".\\mysqld.exe --install MySQL84"),
      code("Start-Service MySQL84"),
      note("The --initialize-insecure flag creates a root account with no password. We will set a password in the next step. The service name MySQL84 is used throughout this guide and must match the service dependency names in the WinSW configuration files."),
      blank(),

      h2("Step 2.3: Create Databases and Users"),
      p("Connect to MySQL and create the databases and service accounts:"),
      code("& 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe' -u root"),
      blank(),
      p("Paste the following SQL commands. This guide uses the test passwords shown below. See Appendix B for all default credentials."),
      important("Replace all passwords with strong, unique values before deploying to production."),
      blank(),
      code("ALTER USER 'root'@'localhost' IDENTIFIED BY 'STIGman_Root_2026!';"),
      blank(),
      pBold("STIG Manager database and user:"),
      code("CREATE DATABASE stigman CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"),
      code("CREATE USER 'stigman'@'localhost' IDENTIFIED BY 'STIGman_DB_2026!';"),
      code("GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX,"),
      code("  REFERENCES, CREATE VIEW, LOCK TABLES, CREATE ROUTINE, ALTER ROUTINE,"),
      code("  EXECUTE, EVENT, CREATE TEMPORARY TABLES ON stigman.* TO 'stigman'@'localhost';"),
      code("GRANT SELECT ON performance_schema.* TO 'stigman'@'localhost';"),
      blank(),
      pBold("Keycloak database and user:"),
      code("CREATE DATABASE keycloak CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"),
      code("CREATE USER 'keycloak'@'localhost' IDENTIFIED BY 'Keycloak_DB_2026!';"),
      code("GRANT ALL PRIVILEGES ON keycloak.* TO 'keycloak'@'localhost';"),
      blank(),
      code("FLUSH PRIVILEGES;"),
      code("EXIT;"),
      note("Record the passwords you chose. The stigman password is needed in Section 5 (stig-manager-svc.xml) and the keycloak password in Section 4 (keycloak.conf)."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 3: Java
      // ══════════════════════════════════════════════════
      h1("3. Install Microsoft OpenJDK 17"),
      p("Keycloak requires Java 17 to run. Microsoft’s build of OpenJDK is recommended for Windows Server."),
      blank(),
      numItem("Run the OpenJDK MSI installer:"),
      code("Start-Process msiexec.exe -ArgumentList '/i', 'C:\\Installers\\microsoft-jdk-17.0.19-windows-x64.msi', '/quiet' -Wait"),
      blank(),
      numItem("Set the JAVA_HOME environment variable:"),
      code("[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot', 'Machine')"),
      blank(),
      numItem("Refresh your session and verify Java is accessible:"),
      code("$env:JAVA_HOME = 'C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot'"),
      code("$env:PATH = \"$env:JAVA_HOME\\bin;$env:PATH\""),
      code("java -version"),
      p("You should see output showing OpenJDK 17.0.19."),
      note("The SetEnvironmentVariable command persists JAVA_HOME permanently, but the current PowerShell session needs the two $env lines to pick it up immediately. New PowerShell windows will have it automatically."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 4: Keycloak
      // ══════════════════════════════════════════════════
      h1("4. Install and Configure Keycloak"),
      p("Keycloak provides OpenID Connect (OIDC) authentication for STIG Manager. Users log in through Keycloak before accessing the application."),
      blank(),

      h2("Step 4.1: Extract Keycloak"),
      p("Extract the Keycloak ZIP to C:\\Services:"),
      code("cd C:\\Installers"),
      code("Expand-Archive keycloak-26.6.3.zip -DestinationPath C:\\Services"),
      p("This creates C:\\Services\\keycloak-26.6.3\\"),
      blank(),

      h2("Step 4.2: Configure Keycloak"),
      pRuns(
        new TextRun("You can either copy the pre-built "),
        new TextRun({ text: "keycloak.conf", font: "Consolas", size: 20 }),
        new TextRun(" from the deliverables\\service-configs folder, or create the file manually.")
      ),
      blank(),
      pRuns(
        new TextRun({ text: "Option A: ", bold: true }),
        new TextRun("Copy from deliverables (recommended):"),
      ),
      code("Copy-Item C:\\Installers\\keycloak.conf C:\\Services\\keycloak-26.6.3\\conf\\keycloak.conf"),
      blank(),
      pRuns(
        new TextRun({ text: "Option B: ", bold: true }),
        new TextRun("Create manually. Edit C:\\Services\\keycloak-26.6.3\\conf\\keycloak.conf:"),
      ),
      codeComment("# Database"),
      code("db=mysql"),
      code("db-url-host=localhost"),
      code("db-url-database=keycloak"),
      code("db-username=keycloak"),
      code("db-password=Keycloak_DB_2026!"),
      blank(),
      codeComment("# Hostname (frontend URL as seen by browsers through Caddy)"),
      code("hostname=https://YOUR_SERVER_IP"),
      code("hostname-backchannel-dynamic=true"),
      blank(),
      codeComment("# HTTP settings (Caddy terminates TLS, Keycloak listens on HTTP)"),
      code("http-enabled=true"),
      code("http-port=8080"),
      code("proxy-headers=xforwarded"),
      blank(),
      important("Replace Keycloak_DB_2026! with the Keycloak database password from Step 2.3. Replace YOUR_SERVER_IP with your server’s IP address or DNS hostname (e.g., 192.168.1.100 or stigman.yourdomain.mil)."),
      note("The hostname value must use https:// and match the address clients will use in their browser. This same value must also appear in the Caddyfile (Section 6) and stig-manager-svc.xml (Section 5)."),
      blank(),

      h2("Step 4.3: Create the Keycloak Admin Account"),
      p("Keycloak 26.x uses the bootstrap-admin CLI command to create the initial administrator account. This runs against the database directly and does not require Keycloak to be running."),
      blank(),
      numItem2("Set the admin password in an environment variable:"),
      code("$env:KC_BOOTSTRAP_ADMIN_PASSWORD = 'Admin_KC_2026!'"),
      blank(),
      numItem2("Run the bootstrap-admin command:"),
      code("cd C:\\Services\\keycloak-26.6.3"),
      code(".\\bin\\kc.bat bootstrap-admin user --username admin --password:env KC_BOOTSTRAP_ADMIN_PASSWORD"),
      p("You should see \"Created temporary admin user\" in the output. Keycloak will briefly start and stop as part of this process."),
      blank(),
      note("This admin account is for Keycloak administration only (realm management, user management). It is separate from the STIG Manager application users created in the next step. Replace Admin_KC_2026! with a strong password."),
      blank(),

      h2("Step 4.4: Import the STIG Manager Realm"),
      p("The realm import creates the STIG Manager OIDC client, required scopes, protocol mappers, and test user accounts. Start Keycloak temporarily in development mode, import the realm, then stop it."),
      blank(),
      numItem3("Start Keycloak in development mode:"),
      code("cd C:\\Services\\keycloak-26.6.3"),
      code(".\\bin\\kc.bat start-dev"),
      p("Wait until you see \"Keycloak started\" in the console output (about 30–60 seconds)."),
      blank(),
      numItem3("In a separate elevated PowerShell window, get an admin token:"),
      code("$body = @{ grant_type = 'password'; client_id = 'admin-cli'; username = 'admin'; password = 'Admin_KC_2026!' }"),
      code("$token = Invoke-RestMethod -Uri 'http://localhost:8080/realms/master/protocol/openid-connect/token' -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded'"),
      code("$headers = @{ Authorization = 'Bearer ' + $token.access_token; 'Content-Type' = 'application/json' }"),
      blank(),
      numItem3("Import the realm JSON file:"),
      code("$realmJson = Get-Content C:\\Installers\\stigman-realm.json -Raw"),
      code("Invoke-WebRequest -Uri 'http://localhost:8080/admin/realms' -Method Post -Headers $headers -Body $realmJson -UseBasicParsing"),
      blank(),
      numItem3("Verify the realm was imported:"),
      code("Invoke-RestMethod -Uri 'http://localhost:8080/admin/realms/stigman' -Headers $headers | Select-Object realm, enabled"),
      p("You should see the realm name \"stigman\" with enabled = True."),
      blank(),
      numItem3("Stop Keycloak by pressing Ctrl+C in the console window where kc.bat is running."),
      note("Keycloak must be stopped before it can be built for production mode and registered as a service in Section 7."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 5: STIG Manager
      // ══════════════════════════════════════════════════
      h1("5. Install and Configure STIG Manager"),
      p("STIG Manager is the main application that users interact with for managing STIG assessments."),
      blank(),

      h2("Step 5.1: Extract STIG Manager"),
      p("Create the directory and extract:"),
      code("New-Item -ItemType Directory -Path C:\\Services\\stig-manager -Force"),
      code("cd C:\\Installers"),
      code("Expand-Archive stig-manager-win-1.6.12.zip -DestinationPath C:\\Services\\stig-manager"),
      blank(),
      p("Verify the executable was extracted:"),
      code("Test-Path C:\\Services\\stig-manager\\stig-manager-win.exe"),
      note("If the ZIP contains a nested folder (e.g., stig-manager-win-1.6.12\\), move the contents up one level so that stig-manager-win.exe is directly in C:\\Services\\stig-manager\\."),
      blank(),

      h2("Step 5.2: Set Up WinSW Service Wrapper"),
      p("STIG Manager and Keycloak both use WinSW to run as Windows services. Copy the WinSW executable for each:"),
      blank(),
      numItem4("Copy WinSW for STIG Manager:"),
      code("Copy-Item C:\\Installers\\WinSW-x64.exe C:\\Services\\stig-manager\\stig-manager-svc.exe"),
      blank(),
      numItem4("Copy WinSW for Keycloak:"),
      code("Copy-Item C:\\Installers\\WinSW-x64.exe C:\\Services\\keycloak-26.6.3\\keycloak-svc.exe"),
      note("WinSW requires the .exe and .xml files to share the same base name in the same directory. For example, stig-manager-svc.exe looks for stig-manager-svc.xml."),
      blank(),

      h2("Step 5.3: Create the STIG Manager Service Configuration"),
      pRuns(
        new TextRun("You can either copy the pre-built "),
        new TextRun({ text: "stig-manager-svc.xml", font: "Consolas", size: 20 }),
        new TextRun(" from deliverables\\service-configs, or create it manually.")
      ),
      blank(),
      pRuns(
        new TextRun({ text: "Option A: ", bold: true }),
        new TextRun("Copy from deliverables (recommended):"),
      ),
      code("Copy-Item C:\\Installers\\stig-manager-svc.xml C:\\Services\\stig-manager\\stig-manager-svc.xml"),
      blank(),
      pRuns(
        new TextRun({ text: "Option B: ", bold: true }),
        new TextRun("Create manually. Create C:\\Services\\stig-manager\\stig-manager-svc.xml:"),
      ),
      code("<service>"),
      code("  <id>STIGManager</id>"),
      code("  <name>STIG Manager</name>"),
      code("  <description>STIG Manager OSS - DISA STIG assessment management</description>"),
      code("  <executable>%BASE%\\stig-manager-win.exe</executable>"),
      code("  <log mode=\"roll-by-size\">"),
      code("    <sizeThreshold>10240</sizeThreshold>"),
      code("    <keepFiles>3</keepFiles>"),
      code("  </log>"),
      code("  <env name=\"STIGMAN_DB_HOST\" value=\"localhost\" />"),
      code("  <env name=\"STIGMAN_DB_PORT\" value=\"3306\" />"),
      code("  <env name=\"STIGMAN_DB_USER\" value=\"stigman\" />"),
      code("  <env name=\"STIGMAN_DB_PASSWORD\" value=\"STIGman_DB_2026!\" />"),
      code("  <env name=\"STIGMAN_DB_SCHEMA\" value=\"stigman\" />"),
      code("  <env name=\"STIGMAN_API_ADDRESS\" value=\"0.0.0.0\" />"),
      code("  <env name=\"STIGMAN_CLASSIFICATION\" value=\"U\" />"),
      code("  <env name=\"STIGMAN_OIDC_PROVIDER\" value=\"http://localhost:8080/realms/stigman\" />"),
      code("  <env name=\"STIGMAN_CLIENT_OIDC_PROVIDER\" value=\"https://YOUR_SERVER_IP/realms/stigman\" />"),
      code("  <depend>MySQL84</depend>"),
      code("  <depend>Keycloak</depend>"),
      code("</service>"),
      blank(),
      important("Replace STIGman_DB_2026! with the stigman database password from Step 2.3. Replace YOUR_SERVER_IP in STIGMAN_CLIENT_OIDC_PROVIDER with the same IP or hostname used in keycloak.conf."),
      note("STIGMAN_OIDC_PROVIDER is the server-to-server URL (localhost). STIGMAN_CLIENT_OIDC_PROVIDER is the URL browsers use to reach Keycloak through Caddy. These must be different. The <depend> tags ensure STIG Manager waits for MySQL and Keycloak to start first."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 6: Caddy
      // ══════════════════════════════════════════════════
      h1("6. Install and Configure Caddy (Reverse Proxy)"),
      p("Caddy serves as the front door to your deployment. It handles HTTPS/TLS encryption and routes traffic to the correct backend service (STIG Manager or Keycloak)."),
      blank(),

      h2("Step 6.1: Set Up Caddy"),
      p("Create the Caddy directory and copy the executable:"),
      code("New-Item -ItemType Directory -Path C:\\Services\\caddy -Force"),
      code("Copy-Item C:\\Installers\\caddy_windows_amd64.exe C:\\Services\\caddy\\caddy.exe"),
      note("Caddy's GitHub release is a .zip (e.g., caddy_2.11.4_windows_amd64.zip) that contains caddy.exe. If you downloaded the zip, extract it first and copy the caddy.exe inside it to C:\\Services\\caddy\\caddy.exe. The Install-Caddy.ps1 script handles either form automatically."),
      blank(),

      h2("Step 6.2: Create the Caddyfile"),
      pRuns(
        new TextRun("Copy the pre-built Caddyfile or create "),
        new TextRun({ text: "C:\\Services\\caddy\\Caddyfile", font: "Consolas", size: 20 }),
        new TextRun(" with the following content:"),
      ),
      blank(),
      code("YOUR_SERVER_IP, localhost {"),
      code("    tls internal"),
      blank(),
      codeComment("    # Keycloak paths (OIDC, login page resources, and admin console)"),
      code("    handle /realms/* {"),
      code("        reverse_proxy localhost:8080"),
      code("    }"),
      code("    handle /resources/* {"),
      code("        reverse_proxy localhost:8080"),
      code("    }"),
      code("    handle /admin/* {"),
      code("        reverse_proxy localhost:8080"),
      code("    }"),
      blank(),
      codeComment("    # API routes: disable caching to prevent 304 issues with ExtJS"),
      code("    handle /api/* {"),
      code("        header Cache-Control \"no-store\""),
      code("        reverse_proxy localhost:54000 {"),
      code("            flush_interval -1"),
      code("        }"),
      code("    }"),
      blank(),
      codeComment("    # All other traffic (web UI and static assets)"),
      code("    handle {"),
      code("        reverse_proxy localhost:54000"),
      code("    }"),
      code("}"),
      blank(),
      important("Replace YOUR_SERVER_IP with your server’s IP address or DNS hostname. This must match the hostname value in keycloak.conf (without the https:// prefix)."),
      note("The “tls internal” directive generates a self-signed certificate for initial testing. For production deployments with CA-issued certificates, see Section 12 (Install TLS Certificates). Including “localhost” allows access from the server itself during setup."),
      important("The /admin route is required for the Keycloak admin console (used in Sections 10.2 and 13). Without it, browsing to https://YOUR_SERVER_IP/admin returns “Cannot GET /admin” because the request falls through to STIG Manager instead of Keycloak."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 7: Services
      // ══════════════════════════════════════════════════
      h1("7. Register Windows Services"),
      p("All commands in this section must be run in an elevated (Administrator) PowerShell."),
      blank(),

      h2("Step 7.1: Build Keycloak for Production Mode"),
      p("Before registering Keycloak as a service, it must be built for production mode. The build step reads keycloak.conf and optimizes Keycloak’s startup configuration."),
      blank(),
      code("$env:JAVA_HOME = 'C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot'"),
      code("cd C:\\Services\\keycloak-26.6.3"),
      code(".\\bin\\kc.bat build"),
      p("Wait for the build to complete. You should see “Server build done.”"),
      important("You must run kc.bat build any time you change keycloak.conf. The service uses “start --optimized” which requires a prior build."),
      blank(),

      h2("Step 7.2: Create the Keycloak Service Configuration"),
      pRuns(
        new TextRun("Copy "),
        new TextRun({ text: "keycloak-svc.xml", font: "Consolas", size: 20 }),
        new TextRun(" from deliverables\\service-configs, or create it manually at C:\\Services\\keycloak-26.6.3\\keycloak-svc.xml:"),
      ),
      blank(),
      code("<service>"),
      code("  <id>Keycloak</id>"),
      code("  <name>Keycloak</name>"),
      code("  <description>Keycloak OIDC Identity Provider for STIG Manager</description>"),
      code("  <executable>cmd.exe</executable>"),
      code("  <arguments>/c \"%BASE%\\bin\\kc.bat\" start --optimized</arguments>"),
      code("  <env name=\"JAVA_HOME\" value=\"C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot\" />"),
      code("  <workingdirectory>%BASE%</workingdirectory>"),
      code("  <log mode=\"roll-by-size\">"),
      code("    <sizeThreshold>10240</sizeThreshold>"),
      code("    <keepFiles>3</keepFiles>"),
      code("  </log>"),
      code("  <depend>MySQL84</depend>"),
      code("</service>"),
      note("The WinSW wrapper invokes cmd.exe /c kc.bat rather than java.exe directly. This is required because kc.bat sets essential JVM properties (-Dkc.home.dir, etc.) that Keycloak needs to function correctly."),
      blank(),

      h2("Step 7.3: Register All Services"),
      p("Register and start each service in dependency order:"),
      blank(),
      pBold("Caddy (reverse proxy):"),
      code("sc.exe create Caddy binPath= '\"C:\\Services\\caddy\\caddy.exe\" run --config \"C:\\Services\\caddy\\Caddyfile\"' start= auto"),
      code("sc.exe description Caddy 'Caddy reverse proxy for STIG Manager'"),
      blank(),
      pBold("Keycloak (identity provider):"),
      code("cd C:\\Services\\keycloak-26.6.3"),
      code(".\\keycloak-svc.exe install"),
      blank(),
      pBold("STIG Manager (application):"),
      code("cd C:\\Services\\stig-manager"),
      code(".\\stig-manager-svc.exe install"),
      blank(),

      h2("Step 7.4: Start Services"),
      p("Start all services in dependency order, allowing time for each to initialize:"),
      code("Start-Service MySQL84"),
      code("Start-Sleep -Seconds 5"),
      code("Start-Service Keycloak"),
      code("Start-Sleep -Seconds 30"),
      code("Start-Service STIGManager"),
      code("Start-Sleep -Seconds 10"),
      code("Start-Service Caddy"),
      note("Keycloak takes 30–60 seconds to fully start. If STIG Manager starts before Keycloak is ready, it will retry the OIDC connection automatically."),
      blank(),

      h2("Step 7.5: Verify Service Dependencies"),
      p("The WinSW <depend> tags and sc.exe registration ensure services start in the correct order:"),
      bullet("MySQL84 → no dependencies (starts first)"),
      bullet("Keycloak → depends on MySQL84"),
      bullet("STIGManager → depends on MySQL84 and Keycloak"),
      bullet("Caddy → no hard dependency (reverse proxy retries upstream connections automatically)"),
      blank(),
      p("Verify with:"),
      code("sc.exe qc Keycloak"),
      code("sc.exe qc STIGManager"),
      p("In the output, look for the DEPENDENCIES line. Keycloak should list MySQL84; STIGManager should list both MySQL84 and Keycloak."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 8: Verify
      // ══════════════════════════════════════════════════
      h1("8. Verify the Installation"),
      blank(),
      h2("Step 8.1: Check All Services Are Running"),
      code("Get-Service MySQL84, Keycloak, STIGManager, Caddy | Format-Table Name, Status, StartType"),
      p("All four services should show Status: Running and StartType: Automatic."),
      blank(),

      h2("Step 8.2: Verify the API"),
      p("Test that STIG Manager is responding by querying the API directly (bypasses Caddy TLS):"),
      code("$api = Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition'"),
      code("Write-Host \"STIG Manager version: $($api.info.version)\""),
      p("You should see: STIG Manager version: 1.6.12"),
      blank(),
      p("Also verify Keycloak is serving the STIG Manager realm:"),
      code("$kc = Invoke-RestMethod -Uri 'http://localhost:8080/realms/stigman/.well-known/openid-configuration'"),
      code("Write-Host \"Keycloak issuer: $($kc.issuer)\""),
      p("You should see the issuer URL matching your server address (e.g., https://YOUR_SERVER_IP/realms/stigman)."),
      blank(),
      p("Verify Caddy is listening on HTTPS:"),
      code("Test-NetConnection -ComputerName localhost -Port 443 | Select-Object TcpTestSucceeded"),
      note("These verification commands use the direct backend HTTP ports (54000 and 8080) to avoid self-signed certificate issues in PowerShell 5.1. The browser test in Step 8.3 verifies the full HTTPS path through Caddy."),
      blank(),

      h2("Step 8.3: Access STIG Manager"),
      numItem5("Trust Caddy's self-signed root CA so the browser accepts the certificate (skip if you installed a CA-issued certificate per Section 12). Without this, STIG Manager's web client cannot register its ServiceWorker and the app hangs at \"Authorizing\" with a SecurityError, code 18 — clicking through the browser warning is not enough. From an elevated PowerShell at the repo root, run:"),
      code("powershell -NoProfile -ExecutionPolicy Bypass -File .\\install\\Trust-CaddyCert.ps1"),
      note("For network clients (browsing from another machine), copy C:\\Services\\caddy\\caddy-root-ca.crt (exported by the script) to each client and import it into the Local Machine \"Trusted Root Certification Authorities\" store, or install a CA-issued certificate per Section 12."),
      numItem5("Open a web browser (fully close and reopen it if it was already running) and navigate to https://YOUR_SERVER_IP/"),
      numItem5("You will see the Keycloak login page branded “STIG Manager”."),
      numItem5("Log in with one of the test accounts from stigman-realm.json:"),
      blank(),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2400, 3000, 3960],
        rows: [
          new TableRow({ children: [tc("Username",{hdr:true,w:2400}), tc("Password",{hdr:true,w:3000}), tc("Access Level",{hdr:true,w:3960})] }),
          new TableRow({ children: [tc("stigman-admin",{w:2400,mono:true}), tc("STIGman_Admin_2026!",{w:3000,mono:true}), tc("Full admin — manage collections, users, STIGs",{w:3960})] }),
          new TableRow({ children: [tc("stigman-user",{w:2400,mono:true}), tc("STIGman_User_2026!",{w:3000,mono:true}), tc("Standard user — create collections, run assessments",{w:3960})] }),
        ],
      }),
      blank(),
      numItem5("After login, you should see the STIG Manager home page with the UNCLASSIFIED classification banner."),
      note("These test accounts and passwords are defined in stigman-realm.json. Change all passwords before deploying to production. See Section 14 (Change Default Passwords) for the procedure."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 9: Troubleshooting
      // ══════════════════════════════════════════════════
      h1("9. Troubleshooting"),
      blank(),

      h2("MySQL service won’t start"),
      p("Ensure the data directory was initialized with mysqld --initialize-insecure before installing the service. Check the MySQL error log:"),
      code("Get-Content 'C:\\ProgramData\\MySQL\\MySQL Server 8.4\\Data\\*.err' -Tail 30"),
      blank(),

      h2("‘java’ is not recognized"),
      p("JAVA_HOME environment variable is not set or the current session has not picked it up. Run:"),
      code("$env:JAVA_HOME = 'C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot'"),
      code("$env:PATH = \"$env:JAVA_HOME\\bin;$env:PATH\""),
      p("To make it permanent, rerun the SetEnvironmentVariable command from Section 3."),
      blank(),

      h2("Keycloak fails to start as a service"),
      p("Check the WinSW log for errors:"),
      code("Get-Content C:\\Services\\keycloak-26.6.3\\keycloak-svc.err.log -Tail 30"),
      p("Common causes:"),
      bullet("kc.bat build was not run after editing keycloak.conf"),
      bullet("JAVA_HOME is not set in keycloak-svc.xml or points to a missing JDK"),
      bullet("MySQL is not running (Keycloak depends on it for session/user storage)"),
      blank(),

      h2("STIG Manager shows ‘Missing username claim’"),
      p("The Keycloak realm is missing the preferred_username protocol mapper. This mapper is included in the stigman-realm.json file. Re-import the realm or manually add the mapper in the Keycloak admin console under the stig-manager client’s Mappers tab."),
      blank(),

      h2("Browser shows ‘Invalid scopes’ error"),
      p("The Keycloak realm is missing required client scopes. Verify that the following scopes exist and are assigned as default scopes to the stig-manager client:"),
      bullet("openid"),
      bullet("stig-manager:stig, stig-manager:stig:read, stig-manager:stig:write"),
      bullet("stig-manager:collection"),
      bullet("stig-manager:user, stig-manager:user:read"),
      bullet("stig-manager:op"),
      blank(),

      h2("Keycloak redirects to HTTPS but page doesn’t load"),
      p("Caddy must be running before Keycloak redirects work. Verify:"),
      code("Get-Service Caddy | Select-Object Name, Status"),
      code("Test-NetConnection -ComputerName localhost -Port 443"),
      p("If Caddy is running but pages don’t load, check the Caddyfile for syntax errors:"),
      code("C:\\Services\\caddy\\caddy.exe validate --config C:\\Services\\caddy\\Caddyfile"),
      blank(),

      h2("ERR_SSL_PROTOCOL_ERROR from network clients"),
      p("The Caddyfile address must include your server’s IP or hostname. If it only says “localhost”, Caddy will not serve HTTPS for external connections. Ensure your Caddyfile starts with:"),
      code("YOUR_SERVER_IP, localhost {"),
      blank(),

      h2("STIG Manager hangs at “Authorizing” (ServiceWorker SecurityError, code 18)"),
      p("STIG Manager's web client registers a ServiceWorker, and browsers refuse to register one when the site's certificate is not trusted. With the default self-signed certificate this blocks the app: it stays on “Authorizing” and shows a SecurityError with code 18. Clicking through the browser's certificate warning is not enough. Fix it by trusting Caddy's internal root CA, then fully closing and reopening the browser:"),
      code("powershell -NoProfile -ExecutionPolicy Bypass -File .\\install\\Trust-CaddyCert.ps1"),
      p("The script imports Caddy's root CA into the Local Machine Trusted Root store and exports a copy to C:\\Services\\caddy\\caddy-root-ca.crt for network clients (import that file into their Trusted Root store). For production, install a CA-issued certificate instead (Section 12) — domain-joined clients then trust it automatically."),
      blank(),

      h2("STIG Manager can’t connect to Keycloak"),
      p("Verify the STIGMAN_OIDC_PROVIDER environment variable in stig-manager-svc.xml points to http://localhost:8080/realms/stigman (not https). The server-to-server connection uses HTTP because Caddy is not in the path for backend communication."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 10: STIG Manager Watcher (Optional)
      // ══════════════════════════════════════════════════
      h1("10. STIG Manager Watcher (Optional)"),
      p("STIG Manager Watcher is a companion utility that monitors a directory for STIG assessment files (.ckl, .cklb, or XCCDF XML) and automatically uploads them to a STIG Manager collection. This enables automated workflows where scanning tools drop results into a folder and Watcher handles the import."),
      blank(),

      h2("Step 10.1: Prerequisites"),
      p("Two things must be in place before the Watcher can import results:"),
      bulletRuns([new TextRun({ text: "A STIG library. ", bold: true }), new TextRun("STIG Manager creates review results only for STIGs that are loaded in its library, and a fresh install has none. Import the DISA STIG Library in the STIG Manager web UI (sign in as an admin, then use the STIG Library / Application Management area to import the manual STIG .zip files). Until the matching STIGs are loaded, the Watcher still creates assets from your scans, but with no reviews attached.")]),
      bulletRuns([new TextRun({ text: "A collection. ", bold: true }), new TextRun("Create the collection the Watcher will populate in the STIG Manager UI (Collections > Create Collection). Creating it yourself means you own it and can see the imported assets. Note the collection name for the next step.")]),
      important("STIG Manager does not accept SCAP Compliance Checker (SCC) benchmark content as a STIG library; importing it returns 'SCAP Benchmarks are not imported'. The STIG definitions must come from the DISA STIG Library (manual STIG .zip files). Your scan results (.ckl, .cklb, or XCCDF results XML) are what the Watcher imports."),
      blank(),

      h2("Step 10.2: Install and Configure the Watcher"),
      p("Install-Watcher.ps1 performs every setup step that previously required the Keycloak admin console and multi-line API calls. It extracts the Watcher, assigns the watcher service-account roles in Keycloak (the realm import does not assign them), regenerates the client secret, registers the service account in STIG Manager, grants it access to your collection, writes the .env file, and registers and starts the Windows service."),
      p("From an elevated PowerShell at the repo root, run the command below — replace the collection name with the one you created in Step 10.1:"),
      code("powershell -NoProfile -ExecutionPolicy Bypass -File .\\install\\Install-Watcher.ps1 -CollectionName \"My Collection\""),
      note("Settings (server address, passwords) come from install\\stigman-config.ps1 — the same file used by the main installer, so there is nothing else to edit."),
      note("If the collection does not exist yet, either create it in the UI first (recommended, so you own it and can see the imports) or add -CreateCollection to have the script create it. A script-created collection is owned by the watcher service account only, so you would then need to grant your own account access in the UI to view it."),
      blank(),

      h2("Step 10.3: Verify the Watcher"),
      p("Confirm the service is running and check its log:"),
      code("Get-Service STIGManagerWatcher | Format-Table Name, Status, StartType"),
      code("Get-Content C:\\Services\\stigman-watcher\\stigman-watcher-svc.out.log -Tail 30"),
      p("The key success messages in the log are:"),
      bullet("preflight token request succeeded — confirms Keycloak authentication"),
      bullet("preflight api requests succeeded — confirms collection access"),
      note("Install-Watcher.ps1 regenerates the watcher client secret on each run and writes it to C:\\Services\\stigman-watcher\\.env. Treat that file as a secret."),
      note("Prefer to set the Watcher up by hand? The script is recommended because the token and grant API calls are multi-line and do not paste reliably into the stock Windows console. The manual equivalent is: in Keycloak assign the stigman-watcher service-account roles (admin, user, create_collection) and regenerate its client secret; then, authenticated as that client, call GET /api/user (registers the account) and POST /api/collections/{id}/grants?elevate=true to grant it; finally write the .env and register the service with WinSW."),
      blank(),

      h2("Step 10.4: Using the Watcher"),
      p("To import STIG assessment results, simply drop .ckl, .cklb, or XCCDF XML files into the watched directory:"),
      code("C:\\Services\\stigman-watcher\\watched\\"),
      p("The Watcher scans the directory at regular intervals (default: every 5 minutes) and uploads any new files to the configured STIG Manager collection. It automatically creates Assets and STIG Assignments as needed."),
      blank(),
      p("To view Watcher logs:"),
      code("Get-Content C:\\Services\\stigman-watcher\\stigman-watcher-svc.out.log -Tail 50"),
      blank(),

      h2("Step 10.5: Watching a Network Share (Optional)"),
      p("In production environments, you may want the Watcher to monitor a network share instead of a local directory. This allows scanning tools on other systems to drop results to a central location for automatic import."),
      blank(),

      pBold("1. Update the watched path in the .env file"),
      p("Change the WATCHER_PATH value to the UNC path of the network share:"),
      code("WATCHER_PATH=\\\\fileserver\\stigman-results"),
      note("Use UNC paths (\\\\server\\share), not mapped drive letters. Windows services run in a different session and cannot see drive mappings created by user logons."),
      blank(),

      pBold("2. Configure the service to run as a domain account"),
      p("By default, Windows services run as the Local System account, which has no access to network shares. You must change the service logon account to a domain account (or local account with network share permissions)."),
      blank(),
      p("Set the service logon account from PowerShell:"),
      code("# Set the service to run as a domain account"),
      code("sc.exe config STIGManagerWatcher obj= \"DOMAIN\\\\svc-stigman\" password= \"ServiceAccountPassword\""),
      blank(),
      p("Alternatively, configure via the Services GUI:"),
      bullet("Open services.msc and find STIG Manager Watcher"),
      bullet("Right-click > Properties > Log On tab"),
      bullet("Select This account and enter the domain account credentials"),
      bullet("Click OK and restart the service"),
      blank(),
      note("The service account must have Read access to the network share at minimum. If the Watcher needs to delete or move files after processing, the account also needs Modify access."),
      blank(),

      pBold("3. Verify connectivity"),
      p("Before restarting the service, test that the path is accessible from an elevated prompt:"),
      code("Test-Path '\\\\fileserver\\stigman-results'"),
      code("Get-ChildItem '\\\\fileserver\\stigman-results'"),
      blank(),

      pBold("4. Restart the Watcher service"),
      code("Restart-Service STIGManagerWatcher"),
      p("Check the logs to confirm the Watcher is scanning the new path:"),
      code("Get-Content C:\\Services\\stigman-watcher\\stigman-watcher-svc.out.log -Tail 20"),
      p("You should see the scan started message referencing your network share path."),
      blank(),

      important("If the network share becomes unavailable (server offline, network issue), the Watcher will log errors and retry based on the --retry-count and --retry-interval settings. The default is 5 retries at 5-second intervals before the Watcher exits. When running as a service, WinSW will restart it automatically."),
      pb(),

      // ══════════════════════════════════════════════════════════════
      //  PART II: PRODUCTION TRANSITION
      // ══════════════════════════════════════════════════════════════
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 2400, after: 400 },
        border: { top: { style: BorderStyle.SINGLE, size: 12, color: "2E75B6", space: 12 }, bottom: { style: BorderStyle.SINGLE, size: 12, color: "2E75B6", space: 12 } },
        children: [new TextRun({ text: "Part II: Production Transition", bold: true, size: 40, color: "2E75B6" })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: "The following sections cover the steps to harden and transition a working test deployment to production.", size: 22, color: "666666" })] }),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 11: Configure Server Hostname
      // ══════════════════════════════════════════════════
      h1("11. Configure Server Hostname"),
      p("Three configuration files reference the server’s externally-visible address. All three must match. The OIDC provider URL that browsers use must match the hostname in the address bar, or authentication will fail."),
      blank(),

      h2("Files to Update"),
      pBold("Caddyfile — Site address (first line of the file)"),
      p("Path: C:\\Services\\caddy\\Caddyfile"),
      code("# Change the site address to your FQDN:"),
      code("stigman.yourdomain.mil, localhost {"),
      blank(),

      pBold("keycloak.conf — The hostname setting"),
      p("Path: C:\\Services\\keycloak-26.6.3\\conf\\keycloak.conf"),
      code("hostname=https://stigman.yourdomain.mil"),
      blank(),

      pBold("stig-manager-svc.xml — The CLIENT_OIDC_PROVIDER value"),
      p("Path: C:\\Services\\stig-manager\\stig-manager-svc.xml"),
      code("<env name=\"STIGMAN_CLIENT_OIDC_PROVIDER\" value=\"https://stigman.yourdomain.mil/realms/stigman\" />"),
      blank(),

      note("STIGMAN_OIDC_PROVIDER stays as http://localhost:8080/realms/stigman. This is server-to-server communication between STIG Manager and Keycloak on the same host and never leaves the machine."),
      blank(),

      h2("Automated Method"),
      p("Run the included script from an elevated command prompt:"),
      code("configure-hostname.cmd stigman.yourdomain.mil"),
      p("The script updates all three files, rebuilds Keycloak (required when hostname changes), and restarts all services."),
      blank(),

      h2("After Changing the Hostname"),
      p("Keycloak must be rebuilt any time keycloak.conf changes. The configure-hostname.cmd script does this automatically. If you change the hostname manually, run:"),
      code("cd C:\\Services\\keycloak-26.6.3"),
      code(".\\bin\\kc.bat build"),
      p("Then restart Keycloak, STIG Manager, and reload Caddy."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 12: Install TLS Certificates
      // ══════════════════════════════════════════════════
      h1("12. Install TLS Certificates"),
      p("The test deployment uses Caddy’s built-in CA to generate self-signed certificates. Browsers show a security warning and block ServiceWorkers. For production, replace these with certificates issued by your organization’s CA (e.g., Active Directory Certificate Services)."),
      blank(),

      h2("Certificate Requirements"),
      bullet("PEM-encoded certificate file and private key file"),
      bullet("Subject or SAN must include the server’s FQDN"),
      bullet("Key usage: Digital Signature, Key Encipherment"),
      bullet("Extended key usage: Server Authentication (1.3.6.1.5.5.7.3.1)"),
      bullet("If your CA provides a separate intermediate/chain cert, concatenate it to the end of cert.pem"),
      blank(),

      h2("Converting PFX to PEM"),
      p("If your CA provides a .pfx (PKCS#12) file instead of PEM, convert it with OpenSSL:"),
      code("# Extract the certificate:"),
      code("openssl pkcs12 -in cert.pfx -out cert.pem -clcerts -nokeys"),
      code("# Extract the private key:"),
      code("openssl pkcs12 -in cert.pfx -out key.pem -nocerts -nodes"),
      blank(),

      h2("Automated Installation"),
      p("Run the included script from an elevated command prompt:"),
      code("configure-tls.cmd C:\\certs\\stigman.pem C:\\certs\\stigman-key.pem"),
      p("The script copies the cert files to C:\\Services\\caddy\\certs\\, updates the Caddyfile, restricts permissions on the private key, and restarts Caddy."),
      blank(),

      h2("Manual Installation"),
      p("Edit the Caddyfile and replace the tls directive:"),
      code("# Before (self-signed):"),
      code("    tls internal"),
      blank(),
      code("# After (CA-issued):"),
      code("    tls C:\\Services\\caddy\\certs\\cert.pem C:\\Services\\caddy\\certs\\key.pem"),
      blank(),
      p("Then restart the Caddy service. No changes to Keycloak or STIG Manager are needed — only Caddy terminates TLS."),
      note("If the certificate was issued by your internal CA (AD CS), domain-joined clients will trust it automatically. No client-side configuration is needed."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 13: Active Directory / LDAP Integration
      // ══════════════════════════════════════════════════
      h1("13. Active Directory / LDAP Integration"),
      p("The test deployment uses local Keycloak user accounts. For production, configure Keycloak to authenticate users against Active Directory via LDAP federation. Users will log in with their AD credentials."),
      blank(),

      h2("Prerequisites"),
      bullet("An AD service account with read access to user objects (for LDAP bind)"),
      bullet("The AD domain controller hostname (e.g., dc01.yourdomain.mil)"),
      bullet("The base DN for user searches (e.g., OU=Users,DC=yourdomain,DC=mil)"),
      bullet("LDAPS (port 636) is strongly recommended; LDAP (port 389) sends credentials in cleartext"),
      blank(),

      h2("Step 13.1: Add LDAP User Federation"),
      numItem8("Open the Keycloak admin console at https://stigman.yourdomain.mil/admin/"),
      numItem8("Select the “stigman” realm from the dropdown (top-left corner)."),
      numItem8("Navigate to User federation in the left sidebar."),
      numItem8("Click “Add LDAP providers.”"),
      numItem8("Configure with the following settings:"),
      blank(),

      pBold("General Settings:"),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [tc("Setting",{hdr:true,w:3000}), tc("Value",{hdr:true,w:6360})] }),
          new TableRow({ children: [tc("Vendor",{w:3000}), tc("Active Directory",{w:6360})] }),
          new TableRow({ children: [tc("Edit Mode",{w:3000}), tc("READ_ONLY",{w:6360,mono:true})] }),
        ],
      }),
      blank(),

      pBold("Connection Settings:"),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [tc("Setting",{hdr:true,w:3000}), tc("Value",{hdr:true,w:6360})] }),
          new TableRow({ children: [tc("Connection URL",{w:3000}), tc("ldaps://dc01.yourdomain.mil:636",{w:6360,mono:true})] }),
          new TableRow({ children: [tc("Bind DN",{w:3000}), tc("CN=svc-stigman,OU=Service Accounts,DC=yourdomain,DC=mil",{w:6360,mono:true})] }),
          new TableRow({ children: [tc("Bind Credential",{w:3000}), tc("(service account password)",{w:6360})] }),
        ],
      }),
      blank(),

      pBold("LDAP Searching and Updating:"),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3000, 6360],
        rows: [
          new TableRow({ children: [tc("Setting",{hdr:true,w:3000}), tc("Value",{hdr:true,w:6360})] }),
          new TableRow({ children: [tc("Users DN",{w:3000}), tc("OU=Users,DC=yourdomain,DC=mil",{w:6360,mono:true})] }),
          new TableRow({ children: [tc("Username LDAP attr",{w:3000}), tc("sAMAccountName",{w:6360,mono:true})] }),
          new TableRow({ children: [tc("RDN LDAP attr",{w:3000}), tc("cn",{w:6360,mono:true})] }),
          new TableRow({ children: [tc("UUID LDAP attr",{w:3000}), tc("objectGUID",{w:6360,mono:true})] }),
          new TableRow({ children: [tc("User Object Classes",{w:3000}), tc("person, organizationalPerson, user",{w:6360,mono:true})] }),
        ],
      }),
      blank(),

      numItem8("Click “Test connection” to verify connectivity, then “Test authentication” to verify the bind credentials."),
      numItem8("Click Save."),
      blank(),

      h2("Step 13.2: Sync and Verify Users"),
      p("After saving the LDAP federation, click “Sync all users” from the Action dropdown. Keycloak imports AD user accounts into its database. Verify by navigating to Users and confirming AD accounts appear."),
      blank(),

      h2("Step 13.3: Assign STIG Manager Roles"),
      p("AD users need realm roles assigned before they can access the application:"),
      numItem9("Go to Users in the left sidebar and find the AD user."),
      numItem9("Click the Role Mappings tab."),
      numItem9("Assign the appropriate realm roles:"),
      bullet("Admin users: admin, user, create_collection"),
      bullet("Standard users: user, create_collection"),
      blank(),
      note("Once AD integration is working and verified, disable or remove the local test accounts (stigman-admin, stigman-user) from the stigman realm."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 14: Change Default Passwords
      // ══════════════════════════════════════════════════
      h1("14. Change Default Passwords"),
      p("All test passwords must be changed before production use. When changing a database password, you must update both MySQL and the corresponding configuration file, then restart the service."),
      blank(),

      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 2400, 5160],
        rows: [
          new TableRow({ children: [tc("Credential",{hdr:true,w:1800}), tc("Config File",{hdr:true,w:2400}), tc("How to Change",{hdr:true,w:5160})] }),
          new TableRow({ children: [tc("MySQL root",{w:1800}), tc("(MySQL only)",{w:2400}), tc("ALTER USER 'root'@'localhost' IDENTIFIED BY '...';",{w:5160,mono:true})] }),
          new TableRow({ children: [tc("stigman DB user",{w:1800}), tc("stig-manager-svc.xml",{w:2400}), tc("ALTER USER in MySQL + update XML, restart STIGManager",{w:5160})] }),
          new TableRow({ children: [tc("keycloak DB user",{w:1800}), tc("keycloak.conf",{w:2400}), tc("ALTER USER in MySQL + update conf, rebuild & restart Keycloak",{w:5160})] }),
          new TableRow({ children: [tc("Keycloak admin",{w:1800}), tc("Keycloak Admin Console",{w:2400}), tc("Admin Console > Users > admin > Credentials",{w:5160})] }),
        ],
      }),
      blank(),
      important("Order of operations: Change the MySQL password first (ALTER USER), then update the config file, then restart the affected service. If you update the config before MySQL, the service will fail to connect."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 15: Production Checklist
      // ══════════════════════════════════════════════════
      h1("15. Production Checklist"),
      p("Complete all items before going live:"),
      blank(),

      pBold("Network and Access"),
      checklist("Server has a DNS hostname (A record registered)"),
      checklist("Port 443 open in Windows Firewall for client access"),
      checklist("configure-hostname.cmd run with production FQDN"),
      checklist("Verified: clients can reach https://hostname/ from the network"),
      blank(),

      pBold("TLS Certificates"),
      checklist("Certificate issued by organization CA for the server FQDN"),
      checklist("configure-tls.cmd run with cert and key file paths"),
      checklist("Verified: browser shows trusted connection (no warnings)"),
      blank(),

      pBold("Authentication"),
      checklist("LDAP user federation configured in Keycloak stigman realm"),
      checklist("AD users can log in and see the STIG Manager home page"),
      checklist("STIG Manager realm roles assigned to AD users"),
      checklist("Test accounts (stigman-admin, stigman-user) disabled or removed"),
      blank(),

      pBold("Security"),
      checklist("All default passwords changed (see Section 14)"),
      checklist("MySQL root password set to a strong value"),
      checklist("MySQL only listens on localhost (verify: netstat -an | findstr 3306)"),
      checklist("Keycloak admin console password changed"),
      blank(),

      pBold("Operations"),
      checklist("All services set to Automatic start type"),
      checklist("Services survive a server reboot (test with Restart-Computer)"),
      checklist("Database backup schedule configured (mysqldump scheduled task)"),
      checklist("Log rotation verified (WinSW roll-by-size at 10 MB, 3 files kept)"),
      checklist("Certificate renewal process documented (before expiry date)"),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 16: Applying Updates
      // ══════════════════════════════════════════════════
      h1("16. Applying Updates"),
      p("STIG Manager releases new versions periodically. Because the STIG Manager API is stateless, updating is straightforward: stop the service, replace the binary, and restart. The existing service configuration, database, and Keycloak realm are all preserved. Only the stig-manager-win.exe binary changes."),
      blank(),
      p("Most updates require no database changes. Some releases include a database migration — when they do, the release notes say so explicitly. STIG Manager tracks the database schema version and applies any required migration automatically the first time the new version starts. No manual SQL is required."),
      important("Always back up the stigman database before applying a release that includes a database migration. Once a migration runs, the schema is upgraded and the previous version of the binary may no longer be compatible. The backup is your rollback path."),
      blank(),

      h2("Step 16.1: Review the Release Notes"),
      p("Before downloading, read the release notes for every version between your current version and the target version. Check specifically for:"),
      bullet("Database migrations (requires a backup first)"),
      bullet("Breaking changes or configuration changes"),
      bullet("New required environment variables in stig-manager-svc.xml"),
      p("Release notes are published at: https://github.com/NUWCDIVNPT/stig-manager/releases"),
      blank(),
      p("Confirm your current running version:"),
      code("(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version"),
      blank(),

      h2("Step 16.2: Back Up the Database"),
      p("Create a timestamped backup of the stigman schema. Run from an elevated PowerShell. Adjust the mysqldump path if your MySQL version differs."),
      code("$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'"),
      code("$dump = \"C:\\Backups\\stigman-$stamp.sql\""),
      code("New-Item -ItemType Directory -Path C:\\Backups -Force | Out-Null"),
      code("& 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe' -u root -p --databases stigman --routines --triggers --single-transaction --result-file=$dump"),
      code("Write-Host \"Backup written to $dump\""),
      note("--single-transaction takes a consistent snapshot without locking tables. --routines and --triggers ensure stored programs are included. You will be prompted for the MySQL root password."),
      blank(),

      h2("Step 16.3: Download and Stage the New Binary"),
      p("Download the Windows release ZIP for the target version (replace VERSION with the version number, e.g., 1.6.12):"),
      code("$ver = '1.6.12'"),
      code("$url = \"https://github.com/NUWCDIVNPT/stig-manager/releases/download/$ver/stig-manager-win-$ver.zip\""),
      code("Invoke-WebRequest -Uri $url -OutFile \"C:\\Installers\\stig-manager-win-$ver.zip\""),
      blank(),

      h2("Step 16.4: Stop the Services"),
      p("If the Watcher is installed, it depends on the STIGManager service. You must stop the Watcher first, otherwise Stop-Service STIGManager fails with “Cannot stop service ... because it has dependent services.” Run these from an elevated PowerShell. MySQL, Keycloak, and Caddy stay running."),
      code("Stop-Service STIGManagerWatcher   # skip if the Watcher is not installed"),
      code("Stop-Service STIGManager"),
      code("Get-Service STIGManagerWatcher, STIGManager | Select-Object Name, Status"),
      note("Both should report Stopped before you replace the binary. Do not use Stop-Service STIGManager -Force as a shortcut — while it does cascade-stop the Watcher, stopping the Watcher explicitly first keeps the shutdown ordered and makes the restart symmetric."),
      blank(),

      h2("Step 16.5: Replace the Binary"),
      p("Back up the current binary, then extract the new one over it. The service config (stig-manager-svc.xml), WinSW wrapper, and logs are left untouched."),
      code("# Preserve the old binary in case rollback is needed"),
      code("Rename-Item C:\\Services\\stig-manager\\stig-manager-win.exe stig-manager-win.exe.bak"),
      blank(),
      code("# Extract the new binary to a temp folder, then copy just the exe"),
      code("Expand-Archive \"C:\\Installers\\stig-manager-win-$ver.zip\" -DestinationPath C:\\Installers\\stigman-$ver -Force"),
      code("Copy-Item \"C:\\Installers\\stigman-$ver\\stig-manager-win.exe\" C:\\Services\\stig-manager\\stig-manager-win.exe"),
      note("If the ZIP extracts into a nested folder, adjust the Copy-Item source path so it points at stig-manager-win.exe. Only the .exe needs to be replaced; the service XML and environment variables stay the same."),
      blank(),

      h2("Step 16.6: Start the Service and Watch the Migration"),
      p("Start only the STIGManager service first (the Watcher is started later, in Step 16.7, after the API is confirmed healthy). If the release includes a database migration, it runs automatically during startup. Watch the log to confirm a clean start."),
      code("Start-Service STIGManager"),
      code("Get-Content C:\\Services\\stig-manager\\stig-manager-svc.out.log -Tail 40 -Wait"),
      p("In the log, confirm these signals in order (press Ctrl+C to stop following). When a migration is included, you will see:"),
      code("\"type\":\"migration\" ... \"message\":\"MySQL schema requires N update\""),
      code("\"type\":\"migration\" ... \"status\":\"start\" ... \"name\":\"0047\""),
      code("\"type\":\"migration\" ... \"status\":\"finish\" ... \"name\":\"0047\""),
      code("\"type\":\"migration\" ... \"message\":\"All migrations performed successfully\""),
      code("\"type\":\"state-changed\" ... \"currentState\":\"available\" ... \"db\":true,\"oidc\":true"),
      p("If there is no migration in the release, you will instead see “MySQL schema is up to date” followed by the state-changed line. Either way, the final state must be available with both db and oidc true."),
      important("If the service fails to reach the available state, do not panic. Check the log for the specific error, then follow the rollback in Step 16.8. If a migration already completed, you must restore the database backup from Step 16.2 before starting the old binary — the upgraded schema is not compatible with the previous version."),
      blank(),

      h2("Step 16.7: Verify and Restart the Watcher"),
      p("Confirm the API now reports the new version:"),
      code("(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version"),
      p("Then log in through the browser at https://YOUR_SERVER_IP/ and confirm the application loads and a collection opens without errors."),
      blank(),
      p("Once the API is confirmed healthy, restart the Watcher (if installed) and confirm it reconnects:"),
      code("Start-Service STIGManagerWatcher"),
      code("Get-Content C:\\Services\\stigman-watcher\\stigman-watcher-svc.out.log -Tail 10"),
      p("Look for “preflight api requests succeeded” in the Watcher log, which confirms it re-authenticated against the upgraded API. Finally, verify the full service set:"),
      code("Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status"),
      p("Once everything is verified, you can delete the .bak binary and the temporary extraction folder."),
      blank(),

      h2("Step 16.8: Rollback (If Needed)"),
      p("If the new version must be reverted:"),
      numItem10("Stop the services (Watcher first): Stop-Service STIGManagerWatcher; Stop-Service STIGManager"),
      numItem10("Restore the previous binary: remove the new exe and rename stig-manager-win.exe.bak back to stig-manager-win.exe"),
      numItem10("If a database migration had run, restore the backup from Step 16.2 (the upgraded schema is not compatible with the older binary)"),
      numItem10("Start STIGManager and verify the version, then start STIGManagerWatcher"),
      important("Rollback after a migration always requires restoring the database backup. This is why the Step 16.2 backup is mandatory for any release with a migration."),
      blank(),

      h2("Step 16.9: Updating Keycloak"),
      p("Keycloak updates differently from STIG Manager. STIG Manager is a single binary you swap in place; Keycloak is a full distribution installed into a version-named folder (C:\\Services\\keycloak-<version>). The supported approach is to install the new version into a new folder, migrate your configuration into it, rebuild, and re-point the Windows service. Keeping the old folder gives you an instant rollback path."),
      important("Use this same install-fresh-and-re-point pattern for any component that lives in a version-named folder. Patch releases within the same minor series (for example 26.6.2 to 26.6.3) carry no realm export/import work — Keycloak migrates its own internal schema automatically on first start."),
      blank(),

      pBold("1. Review the release notes and back up"),
      p("Security releases should be applied promptly. Back up the Keycloak config file and the keycloak database schema before starting:"),
      code("$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'"),
      code("Copy-Item C:\\Services\\keycloak-<oldver>\\conf\\keycloak.conf \"C:\\Backups\\keycloak.conf.$stamp.bak\""),
      code("$env:MYSQL_PWD = '<mysql-root-password>'"),
      code("& 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe' -u root --databases keycloak --routines --triggers --single-transaction --result-file=\"C:\\Backups\\keycloak-db-$stamp.sql\""),
      code("$env:MYSQL_PWD = $null"),
      blank(),

      pBold("2. Download and extract the new version"),
      code("$ver = '26.6.3'"),
      code("Invoke-WebRequest -Uri \"https://github.com/keycloak/keycloak/releases/download/$ver/keycloak-$ver.zip\" -OutFile \"C:\\Installers\\keycloak-$ver.zip\""),
      code("Expand-Archive \"C:\\Installers\\keycloak-$ver.zip\" -DestinationPath C:\\Services"),
      p("This creates C:\\Services\\keycloak-<newver>\\."),
      blank(),

      pBold("3. Migrate configuration into the new folder"),
      p("Copy the config file and the WinSW service wrapper from the old folder. The service XML uses %BASE%, so it works unchanged in the new location. If you added any custom providers or themes, copy those subfolders too."),
      code("$old = 'C:\\Services\\keycloak-<oldver>'; $new = 'C:\\Services\\keycloak-<newver>'"),
      code("Copy-Item \"$old\\conf\\keycloak.conf\"  \"$new\\conf\\keycloak.conf\"  -Force"),
      code("Copy-Item \"$old\\keycloak-svc.exe\"     \"$new\\keycloak-svc.exe\"     -Force"),
      code("Copy-Item \"$old\\keycloak-svc.xml\"     \"$new\\keycloak-svc.xml\"     -Force"),
      blank(),

      pBold("4. Build for optimized start"),
      code("$env:JAVA_HOME = 'C:\\Program Files\\Microsoft\\jdk-17.0.19.10-hotspot'"),
      code("cd C:\\Services\\keycloak-<newver>"),
      code(".\\bin\\kc.bat build"),
      note("kc.bat build bakes the configuration (db vendor, hostname, features) into an optimized image so the service can start with --optimized. It is required after extracting a new distribution. The “run time options ... ignored during build time” message is normal — those settings apply at start, not build."),
      blank(),

      pBold("5. Cut over the service"),
      p("Stop the dependents and Keycloak, then move the service registration from the old folder to the new one. Run from an elevated PowerShell."),
      code("Stop-Service STIGManagerWatcher; Stop-Service STIGManager; Stop-Service Keycloak"),
      code("cd C:\\Services\\keycloak-<oldver>; .\\keycloak-svc.exe uninstall"),
      code("cd C:\\Services\\keycloak-<newver>; .\\keycloak-svc.exe install"),
      note("The service name (Keycloak) does not change, so the Keycloak dependencies declared by STIGManager and the Watcher continue to resolve correctly."),
      blank(),

      pBold("6. Start in order and verify"),
      code("Start-Service Keycloak    # wait ~30s for it to finish starting"),
      code("Start-Service STIGManager"),
      code("Start-Service STIGManagerWatcher"),
      p("Confirm a clean start in the Keycloak log — on a version bump you will see lines such as “migrated realm stigman to <newver>” and “Keycloak <newver> ... started”:"),
      code("Get-Content C:\\Services\\keycloak-<newver>\\keycloak-svc.out.log -Tail 15"),
      p("Then verify the identity path end-to-end: the realm OIDC metadata is served, and STIG Manager login works."),
      code("(Invoke-RestMethod 'http://localhost:8080/realms/stigman/.well-known/openid-configuration').issuer"),
      code("Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status"),
      p("Log in through https://YOUR_SERVER_IP/ to confirm authentication still works. Once verified, the old keycloak-<oldver> folder can be archived or deleted; until then it is your rollback (re-register the service from the old folder and restart)."),
      pb(),

      // ══════════════════════════════════════════════════
      // Section 17: Customize the Home Page
      // ══════════════════════════════════════════════════
      h1("17. Customize the Home Page (Optional)"),
      p("STIG Manager's Home tab shows a Welcome widget you can brand with your organization's logo, a title, a message, and a link. These come from STIGMAN_CLIENT_* environment variables that the service reads from stig-manager-svc.xml. Because the config is loaded by the Windows service, edit it with the Set-HomePage.ps1 script, which updates the service config and restarts STIG Manager for you — no hand-editing XML or restarting services manually."),
      blank(),
      h2("What you can set"),
      bullet("Title — the Welcome widget heading (STIGMAN_CLIENT_WELCOME_TITLE)"),
      bullet("Message — body text, for example a usage policy or point-of-contact information (STIGMAN_CLIENT_WELCOME_MESSAGE)"),
      bullet("Link — an optional hyperlink shown after the message (STIGMAN_CLIENT_WELCOME_LINK)"),
      bullet("Logo — an image shown in the widget, scaled to a maximum of 125 pixels (STIGMAN_CLIENT_WELCOME_IMAGE)"),
      bullet("Classification banner — one of NONE, U, CUI, C, S, TS, or SCI (STIGMAN_CLASSIFICATION)"),
      note("The logo is referenced by URL — STIG Manager does not store the image itself. Set-HomePage.ps1 self-hosts it through Caddy (the Caddyfile includes a /branding route), so you do not need a separate web server."),
      blank(),
      h2("Run the script"),
      p("From an elevated PowerShell at the repo root, pass the values you want. This is a single line — do not break it:"),
      code(".\\install\\Set-HomePage.ps1 -Title \"ACME Cyber Operations\" -Message \"Authorized use only. SOC: soc@acme.example, x1234.\" -Link \"https://intranet.acme.example/cyber\" -LogoFile \"C:\\branding\\acme-logo.png\""),
      p("The script copies your logo into C:\\Services\\caddy\\branding, points the Welcome image at https://YOUR_SERVER_IP/branding/<file>, writes the other values into stig-manager-svc.xml, and restarts the service. When it finishes, hard-refresh the Home tab in the browser (Ctrl+F5) to see the changes."),
      blank(),
      note("Provide only the parameters you want to change; omit the rest. Pass an empty value (for example -Title \"\") to clear a setting back to its default. To use an image you already host, use -LogoUrl \"https://...\" instead of -LogoFile. To change the logo later, re-run with a new -LogoFile, or just replace C:\\Services\\caddy\\branding\\logo.<ext>."),
      important("The logo URL must be reachable from each user's browser. The default https://YOUR_SERVER_IP/branding/... works once the certificate is trusted (Step 8.3). If you would rather not host the image at all, set STIGMAN_CLIENT_WELCOME_IMAGE to a data URI (data:image/png;base64,...) in stig-manager-svc.xml instead."),
      pb(),

      // ══════════════════════════════════════════════════
      // Appendix C: Architecture
      // ══════════════════════════════════════════════════
      h1("Appendix A: Architecture"),
      p("All components run on a single Windows Server. Caddy is the only externally-facing service — it terminates TLS and routes requests to the backend services. All inter-service communication uses HTTP on localhost."),
      blank(),

      pBold("Request Flow:"),
      code("  Client Browser"),
      code("       |"),
      code("  HTTPS :443 (only external port)"),
      code("       |"),
      code("  [ Caddy - Reverse Proxy ]"),
      code("       |                  |"),
      code("  /api, /            /realms, /resources"),
      code("       |                  |"),
      code("  [ STIG Manager ]   [ Keycloak ]"),
      code("  HTTP :54000        HTTP :8080"),
      code("       |                  |"),
      code("       +--- [ MySQL ] ----+"),
      code("            :3306"),
      blank(),

      pBold("Service Ports:"),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1200, 2400, 2400, 3360],
        rows: [
          new TableRow({ children: [tc("Port",{hdr:true,w:1200}), tc("Service",{hdr:true,w:2400}), tc("Listens On",{hdr:true,w:2400}), tc("Purpose",{hdr:true,w:3360})] }),
          new TableRow({ children: [tc("443",{w:1200,mono:true}), tc("Caddy",{w:2400}), tc("All interfaces",{w:2400}), tc("HTTPS (external)",{w:3360})] }),
          new TableRow({ children: [tc("2019",{w:1200,mono:true}), tc("Caddy Admin API",{w:2400}), tc("localhost only",{w:2400}), tc("Config reload",{w:3360})] }),
          new TableRow({ children: [tc("8080",{w:1200,mono:true}), tc("Keycloak",{w:2400}), tc("localhost only",{w:2400}), tc("OIDC / Auth",{w:3360})] }),
          new TableRow({ children: [tc("54000",{w:1200,mono:true}), tc("STIG Manager",{w:2400}), tc("All interfaces*",{w:2400}), tc("API / Web UI",{w:3360})] }),
          new TableRow({ children: [tc("3306",{w:1200,mono:true}), tc("MySQL",{w:2400}), tc("localhost only",{w:2400}), tc("Database",{w:3360})] }),
        ],
      }),
      blank(),
      note("*STIG Manager listens on 0.0.0.0:54000 but should only be accessed through Caddy. Consider adding a Windows Firewall rule to block direct access to port 54000 from external hosts."),
      pb(),

      // ══════════════════════════════════════════════════
      // Appendix A: Credentials
      // ══════════════════════════════════════════════════
      h1("Appendix B: Credentials Reference"),
      p("This table shows all accounts and the default test passwords used in this guide. Record any password changes you make during installation."),
      blank(),
      new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [2200, 2200, 2560, 2400],
        rows: [
          new TableRow({ children: [tc("Service",{hdr:true,w:2200}), tc("Account",{hdr:true,w:2200}), tc("Default Test Password",{hdr:true,w:2560}), tc("Configured In",{hdr:true,w:2400})] }),
          new TableRow({ children: [tc("MySQL Root",{w:2200}), tc("root@localhost",{w:2200}), tc("STIGman_Root_2026!",{w:2560,mono:true}), tc("MySQL only",{w:2400})] }),
          new TableRow({ children: [tc("MySQL (STIG Mgr)",{w:2200}), tc("stigman@localhost",{w:2200}), tc("STIGman_DB_2026!",{w:2560,mono:true}), tc("stig-manager-svc.xml",{w:2400})] }),
          new TableRow({ children: [tc("MySQL (Keycloak)",{w:2200}), tc("keycloak@localhost",{w:2200}), tc("Keycloak_DB_2026!",{w:2560,mono:true}), tc("keycloak.conf",{w:2400})] }),
          new TableRow({ children: [tc("Keycloak Admin",{w:2200}), tc("admin",{w:2200}), tc("Admin_KC_2026!",{w:2560,mono:true}), tc("bootstrap-admin CLI",{w:2400})] }),
          new TableRow({ children: [tc("STIG Mgr Admin",{w:2200}), tc("stigman-admin",{w:2200}), tc("STIGman_Admin_2026!",{w:2560,mono:true}), tc("stigman-realm.json",{w:2400})] }),
          new TableRow({ children: [tc("STIG Mgr User",{w:2200}), tc("stigman-user",{w:2200}), tc("STIGman_User_2026!",{w:2560,mono:true}), tc("stigman-realm.json",{w:2400})] }),
          new TableRow({ children: [tc("Watcher Client",{w:2200}), tc("stigman-watcher",{w:2200}), tc("(generated secret)",{w:2560,mono:true}), tc("Keycloak + .env",{w:2400})] }),
        ],
      }),
      blank(),
      important("Change ALL passwords before deploying to production. See Section 14 for the step-by-step password change procedure."),
      pb(),

      // ══════════════════════════════════════════════════
      // Appendix B: Service Commands
      // ══════════════════════════════════════════════════
      h1("Appendix C: Service Management Commands"),
      p("Common commands for managing the STIG Manager services. All commands require an elevated (Administrator) PowerShell."),
      blank(),

      pBold("Check service status:"),
      code("Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status, StartType"),
      blank(),

      pBold("Start all services (dependency order):"),
      code("Start-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher"),
      blank(),

      pBold("Stop all services (reverse dependency order):"),
      code("Stop-Service STIGManagerWatcher, Caddy, STIGManager"),
      code("Stop-Service Keycloak"),
      code("Stop-Service MySQL84"),
      note("STIGManagerWatcher and STIGManager depend on Keycloak, so they must be stopped first. Attempting to stop Keycloak while dependent services are running will fail unless you use the -Force flag, which forcibly terminates dependent services."),
      blank(),

      pBold("Restart a single service:"),
      code("Restart-Service STIGManager"),
      blank(),

      pBold("View STIG Manager logs:"),
      code("Get-Content C:\\Services\\stig-manager\\stig-manager-svc.out.log -Tail 50"),
      blank(),

      pBold("View Keycloak logs:"),
      code("Get-Content C:\\Services\\keycloak-26.6.3\\keycloak-svc.out.log -Tail 50"),
      blank(),

      pBold("View Caddy logs (if Caddy fails to start):"),
      code("C:\\Services\\caddy\\caddy.exe run --config C:\\Services\\caddy\\Caddyfile"),
      note("Running Caddy interactively shows errors directly in the console. Press Ctrl+C to stop, then fix the Caddyfile and restart the service."),
      blank(),

      pBold("Reload Caddy config without restarting:"),
      code("$body = Get-Content C:\\Services\\caddy\\Caddyfile -Raw"),
      code("Invoke-WebRequest -Uri 'http://localhost:2019/load' -Method POST -Body $body -ContentType 'text/caddyfile' -UseBasicParsing"),
      blank(),

      pBold("View Watcher logs:"),
      code("Get-Content C:\\Services\\stigman-watcher\\stigman-watcher-svc.out.log -Tail 50"),
      blank(),

      pBold("Verify STIG Manager version:"),
      code("(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version"),
    ]),
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = require("path").join(__dirname, "deliverables", "STIG-Manager-Deployment-Guide.docx");
  fs.writeFileSync(outPath, buffer);
  console.log("Created: " + outPath + " (" + Math.round(buffer.length / 1024) + " KB)");
});
