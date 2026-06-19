# STIG Manager OSS — Windows Server Deployment

A turnkey deployment package for [STIG Manager OSS](https://github.com/NUWCDIVNPT/stig-manager) on Windows Server 2022. This project provides a step-by-step guide, pre-built service configurations, and automation scripts that reduce the installation from hours of troubleshooting into a repeatable, documented process.

## Why This Exists

STIG Manager is a powerful open-source tool for managing DISA STIG assessments, but its documentation targets Linux/Docker environments. Getting it running on Windows Server — with Keycloak, MySQL, reverse proxy, and proper service registration — requires stitching together multiple guides and working through platform-specific issues. This project solves that by packaging everything needed for a clean Windows deployment.

## What's Included

### Deployment Guide

A comprehensive guide covering installation through production hardening, available in two formats:

- **[docs/deployment-guide.md](docs/deployment-guide.md)** — read it right here on GitHub
- **`deliverables/STIG-Manager-Deployment-Guide.docx`** — printable Word version

Contents:

**Part I — Installation (Sections 1–10)**
- MySQL 8.4, OpenJDK 17, Keycloak 26.6, STIG Manager 1.6.12, Caddy reverse proxy
- All five components registered as Windows services (auto-start, dependency-ordered)
- STIG Manager Watcher for automated assessment file import (local or network share)
- Verification steps, troubleshooting, and service management commands

**Part II — Production Transition (Sections 11–15)**
- DNS hostname configuration with automated helper script
- TLS certificate installation (replace self-signed with CA-issued)
- Active Directory / LDAP integration via Keycloak federation
- Password rotation procedures
- Go-live checklist

**Maintenance (Section 16)**
- Applying version updates: database backup, binary swap, automatic schema migration, verification, and rollback

### Automated Installer (recommended)

The stock Windows Server console (Windows PowerShell 5.1 / PSReadLine 2.0 in conhost) cannot reliably paste multi-line commands, so copy-pasting blocks from any guide — Word *or* Markdown — fails unpredictably. The `install/` folder sidesteps this entirely: edit one config file, then run scripts that perform the install with no pasting.

| Script | Purpose |
|--------|---------|
| `install/stigman-config.ps1` | Your settings (server address, passwords, versions) — edit this first |
| `install/Install-All.ps1` | Runs the whole Part I install (Sections 2–7) in order; safe to re-run |
| `install/Initialize-MySql.ps1` | Installs/initializes MySQL and the MySQL84 service |
| `install/Create-Databases.ps1` | Creates the `stigman` and `keycloak` databases and users |
| `install/Install-Java.ps1` | Installs OpenJDK 17 and sets `JAVA_HOME` |
| `install/Install-Keycloak.ps1` | Extracts Keycloak, writes `keycloak.conf`, bootstraps admin, builds |
| `install/Install-StigManager.ps1` | Extracts STIG Manager, writes the service config |
| `install/Install-Caddy.ps1` | Installs Caddy (.exe or .zip) and writes the Caddyfile |
| `install/Register-Services.ps1` | Registers and starts all services (auto-detects the Keycloak version) |
| `install/Import-Realm.ps1` | Waits for Keycloak and imports the STIG Manager realm |
| `install/Install-Watcher.ps1` | Installs and configures the optional Watcher (roles, secret, collection grant, service) — no console steps |
| `install/Trust-CaddyCert.ps1` | Trusts Caddy's self-signed root CA so the browser loads the app (fixes the "Authorizing" ServiceWorker error) |

### Maintenance Scripts

| Script | Purpose |
|--------|---------|
| `deliverables/register-services.cmd` | Registers all services, sets dependencies, starts the stack |
| `deliverables/Configure-Hostname.ps1` | Updates hostname across all config files, rebuilds Keycloak (version-agnostic) |
| `deliverables/configure-tls.cmd` | Installs CA-issued certificates into Caddy |
| `cleanup-all.ps1` | Tears down all components for a clean reinstall |

### Service Configurations (`deliverables/service-configs/`)

Ready-to-use config files for each component:

- **Caddyfile** — Reverse proxy with TLS termination
- **keycloak.conf** — Keycloak production settings
- **keycloak-svc.xml** — WinSW service wrapper for Keycloak
- **stig-manager-svc.xml** — WinSW service wrapper with environment variables
- **stigman-watcher-svc.xml** — WinSW service wrapper with boot resilience

### Keycloak Realm (`deliverables/stigman-realm.json`)

Pre-configured realm import with:
- Required OIDC client scopes for STIG Manager
- `stig-manager` public client with protocol mappers
- `stigman-watcher` confidential client for automated imports
- Test user accounts with appropriate role assignments

### Document Build Scripts

The Word documents in `deliverables/` are generated from source using the [docx](https://www.npmjs.com/package/docx) Node.js library, so the guides can be versioned and diffed like code:

- `build-install-guide.js` — generates the Deployment Guide (.docx)
- `build-markdown-guide.js` — generates [docs/deployment-guide.md](docs/deployment-guide.md) from the same source
- `build-update-doc.js` — generates the production update procedure document

To rebuild: `npm install docx` then `node build-install-guide.js && node build-markdown-guide.js`.

## Security Notes

The configs and realm import use **sample credentials** (e.g., `STIGman_DB_2026!`, watcher client secret `changeme`) so the guide is reproducible end-to-end. Before production use:

- Change all database, Keycloak admin, and test account passwords (Part II, Section 14 covers rotation)
- Replace the `stigman-watcher` client secret in Keycloak
- Restrict the `stig-manager` client's redirect URIs and web origins (the realm import ships with `*` for initial setup)
- Replace the self-signed certificate with a CA-issued one (Section 12)

## Architecture

All components run on a single Windows Server. Caddy is the only externally-facing service.

```
  Client Browser
       |
  HTTPS :443
       |
  [ Caddy ]
       |                  |
  /api, /            /realms, /resources
       |                  |
  [ STIG Manager ]   [ Keycloak ]
  :54000             :8080
       |                  |
       +--- [ MySQL ] ----+
            :3306

  [ Watcher ] ---> scans directory ---> uploads via API
```

## Component Versions

| Component | Version |
|-----------|---------|
| STIG Manager | 1.6.12 |
| STIG Manager Watcher | 1.6.9 |
| Keycloak | 26.6.3 |
| MySQL | 8.4.9 |
| Caddy | 2.11.4 |
| Microsoft OpenJDK | 17.0.19 |
| WinSW | 2.12.0 |

## Prerequisites

- Windows Server 2022 (or 2019)
- Administrator access
- Installer files downloaded per Section 1 of the Deployment Guide

## Getting Started

1. Download the installer files listed in [Section 1 of the Deployment Guide](docs/deployment-guide.md#1-prerequisites-and-software-downloads) and copy them to `C:\Installers`
2. Edit `install\stigman-config.ps1` with your server address and passwords
3. From an elevated PowerShell at the repo root, run:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Install-All.ps1
   ```
4. Verify per Section 8 of the guide, then proceed to Part II for production hardening

> Prefer to do it by hand? Follow the Deployment Guide from Section 2 onward — but paste **one line at a time**, since the stock Windows console cannot reliably paste multi-line blocks.

## License

[MIT](LICENSE)
