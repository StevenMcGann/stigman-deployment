# STIG Manager OSS — Windows Server Deployment

A deployment package for [STIG Manager OSS](https://github.com/NUWCDIVNPT/stig-manager) on Windows Server. It gives you a step-by-step guide, ready-made service configurations and install scripts, so an installation that used to take hours of troubleshooting becomes a repeatable, documented process.

## Why This Exists

STIG Manager is an open-source tool for managing DISA STIG assessments, but its own documentation targets Linux and Docker. Running it on Windows Server — with Keycloak, MySQL, a reverse proxy and proper Windows services — means stitching several guides together and working through Windows-specific problems. This project packages all of that into one tested procedure.

## Components

All components run on one Windows Server.

| Component | What it does |
|-----------|--------------|
| STIG Manager | The web application and its API |
| STIG Manager Watcher | Optional. Watches a folder or network share and imports assessment files automatically |
| Keycloak | Sign-in and user management (OIDC); can federate to Active Directory |
| MySQL (8.4 LTS) | Database for STIG Manager and Keycloak |
| Microsoft OpenJDK (17) | Java runtime that Keycloak needs |
| Caddy | Reverse proxy; the only service reachable from the network, and it handles HTTPS |
| WinSW | Runs Keycloak, STIG Manager and the Watcher as Windows services |

**Which versions?** The exact versions this package was tested with are in [Section 1 of the Deployment Guide](docs/deployment-guide.md#1-prerequisites-and-software-downloads), which is also the download list. The versions the install scripts use are set in `install/stigman-config.ps1`. The README doesn't list versions on purpose, so it doesn't need editing for every patch.

## What's Included

### Deployment Guide

Covers everything from a bare server to production, in two formats with the same content:

- **[docs/deployment-guide.md](docs/deployment-guide.md)** — read it here on GitHub
- **`deliverables/STIG-Manager-Deployment-Guide.docx`** — printable Word version

**Part I — Installation (Sections 1–10)**
- Downloads and server requirements (Section 1)
- MySQL, OpenJDK, Keycloak, STIG Manager and Caddy (Sections 2–6)
- All five services registered in Windows, starting automatically in the right order (Section 7)
- Verification, troubleshooting and service commands (Sections 8–9)
- STIG Manager Watcher for automatic file import, from a local folder or network share (Section 10)

**Part II — Production Transition (Sections 11–15)**
- Server hostname (DNS) setup, with a helper script
- Replacing the self-signed certificate with a CA-issued one
- Active Directory / LDAP sign-in through Keycloak
- Changing the default passwords
- Go-live checklist

**Maintenance and options (Sections 16–17, Appendices)**
- Applying version updates: database backup, replacing the files, automatic database upgrade, checks, and rollback (Section 16)
- Branding the Home page (Section 17)
- Architecture, credentials reference and service commands (Appendices A–C)

### Automated Installer (recommended)

The standard Windows Server console (Windows PowerShell 5.1) can't reliably paste multi-line commands, so pasting blocks from any guide, Word or Markdown, fails unpredictably. The `install/` folder avoids this: edit one settings file, then run scripts that do the install with no pasting.

| Script | Purpose |
|--------|---------|
| `install/stigman-config.ps1` | Your settings (server address, passwords, versions). Edit this first |
| `install/Install-All.ps1` | Runs the whole Part I install (Sections 2–7) in order; safe to re-run |
| `install/Initialize-MySql.ps1` | Installs and initializes MySQL and the MySQL84 service |
| `install/Create-Databases.ps1` | Creates the `stigman` and `keycloak` databases and users |
| `install/Install-Java.ps1` | Installs OpenJDK 17 and sets `JAVA_HOME` |
| `install/Install-Keycloak.ps1` | Extracts Keycloak, writes `keycloak.conf`, creates the admin account, builds |
| `install/Install-StigManager.ps1` | Extracts STIG Manager and writes its service settings |
| `install/Install-Caddy.ps1` | Installs Caddy (.exe or .zip) and writes the Caddyfile |
| `install/Register-Services.ps1` | Registers and starts all services (finds the Keycloak version itself) |
| `install/Import-Realm.ps1` | Waits for Keycloak and imports the STIG Manager realm |
| `install/Install-Watcher.ps1` | Optional. Installs and configures the Watcher (roles, secret, collection access, service) with no console steps |
| `install/Trust-CaddyCert.ps1` | Trusts Caddy's self-signed root certificate so the browser loads the app (fixes the "Authorizing" error) |
| `install/Set-HomePage.ps1` | Brands the Home page welcome panel (logo, title, message, link, classification) |

### Maintenance Scripts

| Script | Purpose |
|--------|---------|
| `deliverables/register-services.cmd` | Registers all services, sets their start order, starts the stack |
| `deliverables/Configure-Hostname.ps1` | Changes the hostname in every config file and rebuilds Keycloak (works with any version) |
| `deliverables/configure-tls.cmd` | Installs CA-issued certificates into Caddy |
| `cleanup-all.ps1` | Removes all components for a clean reinstall |

### Applying Updates

Each tested update comes with a dated procedure, `deliverables/STIG-Manager-Update-<date>-Production.docx`. It gives the risk assessment, the checks to run first, every command in order, how to roll back, and what was and wasn't tested in the lab.

- Use the one with the **newest date** in its file name.
- Each document states the versions it starts from. If your server is older than that, apply the earlier dated documents first, oldest to newest.
- The general steps for updating any one component are in Section 16 of the Deployment Guide.

### Service Configurations (`deliverables/service-configs/`)

Ready-to-use configuration files:

- **Caddyfile** — reverse proxy with HTTPS
- **keycloak.conf** — Keycloak production settings
- **keycloak-svc.xml** — WinSW service wrapper for Keycloak
- **stig-manager-svc.xml** — WinSW service wrapper for STIG Manager, with its environment variables
- **stigman-watcher-svc.xml** — WinSW service wrapper for the Watcher, with a delayed start and connection retries so it waits for STIG Manager at boot

### Keycloak Realm (`deliverables/stigman-realm.json`)

A ready-made realm to import, with:
- The OIDC client scopes STIG Manager needs
- The `stig-manager` public client with its protocol mappers
- The `stigman-watcher` confidential client for automatic imports
- Test user accounts with their roles

### Document Build Scripts

The Word documents in `deliverables/` are generated from scripts using the [docx](https://www.npmjs.com/package/docx) Node.js library, so changes to the guides can be reviewed like code:

- `build-install-guide.js` — the Deployment Guide (.docx). This is the source for both guides
- `build-markdown-guide.js` — builds [docs/deployment-guide.md](docs/deployment-guide.md) from the same source
- `build-update-doc.js` — the dated production update procedure

To rebuild the guides: `npm install docx`, then `node build-install-guide.js && node build-markdown-guide.js`.

**To change a guide, edit `build-install-guide.js` and rebuild.** An edit made directly to the .docx is lost the next time anyone rebuilds.

## Security Notes

The configs and realm import use **sample credentials** (for example `STIGman_DB_2026!`, and `changeme` for the Watcher's client secret) so the guide can be followed end to end. Before production use:

- Change all database, Keycloak admin and test account passwords (Section 14)
- Replace the `stigman-watcher` client secret in Keycloak
- Restrict the `stig-manager` client's redirect URIs and web origins (the realm import allows `*` for initial setup)
- Replace the self-signed certificate with a CA-issued one (Section 12)

## Architecture

All components run on one Windows Server. Caddy is the only service reachable from the network.

```
  Client Browser
       |
  HTTPS :443
       |
  [ Caddy ] ---- /branding ---> Home page logo files (served by Caddy)
       |                         |
  /api and everything else   /realms, /resources, /admin
       |                         |
  [ STIG Manager ]           [ Keycloak ]
  :54000                     :8080
       |                         |
       +------- [ MySQL ] -------+
                :3306

  [ Watcher ] ---> scans a folder or share ---> uploads through the API
```

## Prerequisites

- Windows Server 2022 or 2019
- Administrator access
- The installer files listed in Section 1 of the Deployment Guide

## Getting Started

1. Download the installer files listed in [Section 1 of the Deployment Guide](docs/deployment-guide.md#1-prerequisites-and-software-downloads) and copy them to `C:\Installers`
2. Edit `install\stigman-config.ps1` with your server address and passwords, and check that its versions match the files you downloaded
3. From an elevated PowerShell at the repo root, run:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Install-All.ps1
   ```
4. Check the installation using Section 8 of the guide, then go on to Part II to prepare for production

> Prefer to install by hand? Follow the Deployment Guide from Section 2 onward, but paste **one line at a time**, because the standard Windows console can't reliably paste multi-line blocks.

## License

[MIT](LICENSE)
