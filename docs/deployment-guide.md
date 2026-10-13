<!-- Generated from build-install-guide.js — do not edit directly. Regenerate with: node build-markdown-guide.js -->

# STIG Manager OSS — Installation & Production Transition Guide

*Step-by-Step Deployment and Hardening Instructions*  

*Version 1.6.17  —  September 2026*  

## Table of Contents

- [1. Prerequisites and Software Downloads](#1-prerequisites-and-software-downloads)
  - [Required Software](#required-software)
  - [Server Requirements](#server-requirements)
  - [Prepare the Working Directory](#prepare-the-working-directory)
  - [Directory Structure](#directory-structure)
  - [Open the Firewall](#open-the-firewall)
  - [Two Ways to Install: Scripts (Recommended) or Manual Steps](#two-ways-to-install-scripts-recommended-or-manual-steps)
- [2. Install MySQL 8.4](#2-install-mysql-84)
  - [Step 2.1: Run the MySQL Installer](#step-21-run-the-mysql-installer)
  - [Step 2.2: Initialize the Database](#step-22-initialize-the-database)
  - [Step 2.3: Create Databases and Users](#step-23-create-databases-and-users)
- [3. Install Microsoft OpenJDK 17](#3-install-microsoft-openjdk-17)
- [4. Install and Configure Keycloak](#4-install-and-configure-keycloak)
  - [Step 4.1: Extract Keycloak](#step-41-extract-keycloak)
  - [Step 4.2: Configure Keycloak](#step-42-configure-keycloak)
  - [Step 4.3: Create the Keycloak Admin Account](#step-43-create-the-keycloak-admin-account)
  - [Step 4.4: Import the STIG Manager Realm](#step-44-import-the-stig-manager-realm)
- [5. Install and Configure STIG Manager](#5-install-and-configure-stig-manager)
  - [Step 5.1: Extract STIG Manager](#step-51-extract-stig-manager)
  - [Step 5.2: Set Up WinSW Service Wrapper](#step-52-set-up-winsw-service-wrapper)
  - [Step 5.3: Create the STIG Manager Service Configuration](#step-53-create-the-stig-manager-service-configuration)
- [6. Install and Configure Caddy (Reverse Proxy)](#6-install-and-configure-caddy-reverse-proxy)
  - [Step 6.1: Set Up Caddy](#step-61-set-up-caddy)
  - [Step 6.2: Create the Caddyfile](#step-62-create-the-caddyfile)
- [7. Register Windows Services](#7-register-windows-services)
  - [Step 7.1: Build Keycloak for Production Mode](#step-71-build-keycloak-for-production-mode)
  - [Step 7.2: Create the Keycloak Service Configuration](#step-72-create-the-keycloak-service-configuration)
  - [Step 7.3: Register All Services](#step-73-register-all-services)
  - [Step 7.4: Start Services](#step-74-start-services)
  - [Step 7.5: Verify Service Dependencies](#step-75-verify-service-dependencies)
- [8. Verify the Installation](#8-verify-the-installation)
  - [Step 8.1: Check All Services Are Running](#step-81-check-all-services-are-running)
  - [Step 8.2: Verify the API](#step-82-verify-the-api)
  - [Step 8.3: Access STIG Manager](#step-83-access-stig-manager)
- [9. Troubleshooting](#9-troubleshooting)
  - [MySQL service won’t start](#mysql-service-wont-start)
  - [‘java’ is not recognized](#java-is-not-recognized)
  - [Keycloak fails to start as a service](#keycloak-fails-to-start-as-a-service)
  - [STIG Manager shows ‘Missing username claim’](#stig-manager-shows-missing-username-claim)
  - [Browser shows ‘Invalid scopes’ error](#browser-shows-invalid-scopes-error)
  - [Keycloak redirects to HTTPS but page doesn’t load](#keycloak-redirects-to-https-but-page-doesnt-load)
  - [ERR_SSL_PROTOCOL_ERROR from network clients](#err_ssl_protocol_error-from-network-clients)
  - [STIG Manager hangs at “Authorizing” (ServiceWorker SecurityError, code 18)](#stig-manager-hangs-at-authorizing-serviceworker-securityerror-code-18)
  - [STIG Manager web page never loads, but the API works](#stig-manager-web-page-never-loads-but-the-api-works)
  - [STIG Manager can’t connect to Keycloak](#stig-manager-cant-connect-to-keycloak)
- [10. STIG Manager Watcher (Optional)](#10-stig-manager-watcher-optional)
  - [Step 10.1: Prerequisites](#step-101-prerequisites)
  - [Step 10.2: Install and Configure the Watcher](#step-102-install-and-configure-the-watcher)
  - [Step 10.3: Verify the Watcher](#step-103-verify-the-watcher)
  - [Step 10.4: Using the Watcher](#step-104-using-the-watcher)
  - [Step 10.5: Watching a Network Share (Optional)](#step-105-watching-a-network-share-optional)
  - [Step 10.6: Running Multiple Watchers (Optional)](#step-106-running-multiple-watchers-optional)
- [11. Configure Server Hostname](#11-configure-server-hostname)
  - [Files to Update](#files-to-update)
  - [Automated Method](#automated-method)
  - [After Changing the Hostname](#after-changing-the-hostname)
- [12. Install TLS Certificates](#12-install-tls-certificates)
  - [Certificate Requirements](#certificate-requirements)
  - [Converting PFX to PEM](#converting-pfx-to-pem)
  - [Automated Installation](#automated-installation)
  - [Manual Installation](#manual-installation)
- [13. Active Directory / LDAP Integration](#13-active-directory-ldap-integration)
  - [Prerequisites](#prerequisites)
  - [Step 13.1: Add LDAP User Federation](#step-131-add-ldap-user-federation)
  - [Step 13.2: Sync and Verify Users](#step-132-sync-and-verify-users)
  - [Step 13.3: Assign STIG Manager Roles](#step-133-assign-stig-manager-roles)
- [14. Change Default Passwords](#14-change-default-passwords)
- [15. Production Checklist](#15-production-checklist)
- [16. Applying Updates](#16-applying-updates)
  - [Step 16.1: Review the Release Notes](#step-161-review-the-release-notes)
  - [Step 16.2: Back Up the Database](#step-162-back-up-the-database)
  - [Step 16.3: Download and Stage the New Binary](#step-163-download-and-stage-the-new-binary)
  - [Step 16.4: Stop the Services](#step-164-stop-the-services)
  - [Step 16.5: Replace the Binary](#step-165-replace-the-binary)
  - [Step 16.6: Start the Service and Watch the Migration](#step-166-start-the-service-and-watch-the-migration)
  - [Step 16.7: Verify and Restart the Watcher](#step-167-verify-and-restart-the-watcher)
  - [Step 16.8: Rollback (If Needed)](#step-168-rollback-if-needed)
  - [Step 16.9: Updating Keycloak](#step-169-updating-keycloak)
  - [Step 16.10: Updating Caddy](#step-1610-updating-caddy)
- [17. Customize the Home Page (Optional)](#17-customize-the-home-page-optional)
  - [What you can set](#what-you-can-set)
  - [Run the script](#run-the-script)
- [Appendix A: Architecture](#appendix-a-architecture)
- [Appendix B: Credentials Reference](#appendix-b-credentials-reference)
- [Appendix C: Service Management Commands](#appendix-c-service-management-commands)

## 1. Prerequisites and Software Downloads

This guide walks you through installing STIG Manager OSS on a Windows Server. STIG Manager is a web application for managing DISA STIG assessments, replacing manual .ckl file management with a centralized platform.

### Required Software

Download all of the following before starting the installation:

| Component | Version | Download | Purpose |
|----|----|----|----|
| MySQL Community Server | 8.4.11 (MSI) | dev.mysql.com/downloads/mysql | Database backend (STIG Manager 1.6.17 and later needs 8.4.0 or later) |
| Microsoft OpenJDK | 17.0.20.1 (MSI) | learn.microsoft.com/java/openjdk | Java runtime for Keycloak |
| Keycloak | 26.8.1 (ZIP) | keycloak.org/downloads | Identity/auth provider (OIDC) |
| STIG Manager | 1.6.17 (ZIP) | github.com/NUWCDIVNPT/stig-manager | The application |
| STIG Manager Watcher | 1.6.9 (ZIP) | github.com/NUWCDIVNPT/stigman-watcher | Automated file import (optional, Section 10) |
| Caddy Server | 2.11.7 (ZIP) | github.com/caddyserver/caddy/releases | Reverse proxy with auto-TLS |
| WinSW | 2.12.0 (EXE) | github.com/winsw/winsw/releases | Windows service wrapper |

> **Note:** The versions listed are the baseline this guide was written and validated against. Newer patch releases generally work, but follow Section 16 (Applying Updates) when moving to a newer version.

> **Note:** For STIG Manager and the Watcher, download the Windows standalone binary (stig-manager-win-x.x.x.zip / stigman-watcher-win-x.x.x.zip) from the GitHub Releases pages. For Caddy, download the Windows amd64 binary from the GitHub Releases page for the version above (the caddyserver.com download page only serves the newest build). For WinSW, download WinSW-x64.exe.

### Server Requirements

- Windows Server 2019 or 2022
- At least 4 GB RAM (8 GB recommended)
- At least 10 GB free disk space
- Administrator access to the server
- Port 443 (HTTPS) open for web access

### Prepare the Working Directory

Copy all downloaded installer files to a single working directory on the server. This guide assumes C:\Installers:

```
New-Item -ItemType Directory -Path C:\Installers -Force
```

Copy the following files into C:\Installers:

- mysql-8.4.11-winx64.msi
- microsoft-jdk-17.0.20.1-windows-x64.msi
- keycloak-26.8.1.zip
- stig-manager-win-1.6.17.zip
- stigman-watcher-win-1.6.9.zip (optional, Section 10)
- caddy_2.11.7_windows_amd64.zip (contains caddy.exe; Step 6.1 extracts it)
- WinSW-x64.exe
- stigman-realm.json (provided with this guide)

Also copy the service configuration files from the deliverables\service-configs folder:

- Caddyfile
- keycloak.conf
- keycloak-svc.xml
- stig-manager-svc.xml
- stigman-watcher-svc.xml (optional, Section 10)

> **Note:** The service config files are pre-built and ready to use. You will only need to update the server IP/hostname and database passwords to match your environment.

### Directory Structure

Create the services directory. All services will be installed under C:\Services:

```
New-Item -ItemType Directory -Path C:\Services -Force
```

After installation, the directory structure will be:

```
C:\Services\
  keycloak-26.8.1\     Keycloak identity provider
  stig-manager\        STIG Manager application
  stigman-watcher\     STIG Manager Watcher (optional)
  caddy\               Caddy reverse proxy
```

### Open the Firewall

Open port 443 for HTTPS access from network clients:

```
New-NetFirewallRule -DisplayName 'STIG Manager HTTPS' -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

> **Note:** If your organization uses Group Policy to manage firewall rules, this may need to be done through GPO instead.

### Two Ways to Install: Scripts (Recommended) or Manual Steps

The stock Windows Server console (Windows PowerShell 5.1 with PSReadLine 2.0 in conhost) cannot reliably paste multi-line commands: a pasted block is often run one line at a time, and characters can be dropped or merged. This silently breaks multi-step commands such as the SQL in Section 2.3 — and it happens no matter whether you copy from the Word document or the Markdown guide, because the problem is the console doing the pasting, not the document.

> **Important:** Because of this, the recommended way to install is to run the provided scripts, which perform every step with no copy-pasting. Use the manual steps only if you specifically want to perform each action yourself.

**Scripted installation (recommended):**

Step 1 — Edit `install\stigman-config.ps1` and set your server address and passwords:

```
notepad install\stigman-config.ps1
```

Step 2 — From an elevated (Administrator) PowerShell, run the installer:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Install-All.ps1
```

The installer performs Sections 2 through 7 in order and is safe to re-run (each step skips work already done). When it finishes, continue at Section 8 (Verify the Installation).

> **Note:** Prefer to go step by step? Each phase also has its own script in the install\ folder (Initialize-MySql.ps1, Create-Databases.ps1, Install-Java.ps1, Install-Keycloak.ps1, Install-StigManager.ps1, Install-Caddy.ps1, Register-Services.ps1, Import-Realm.ps1). Run them in that order, each as shown in Step 2.

> **Note:** Sections 2–7 below document the same actions manually, for reference and troubleshooting. If you do follow them by hand, paste one line at a time — do not paste a whole block at once.

## 2. Install MySQL 8.4

MySQL stores all STIG Manager data (assessments, collections, STIGs) and Keycloak user/session data.

### Step 2.1: Run the MySQL Installer

Run from an elevated PowerShell:

```
Start-Process msiexec.exe -ArgumentList '/i', 'C:\Installers\mysql-8.4.11-winx64.msi', '/quiet' -Wait
```

MySQL will be installed to C:\Program Files\MySQL\MySQL Server 8.4\

### Step 2.2: Initialize the Database

MySQL needs to be initialized before first use. This creates the data directory, system tables, and registers the Windows service.

```
cd 'C:\Program Files\MySQL\MySQL Server 8.4\bin'
.\mysqld.exe --initialize-insecure --console
.\mysqld.exe --install MySQL84
Start-Service MySQL84
```

> **Note:** The --initialize-insecure flag creates a root account with no password. We will set a password in the next step. The service name MySQL84 is used throughout this guide and must match the service dependency names in the WinSW configuration files.

### Step 2.3: Create Databases and Users

Connect to MySQL and create the databases and service accounts:

```
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root
```

Paste the following SQL commands. This guide uses the test passwords shown below. See Appendix B for all default credentials.

> **Important:** Replace all passwords with strong, unique values before deploying to production.

```
ALTER USER 'root'@'localhost' IDENTIFIED BY 'STIGman_Root_2026!';
```

> **Note:** Binary logs are on by default with no expiration configured, so on a busy or crash-looping instance they can grow unbounded and fill the drive. This is a single standalone node with no replicas, so a short retention is safe. SET PERSIST writes the setting to mysqld-auto.cnf so it survives service restarts.

```
SET PERSIST binlog_expire_logs_seconds = 604800;
```

**STIG Manager database and user:**

```
CREATE DATABASE stigman CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'stigman'@'localhost' IDENTIFIED BY 'STIGman_DB_2026!';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX,
  REFERENCES, CREATE VIEW, LOCK TABLES, CREATE ROUTINE, ALTER ROUTINE,
  EXECUTE, EVENT, CREATE TEMPORARY TABLES ON stigman.* TO 'stigman'@'localhost';
GRANT SELECT ON performance_schema.* TO 'stigman'@'localhost';
```

**Keycloak database and user:**

```
CREATE DATABASE keycloak CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'keycloak'@'localhost' IDENTIFIED BY 'Keycloak_DB_2026!';
GRANT ALL PRIVILEGES ON keycloak.* TO 'keycloak'@'localhost';
```

```
FLUSH PRIVILEGES;
EXIT;
```

> **Note:** Record the passwords you chose. The stigman password is needed in Section 5 (stig-manager-svc.xml) and the keycloak password in Section 4 (keycloak.conf).

## 3. Install Microsoft OpenJDK 17

Keycloak requires Java 17 to run. Microsoft’s build of OpenJDK is recommended for Windows Server.

1. Run the OpenJDK MSI installer:

```
Start-Process msiexec.exe -ArgumentList '/i', 'C:\Installers\microsoft-jdk-17.0.20.1-windows-x64.msi', '/quiet' -Wait
```

2. Set the JAVA_HOME environment variable:

```
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot', 'Machine')
```

3. Refresh your session and verify Java is accessible:

```
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
java -version
```

You should see output showing OpenJDK 17.0.20.1.

> **Note:** The SetEnvironmentVariable command persists JAVA_HOME permanently, but the current PowerShell session needs the two $env lines to pick it up immediately. New PowerShell windows will have it automatically.

## 4. Install and Configure Keycloak

Keycloak provides OpenID Connect (OIDC) authentication for STIG Manager. Users log in through Keycloak before accessing the application.

### Step 4.1: Extract Keycloak

Extract the Keycloak ZIP to C:\Services:

```
cd C:\Installers
Expand-Archive keycloak-26.8.1.zip -DestinationPath C:\Services
```

This creates C:\Services\keycloak-26.8.1\

### Step 4.2: Configure Keycloak

You can either copy the pre-built `keycloak.conf` from the deliverables\service-configs folder, or create the file manually.

**Option A:** Copy from deliverables (recommended):

```
Copy-Item C:\Installers\keycloak.conf C:\Services\keycloak-26.8.1\conf\keycloak.conf
```

**Option B:** Create manually. Edit C:\Services\keycloak-26.8.1\conf\keycloak.conf:

```
# Database
db=mysql
db-url-host=localhost
db-url-database=keycloak
db-username=keycloak
db-password=Keycloak_DB_2026!
```

```
# Hostname (frontend URL as seen by browsers through Caddy)
hostname=https://YOUR_SERVER_IP
hostname-backchannel-dynamic=true
```

```
# HTTP settings (Caddy terminates TLS, Keycloak listens on HTTP)
http-enabled=true
http-port=8080
proxy-headers=xforwarded
```

> **Important:** Replace Keycloak_DB_2026! with the Keycloak database password from Step 2.3. Replace YOUR_SERVER_IP with your server’s IP address or DNS hostname (e.g., 192.168.1.100 or stigman.yourdomain.mil).

> **Note:** The hostname value must use https:// and match the address clients will use in their browser. This same value must also appear in the Caddyfile (Section 6) and stig-manager-svc.xml (Section 5).

### Step 4.3: Create the Keycloak Admin Account

Keycloak 26.x uses the bootstrap-admin CLI command to create the initial administrator account. This runs against the database directly and does not require Keycloak to be running.

1. Set the admin password in an environment variable:

```
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = 'Admin_KC_2026!'
```

2. Run the bootstrap-admin command:

```
cd C:\Services\keycloak-26.8.1
.\bin\kc.bat bootstrap-admin user --username admin --password:env KC_BOOTSTRAP_ADMIN_PASSWORD
```

You should see "Created temporary admin user" in the output. Keycloak will briefly start and stop as part of this process.

> **Note:** This admin account is for Keycloak administration only (realm management, user management). It is separate from the STIG Manager application users created in the next step. Replace Admin_KC_2026! with a strong password.

### Step 4.4: Import the STIG Manager Realm

The realm import creates the STIG Manager OIDC client, required scopes, protocol mappers, and test user accounts. Start Keycloak temporarily in development mode, import the realm, then stop it.

1. Start Keycloak in development mode:

```
cd C:\Services\keycloak-26.8.1
.\bin\kc.bat start-dev
```

Wait until you see "Keycloak started" in the console output (about 30–60 seconds).

2. In a separate elevated PowerShell window, get an admin token:

```
$body = @{ grant_type = 'password'; client_id = 'admin-cli'; username = 'admin'; password = 'Admin_KC_2026!' }
$token = Invoke-RestMethod -Uri 'http://localhost:8080/realms/master/protocol/openid-connect/token' -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded'
$headers = @{ Authorization = 'Bearer ' + $token.access_token; 'Content-Type' = 'application/json' }
```

3. Import the realm JSON file:

```
$realmJson = Get-Content C:\Installers\stigman-realm.json -Raw
Invoke-WebRequest -Uri 'http://localhost:8080/admin/realms' -Method Post -Headers $headers -Body $realmJson -UseBasicParsing
```

4. Verify the realm was imported:

```
Invoke-RestMethod -Uri 'http://localhost:8080/admin/realms/stigman' -Headers $headers | Select-Object realm, enabled
```

You should see the realm name "stigman" with enabled = True.

5. Stop Keycloak by pressing Ctrl+C in the console window where kc.bat is running.

> **Note:** Keycloak must be stopped before it can be built for production mode and registered as a service in Section 7.

## 5. Install and Configure STIG Manager

STIG Manager is the main application that users interact with for managing STIG assessments.

### Step 5.1: Extract STIG Manager

Create the directory and extract:

```
New-Item -ItemType Directory -Path C:\Services\stig-manager -Force
cd C:\Installers
Expand-Archive stig-manager-win-1.6.17.zip -DestinationPath C:\Services\stig-manager
```

Verify the executable was extracted:

```
Test-Path C:\Services\stig-manager\stig-manager-win.exe
```

> **Note:** If the ZIP contains a nested folder (e.g., stig-manager-win-1.6.17\), move the contents up one level so that stig-manager-win.exe is directly in C:\Services\stig-manager\.

### Step 5.2: Set Up WinSW Service Wrapper

STIG Manager and Keycloak both use WinSW to run as Windows services. Copy the WinSW executable for each:

1. Copy WinSW for STIG Manager:

```
Copy-Item C:\Installers\WinSW-x64.exe C:\Services\stig-manager\stig-manager-svc.exe
```

2. Copy WinSW for Keycloak:

```
Copy-Item C:\Installers\WinSW-x64.exe C:\Services\keycloak-26.8.1\keycloak-svc.exe
```

> **Note:** WinSW requires the .exe and .xml files to share the same base name in the same directory. For example, stig-manager-svc.exe looks for stig-manager-svc.xml.

### Step 5.3: Create the STIG Manager Service Configuration

You can either copy the pre-built `stig-manager-svc.xml` from deliverables\service-configs, or create it manually.

**Option A:** Copy from deliverables (recommended):

```
Copy-Item C:\Installers\stig-manager-svc.xml C:\Services\stig-manager\stig-manager-svc.xml
```

**Option B:** Create manually. Create C:\Services\stig-manager\stig-manager-svc.xml:

```
<service>
  <id>STIGManager</id>
  <name>STIG Manager</name>
  <description>STIG Manager OSS - DISA STIG assessment management</description>
  <executable>%BASE%\stig-manager-win.exe</executable>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>3</keepFiles>
  </log>
  <env name="STIGMAN_DB_HOST" value="localhost" />
  <env name="STIGMAN_DB_PORT" value="3306" />
  <env name="STIGMAN_DB_USER" value="stigman" />
  <env name="STIGMAN_DB_PASSWORD" value="STIGman_DB_2026!" />
  <env name="STIGMAN_DB_SCHEMA" value="stigman" />
  <env name="STIGMAN_API_ADDRESS" value="0.0.0.0" />
  <env name="STIGMAN_CLASSIFICATION" value="U" />
  <env name="STIGMAN_OIDC_PROVIDER" value="http://localhost:8080/realms/stigman" />
  <env name="STIGMAN_CLIENT_OIDC_PROVIDER" value="https://YOUR_SERVER_IP/realms/stigman" />
  <env name="TEMP" value="C:\Services\stig-manager\temp" />
  <env name="TMP" value="C:\Services\stig-manager\temp" />
  <depend>MySQL84</depend>
  <depend>Keycloak</depend>
</service>
```

> **Important:** Replace STIGman_DB_2026! with the stigman database password from Step 2.3. Replace YOUR_SERVER_IP in STIGMAN_CLIENT_OIDC_PROVIDER with the same IP or hostname used in keycloak.conf.

> **Note:** STIGMAN_OIDC_PROVIDER is the server-to-server URL (localhost). STIGMAN_CLIENT_OIDC_PROVIDER is the URL browsers use to reach Keycloak through Caddy. These must be different. The \<depend> tags ensure STIG Manager waits for MySQL and Keycloak to start first.

Create the temp folder named by TEMP and TMP (either option above needs it):

```
New-Item -ItemType Directory -Path C:\Services\stig-manager\temp -Force
```

> **Important:** Do not leave out TEMP and TMP. Each time STIG Manager starts it unpacks its web client into its temp folder, and for a service that folder is otherwise C:\Windows\Temp. Windows Disk Cleanup deletes files there that are more than 7 days old, so about a week after each restart the web page stops loading while the API keeps working. A folder under C:\Services is not cleaned. See Section 9 if this has already happened.

## 6. Install and Configure Caddy (Reverse Proxy)

Caddy serves as the front door to your deployment. It handles HTTPS/TLS encryption and routes traffic to the correct backend service (STIG Manager or Keycloak).

### Step 6.1: Set Up Caddy

Create the Caddy directory, extract the release archive, and copy the executable:

```
New-Item -ItemType Directory -Path C:\Services\caddy -Force
Expand-Archive C:\Installers\caddy_2.11.7_windows_amd64.zip -DestinationPath C:\Installers\caddy-2.11.7 -Force
Copy-Item C:\Installers\caddy-2.11.7\caddy.exe C:\Services\caddy\caddy.exe
```

> **Note:** Caddy's GitHub release is a .zip that contains caddy.exe; there is no separate .exe download there. If you staged a different version, use its file name in the two commands above. The Install-Caddy.ps1 script does the extraction for you; if more than one Caddy archive is in C:\Installers it uses the newest version.

### Step 6.2: Create the Caddyfile

Copy the pre-built Caddyfile or create `C:\Services\caddy\Caddyfile` with the following content:

```
YOUR_SERVER_IP, localhost {
    tls internal
```

```
    # HSTS: browsers must only connect over HTTPS (resolves the
    # “HSTS Missing From HTTPS Server” scanner finding). The “?” sets the
    # header only when the upstream (e.g., Keycloak) didn’t already send one.
    header ?Strict-Transport-Security "max-age=31536000; includeSubDomains"
```

```
    # Keycloak paths (OIDC, login page resources, and admin console)
    handle /realms/* {
        reverse_proxy localhost:8080
    }
    handle /resources/* {
        reverse_proxy localhost:8080
    }
    handle /admin/* {
        reverse_proxy localhost:8080
    }
```

```
    # API routes: disable caching to prevent 304 issues with ExtJS
    handle /api/* {
        header Cache-Control "no-store"
        reverse_proxy localhost:54000 {
            flush_interval -1
        }
    }
```

```
    # All other traffic (web UI and static assets)
    handle {
        reverse_proxy localhost:54000
    }
}
```

> **Important:** Replace YOUR_SERVER_IP with your server’s IP address or DNS hostname. This must match the hostname value in keycloak.conf (without the https:// prefix).

> **Note:** The “tls internal” directive generates a self-signed certificate for initial testing. For production deployments with CA-issued certificates, see Section 12 (Install TLS Certificates). Including “localhost” allows access from the server itself during setup. The Strict-Transport-Security (HSTS) header tells browsers to refuse plain-HTTP connections to this site. Two caveats: browsers only honor HSTS for hostnames (it is ignored when the site is reached by raw IP address), and once a browser has seen the header it hard-blocks certificate errors with no “proceed anyway” option — so every client must trust the serving certificate (run Trust-CaddyCert.ps1 on each client, or install a CA-issued certificate per Section 12) before you point them at the site.

> **Important:** The /admin route is required for the Keycloak admin console (used in Sections 10.2 and 13). Without it, browsing to https://YOUR_SERVER_IP/admin returns “Cannot GET /admin” because the request falls through to STIG Manager instead of Keycloak.

## 7. Register Windows Services

All commands in this section must be run in an elevated (Administrator) PowerShell.

### Step 7.1: Build Keycloak for Production Mode

Before registering Keycloak as a service, it must be built for production mode. The build step reads keycloak.conf and optimizes Keycloak’s startup configuration.

```
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
cd C:\Services\keycloak-26.8.1
.\bin\kc.bat build
```

Wait for the build to complete. You should see “Server build done.”

> **Important:** You must run kc.bat build any time you change keycloak.conf. The service uses “start --optimized” which requires a prior build.

### Step 7.2: Create the Keycloak Service Configuration

Copy `keycloak-svc.xml` from deliverables\service-configs, or create it manually at C:\Services\keycloak-26.8.1\keycloak-svc.xml:

```
<service>
  <id>Keycloak</id>
  <name>Keycloak</name>
  <description>Keycloak OIDC Identity Provider for STIG Manager</description>
  <executable>cmd.exe</executable>
  <arguments>/c "%BASE%\bin\kc.bat" start --optimized</arguments>
  <env name="JAVA_HOME" value="C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot" />
  <workingdirectory>%BASE%</workingdirectory>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>3</keepFiles>
  </log>
  <depend>MySQL84</depend>
</service>
```

> **Note:** The WinSW wrapper invokes cmd.exe /c kc.bat rather than java.exe directly. This is required because kc.bat sets essential JVM properties (-Dkc.home.dir, etc.) that Keycloak needs to function correctly.

### Step 7.3: Register All Services

Register and start each service in dependency order:

**Caddy (reverse proxy):**

```
sc.exe create Caddy binPath= '"C:\Services\caddy\caddy.exe" run --config "C:\Services\caddy\Caddyfile"' start= auto
sc.exe description Caddy 'Caddy reverse proxy for STIG Manager'
```

**Keycloak (identity provider):**

```
cd C:\Services\keycloak-26.8.1
.\keycloak-svc.exe install
```

**STIG Manager (application):**

```
cd C:\Services\stig-manager
.\stig-manager-svc.exe install
```

### Step 7.4: Start Services

Start all services in dependency order, allowing time for each to initialize:

```
Start-Service MySQL84
Start-Sleep -Seconds 5
Start-Service Keycloak
Start-Sleep -Seconds 30
Start-Service STIGManager
Start-Sleep -Seconds 10
Start-Service Caddy
```

> **Note:** Keycloak takes 30–60 seconds to fully start. If STIG Manager starts before Keycloak is ready, it will retry the OIDC connection automatically.

### Step 7.5: Verify Service Dependencies

The WinSW \<depend> tags and sc.exe registration ensure services start in the correct order:

- MySQL84 → no dependencies (starts first)
- Keycloak → depends on MySQL84
- STIGManager → depends on MySQL84 and Keycloak
- Caddy → no hard dependency (reverse proxy retries upstream connections automatically)

Verify with:

```
sc.exe qc Keycloak
sc.exe qc STIGManager
```

In the output, look for the DEPENDENCIES line. Keycloak should list MySQL84; STIGManager should list both MySQL84 and Keycloak.

## 8. Verify the Installation

### Step 8.1: Check All Services Are Running

```
Get-Service MySQL84, Keycloak, STIGManager, Caddy | Format-Table Name, Status, StartType
```

All four services should show Status: Running and StartType: Automatic.

### Step 8.2: Verify the API

Test that STIG Manager is responding by querying the API directly (bypasses Caddy TLS):

```
$api = Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition'
Write-Host "STIG Manager version: $($api.info.version)"
```

You should see: STIG Manager version: 1.6.17

Also verify Keycloak is serving the STIG Manager realm:

```
$kc = Invoke-RestMethod -Uri 'http://localhost:8080/realms/stigman/.well-known/openid-configuration'
Write-Host "Keycloak issuer: $($kc.issuer)"
```

You should see the issuer URL matching your server address (e.g., https://YOUR_SERVER_IP/realms/stigman).

Verify Caddy is listening on HTTPS:

```
Test-NetConnection -ComputerName localhost -Port 443 | Select-Object TcpTestSucceeded
```

> **Note:** These verification commands use the direct backend HTTP ports (54000 and 8080) to avoid self-signed certificate issues in PowerShell 5.1. The browser test in Step 8.3 verifies the full HTTPS path through Caddy.

### Step 8.3: Access STIG Manager

1. Trust Caddy's self-signed root CA so the browser accepts the certificate (skip if you installed a CA-issued certificate per Section 12). Without this, STIG Manager's web client cannot register its ServiceWorker and the app hangs at "Authorizing" with a SecurityError, code 18 — clicking through the browser warning is not enough. From an elevated PowerShell at the repo root, run:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Trust-CaddyCert.ps1
```

> **Note:** For network clients (browsing from another machine), copy C:\Services\caddy\caddy-root-ca.crt (exported by the script) to each client and import it into the Local Machine "Trusted Root Certification Authorities" store, or install a CA-issued certificate per Section 12.

2. Open a web browser (fully close and reopen it if it was already running) and navigate to https://YOUR_SERVER_IP/
3. You will see the Keycloak login page branded “STIG Manager”.
4. Log in with one of the test accounts from stigman-realm.json:

| Username | Password | Access Level |
|----|----|----|
| `stigman-admin` | `STIGman_Admin_2026!` | Full admin — manage collections, users, STIGs |
| `stigman-user` | `STIGman_User_2026!` | Standard user — create collections, run assessments |

5. After login, you should see the STIG Manager home page with the UNCLASSIFIED classification banner.

> **Note:** These test accounts and passwords are defined in stigman-realm.json. Change all passwords before deploying to production. See Section 14 (Change Default Passwords) for the procedure.

## 9. Troubleshooting

### MySQL service won’t start

Ensure the data directory was initialized with mysqld --initialize-insecure before installing the service. Check the MySQL error log:

```
Get-Content 'C:\Program Files\MySQL\MySQL Server 8.4\data\*.err' -Tail 30
```

### ‘java’ is not recognized

JAVA_HOME environment variable is not set or the current session has not picked it up. Run:

```
$env:JAVA_HOME = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
```

To make it permanent, rerun the SetEnvironmentVariable command from Section 3.

### Keycloak fails to start as a service

Check the WinSW log for errors:

```
Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.err.log -Tail 30
```

Common causes:

- kc.bat build was not run after editing keycloak.conf
- JAVA_HOME is not set in keycloak-svc.xml or points to a missing JDK
- MySQL is not running (Keycloak depends on it for session/user storage)

### STIG Manager shows ‘Missing username claim’

The Keycloak realm is missing the preferred_username protocol mapper. This mapper is included in the stigman-realm.json file. Re-import the realm or manually add the mapper in the Keycloak admin console under the stig-manager client’s Mappers tab.

### Browser shows ‘Invalid scopes’ error

The Keycloak realm is missing required client scopes. Verify that the following scopes exist and are assigned as default scopes to the stig-manager client:

- openid
- stig-manager:stig, stig-manager:stig:read, stig-manager:stig:write
- stig-manager:collection
- stig-manager:user, stig-manager:user:read
- stig-manager:op

### Keycloak redirects to HTTPS but page doesn’t load

Caddy must be running before Keycloak redirects work. Verify:

```
Get-Service Caddy | Select-Object Name, Status
Test-NetConnection -ComputerName localhost -Port 443
```

If Caddy is running but pages don’t load, check the Caddyfile for syntax errors:

```
C:\Services\caddy\caddy.exe validate --config C:\Services\caddy\Caddyfile
```

### ERR_SSL_PROTOCOL_ERROR from network clients

The Caddyfile address must include your server’s IP or hostname. If it only says “localhost”, Caddy will not serve HTTPS for external connections. Ensure your Caddyfile starts with:

```
YOUR_SERVER_IP, localhost {
```

### STIG Manager hangs at “Authorizing” (ServiceWorker SecurityError, code 18)

STIG Manager's web client registers a ServiceWorker, and browsers refuse to register one when the site's certificate is not trusted. With the default self-signed certificate this blocks the app: it stays on “Authorizing” and shows a SecurityError with code 18. Clicking through the browser's certificate warning is not enough. Fix it by trusting Caddy's internal root CA, then fully closing and reopening the browser:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Trust-CaddyCert.ps1
```

The script imports Caddy's root CA into the Local Machine Trusted Root store and exports a copy to C:\Services\caddy\caddy-root-ca.crt for network clients (import that file into their Trusted Root store). For production, install a CA-issued certificate instead (Section 12) — domain-joined clients then trust it automatically.

### STIG Manager web page never loads, but the API works

Symptoms: the browser waits on https://YOUR_SERVER_IP/ until it times out, all five services show Running, and https://YOUR_SERVER_IP/api/op/configuration answers normally. The STIG Manager log (C:\Services\stig-manager\stig-manager-svc.out.log) shows an ENOENT error naming a file under a pkg- folder in C:\Windows\Temp. Windows Disk Cleanup has deleted the web client that STIG Manager unpacked there when it last started, typically about a week earlier. Confirm with:

```
Select-String -Path C:\Services\stig-manager\stig-manager-svc.out.log -Pattern 'ENOENT.*pkg-' | Select-Object -Last 1
```

To fix it permanently, give the service its own temp folder, then restart it (restarting alone brings the page back for another week). Back up the config first. In an elevated PowerShell:

```
Copy-Item C:\Services\stig-manager\stig-manager-svc.xml C:\Services\stig-manager\stig-manager-svc.xml.bak
New-Item -ItemType Directory -Path C:\Services\stig-manager\temp -Force
```

Add these two lines to stig-manager-svc.xml, just above the first \<depend> line:

```
  <env name="TEMP" value="C:\Services\stig-manager\temp" />
  <env name="TMP" value="C:\Services\stig-manager\temp" />
```

Then restart STIG Manager and the Watcher:

```
Stop-Service STIGManagerWatcher
Restart-Service STIGManager
Start-Sleep -Seconds 15
Start-Service STIGManagerWatcher
```

Healthy result: the page loads, and a pkg- folder now exists under C:\Services\stig-manager\temp:

```
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/
Get-ChildItem C:\Services\stig-manager\temp
```

The first command prints 200. To undo, restore stig-manager-svc.xml.bak over stig-manager-svc.xml and restart STIG Manager the same way.

### STIG Manager can’t connect to Keycloak

Verify the STIGMAN_OIDC_PROVIDER environment variable in stig-manager-svc.xml points to http://localhost:8080/realms/stigman (not https). The server-to-server connection uses HTTP because Caddy is not in the path for backend communication.

## 10. STIG Manager Watcher (Optional)

STIG Manager Watcher is a companion utility that monitors a directory for STIG assessment files (.ckl, .cklb, or XCCDF XML) and automatically uploads them to a STIG Manager collection. This enables automated workflows where scanning tools drop results into a folder and Watcher handles the import.

How it works: the Watcher runs as a Windows service in scan mode. Every few minutes it scans its watched folder, uploads any new result files to its assigned collection (creating Assets and STIG assignments as needed), and records what it has processed in watcher-history.txt so the same file is not imported twice. Each Watcher instance authenticates to STIG Manager as the stigman-watcher service account using OIDC client credentials.

> **Note:** For the complete list of Watcher options and behaviors, see the official STIG Manager Watcher wiki: https://github.com/NUWCDIVNPT/stigman-watcher/wiki — the install\Install-Watcher.ps1 script in this package configures the common case for you.

### Step 10.1: Prerequisites

Two things must be in place before the Watcher can import results:

- **A STIG library.** STIG Manager creates review results only for STIGs that are loaded in its library, and a fresh install has none. Import the DISA STIG Library in the STIG Manager web UI (sign in as an admin, then use the STIG Library / Application Management area to import the manual STIG .zip files). Until the matching STIGs are loaded, the Watcher still creates assets from your scans, but with no reviews attached.
- **A collection.** Create the collection the Watcher will populate in the STIG Manager UI (Collections > Create Collection). Creating it yourself means you own it and can see the imported assets. Note the collection name for the next step.

> **Important:** STIG Manager does not accept SCAP Compliance Checker (SCC) benchmark content as a STIG library; importing it returns 'SCAP Benchmarks are not imported'. The STIG definitions must come from the DISA STIG Library (manual STIG .zip files). Your scan results (.ckl, .cklb, or XCCDF results XML) are what the Watcher imports.

### Step 10.2: Install and Configure the Watcher

Install-Watcher.ps1 performs every setup step that previously required the Keycloak admin console and multi-line API calls. It extracts the Watcher, assigns the watcher service-account roles in Keycloak (the realm import does not assign them), sets the client secret (reusing the existing one so multiple Watchers stay in sync), registers the service account in STIG Manager, grants it Manage on your collection, writes the .env file, and registers and starts the Windows service.

From an elevated PowerShell at the repo root, run the command below — replace the collection name with the one you created in Step 10.1:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Install-Watcher.ps1 -CollectionName "My Collection"
```

> **Important:** The Watcher needs at least Manage access on the collection to import — Full is not enough, because importing creates Assets and STIG assignments. The script grants Manage automatically and will raise an existing too-low grant. To grant Owner instead, add -RoleId 4 (1=Restricted, 2=Full, 3=Manage, 4=Owner).

> **Note:** Settings (server address, passwords) come from install\stigman-config.ps1 — the same file used by the main installer, so there is nothing else to edit.

> **Note:** If the collection does not exist yet, either create it in the UI first (recommended, so you own it and can see the imports) or add -CreateCollection to have the script create it. A script-created collection is owned by the watcher service account only, so you would then need to grant your own account access in the UI to view it.

> **Note:** Watched folder: the Watcher monitors C:\Services\stigman-watcher\watched by default. To use a different folder, add -WatchPath "D:\scans". For a network share, see Step 10.5.

> **Important:** The script signs in to Keycloak using the admin credentials in stigman-config.ps1. If you have changed the Keycloak admin password (for example during hardening), the sign-in fails with a credentials error — re-run with -AdminPassword "\<your-admin-password>" (and -AdminUser "\<name>" if it is not admin), or update the values in stigman-config.ps1.

### Step 10.3: Verify the Watcher

Confirm the service is running and check its log:

```
Get-Service STIGManagerWatcher | Format-Table Name, Status, StartType
Get-Content C:\Services\stigman-watcher\stigman-watcher-svc.out.log -Tail 30
```

The key success messages in the log are:

- preflight token request succeeded — confirms Keycloak authentication
- preflight api requests succeeded — confirms collection access

> **Note:** Install-Watcher.ps1 regenerates the watcher client secret on each run and writes it to C:\Services\stigman-watcher\.env. Treat that file as a secret.

> **Note:** When checking connectivity by hand, some normal responses can look like errors: http://localhost:8080/ returns a redirect (302), and http://localhost:54000/api returns {"error": "not found"} because nothing is mapped to the bare path. The real health checks are http://localhost:8080/realms/stigman (200) and http://localhost:54000/api/op/configuration (200).

> **Note:** Prefer to set the Watcher up by hand? The script is recommended because the token and grant API calls are multi-line and do not paste reliably into the stock Windows console. The manual equivalent is: in Keycloak assign the stigman-watcher service-account roles (admin, user, create_collection) and regenerate its client secret; then, authenticated as that client, call GET /api/user (registers the account) and POST /api/collections/{id}/grants?elevate=true to grant it; finally write the .env and register the service with WinSW.

### Step 10.4: Using the Watcher

To import STIG assessment results, simply drop .ckl, .cklb, or XCCDF XML files into the watched directory:

```
C:\Services\stigman-watcher\watched\
```

The Watcher scans the directory at regular intervals (default: every 5 minutes) and uploads any new files to the configured STIG Manager collection. It automatically creates Assets and STIG Assignments as needed.

To view Watcher logs:

```
Get-Content C:\Services\stigman-watcher\stigman-watcher-svc.out.log -Tail 50
```

### Step 10.5: Watching a Network Share (Optional)

In production environments, you may want the Watcher to monitor a network share instead of a local directory. This allows scanning tools on other systems to drop results to a central location for automatic import.

**1. Update the watched path in the .env file**

Change the WATCHER_PATH value to the UNC path of the network share:

```
WATCHER_PATH=\\fileserver\stigman-results
```

> **Note:** Use UNC paths (\\server\share), not mapped drive letters. Windows services run in a different session and cannot see drive mappings created by user logons.

**2. Configure the service to run as a domain account**

By default, Windows services run as the Local System account, which has no access to network shares. You must change the service logon account to a domain account (or local account with network share permissions).

Set the service logon account from PowerShell:

```
# Set the service to run as a domain account
sc.exe config STIGManagerWatcher obj= "DOMAIN\\svc-stigman" password= "ServiceAccountPassword"
```

Alternatively, configure via the Services GUI:

- Open services.msc and find STIG Manager Watcher
- Right-click > Properties > Log On tab
- Select This account and enter the domain account credentials
- Click OK and restart the service

> **Note:** The service account must have Read access to the network share at minimum. If the Watcher needs to delete or move files after processing, the account also needs Modify access.

**3. Verify connectivity**

Before restarting the service, test that the path is accessible from an elevated prompt:

```
Test-Path '\\fileserver\stigman-results'
Get-ChildItem '\\fileserver\stigman-results'
```

**4. Restart the Watcher service**

```
Restart-Service STIGManagerWatcher
```

Check the logs to confirm the Watcher is scanning the new path:

```
Get-Content C:\Services\stigman-watcher\stigman-watcher-svc.out.log -Tail 20
```

You should see the scan started message referencing your network share path.

> **Important:** If the network share becomes unavailable (server offline, network issue), the Watcher will log errors and retry based on the --retry-count and --retry-interval settings. The default is 5 retries at 5-second intervals before the Watcher exits. When running as a service, WinSW will restart it automatically.

### Step 10.6: Running Multiple Watchers (Optional)

You can run more than one Watcher when different folders should feed different collections — for example a separate import pipeline per system, team, or scan type. Each Watcher is its own Windows service with its own watched folder and target collection; they all share the single stigman-watcher Keycloak client.

Run Install-Watcher.ps1 once per collection, giving each a unique -InstanceName. The name is appended to the service and folder so they do not collide. Each is a single line:

```
powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Install-Watcher.ps1 -InstanceName "Web" -CollectionName "Web Servers" -WatchPath "D:\scans\web"
powershell -NoProfile -ExecutionPolicy Bypass -File .\install\Install-Watcher.ps1 -InstanceName "DB" -CollectionName "Databases" -WatchPath "D:\scans\db"
```

That creates two services — STIGManagerWatcher-Web and STIGManagerWatcher-DB — under C:\Services\stigman-watcher-Web and C:\Services\stigman-watcher-DB, each importing its own folder into its own collection. The default instance (no -InstanceName) stays the service STIGManagerWatcher in C:\Services\stigman-watcher.

> **Note:** All instances reuse the same client secret, so adding or re-running one Watcher does not invalidate the others. Each target collection must already exist (or pass -CreateCollection), and give each instance a separate watched folder so a file imports into only one collection.

> **Note:** Manage them like any service: Get-Service STIGManagerWatcher\* lists them all; Restart-Service STIGManagerWatcher-Web restarts one; logs are in each instance's folder (stigman-watcher-svc.out.log).

---

## Part II: Production Transition

*The following sections cover the steps to harden and transition a working test deployment to production.*

## 11. Configure Server Hostname

Three configuration files reference the server’s externally-visible address. All three must match. The OIDC provider URL that browsers use must match the hostname in the address bar, or authentication will fail.

### Files to Update

**Caddyfile — Site address (first line of the file)**

Path: C:\Services\caddy\Caddyfile

```
# Change the site address to your FQDN:
stigman.yourdomain.mil, localhost {
```

**keycloak.conf — The hostname setting**

Path: C:\Services\keycloak-26.8.1\conf\keycloak.conf

```
hostname=https://stigman.yourdomain.mil
```

**stig-manager-svc.xml — The CLIENT_OIDC_PROVIDER value**

Path: C:\Services\stig-manager\stig-manager-svc.xml

```
<env name="STIGMAN_CLIENT_OIDC_PROVIDER" value="https://stigman.yourdomain.mil/realms/stigman" />
```

> **Note:** STIGMAN_OIDC_PROVIDER stays as http://localhost:8080/realms/stigman. This is server-to-server communication between STIG Manager and Keycloak on the same host and never leaves the machine.

### Automated Method

Run the included script from an elevated command prompt:

```
configure-hostname.cmd stigman.yourdomain.mil
```

The script updates all three files, rebuilds Keycloak (required when hostname changes), and restarts all services.

### After Changing the Hostname

Keycloak must be rebuilt any time keycloak.conf changes. The configure-hostname.cmd script does this automatically. If you change the hostname manually, run:

```
cd C:\Services\keycloak-26.8.1
.\bin\kc.bat build
```

Then restart Keycloak, STIG Manager, and reload Caddy.

## 12. Install TLS Certificates

The test deployment uses Caddy’s built-in CA to generate self-signed certificates. Browsers show a security warning and block ServiceWorkers. For production, replace these with certificates issued by your organization’s CA (e.g., Active Directory Certificate Services).

### Certificate Requirements

- PEM-encoded certificate file and private key file
- Subject or SAN must include the server’s FQDN
- Key usage: Digital Signature, Key Encipherment
- Extended key usage: Server Authentication (1.3.6.1.5.5.7.3.1)
- If your CA provides a separate intermediate/chain cert, concatenate it to the end of cert.pem

### Converting PFX to PEM

If your CA provides a .pfx (PKCS#12) file instead of PEM, convert it with OpenSSL:

```
# Extract the certificate:
openssl pkcs12 -in cert.pfx -out cert.pem -clcerts -nokeys
# Extract the private key:
openssl pkcs12 -in cert.pfx -out key.pem -nocerts -nodes
```

### Automated Installation

Run the included script from an elevated command prompt:

```
configure-tls.cmd C:\certs\stigman.pem C:\certs\stigman-key.pem
```

The script copies the cert files to C:\Services\caddy\certs\, updates the Caddyfile, restricts permissions on the private key, and restarts Caddy.

### Manual Installation

Edit the Caddyfile and replace the tls directive:

```
# Before (self-signed):
    tls internal
```

```
# After (CA-issued):
    tls C:\Services\caddy\certs\cert.pem C:\Services\caddy\certs\key.pem
```

Then restart the Caddy service. No changes to Keycloak or STIG Manager are needed — only Caddy terminates TLS.

> **Note:** If the certificate was issued by your internal CA (AD CS), domain-joined clients will trust it automatically. No client-side configuration is needed.

## 13. Active Directory / LDAP Integration

The test deployment uses local Keycloak user accounts. For production, configure Keycloak to authenticate users against Active Directory via LDAP federation. Users will log in with their AD credentials.

### Prerequisites

- An AD service account with read access to user objects (for LDAP bind)
- The AD domain controller hostname (e.g., dc01.yourdomain.mil)
- The base DN for user searches (e.g., OU=Users,DC=yourdomain,DC=mil)
- LDAPS (port 636) is strongly recommended; LDAP (port 389) sends credentials in cleartext

### Step 13.1: Add LDAP User Federation

1. Open the Keycloak admin console at https://stigman.yourdomain.mil/admin/
2. Select the “stigman” realm from the dropdown (top-left corner).
3. Navigate to User federation in the left sidebar.
4. Click “Add LDAP providers.”
5. Configure with the following settings:

**General Settings:**

| Setting | Value |
|----|----|
| Vendor | Active Directory |
| Edit Mode | `READ_ONLY` |

**Connection Settings:**

| Setting | Value |
|----|----|
| Connection URL | `ldaps://dc01.yourdomain.mil:636` |
| Bind DN | `CN=svc-stigman,OU=Service Accounts,DC=yourdomain,DC=mil` |
| Bind Credential | (service account password) |

**LDAP Searching and Updating:**

| Setting | Value |
|----|----|
| Users DN | `OU=Users,DC=yourdomain,DC=mil` |
| Username LDAP attr | `sAMAccountName` |
| RDN LDAP attr | `cn` |
| UUID LDAP attr | `objectGUID` |
| User Object Classes | `person, organizationalPerson, user` |

6. Click “Test connection” to verify connectivity, then “Test authentication” to verify the bind credentials.
7. Click Save.

### Step 13.2: Sync and Verify Users

After saving the LDAP federation, click “Sync all users” from the Action dropdown. Keycloak imports AD user accounts into its database. Verify by navigating to Users and confirming AD accounts appear.

### Step 13.3: Assign STIG Manager Roles

AD users need realm roles assigned before they can access the application:

1. Go to Users in the left sidebar and find the AD user.
2. Click the Role Mappings tab.
3. Assign the appropriate realm roles:

- Admin users: admin, user, create_collection
- Standard users: user, create_collection

> **Note:** Once AD integration is working and verified, disable or remove the local test accounts (stigman-admin, stigman-user) from the stigman realm.

## 14. Change Default Passwords

All test passwords must be changed before production use. When changing a database password, you must update both MySQL and the corresponding configuration file, then restart the service.

| Credential | Config File | How to Change |
|----|----|----|
| MySQL root | (MySQL only) | `ALTER USER 'root'@'localhost' IDENTIFIED BY '...';` |
| stigman DB user | stig-manager-svc.xml | ALTER USER in MySQL + update XML, restart STIGManager |
| keycloak DB user | keycloak.conf | ALTER USER in MySQL + update conf, rebuild & restart Keycloak |
| Keycloak admin | Keycloak Admin Console | Admin Console > Users > admin > Credentials |

> **Important:** Order of operations: Change the MySQL password first (ALTER USER), then update the config file, then restart the affected service. If you update the config before MySQL, the service will fail to connect.

## 15. Production Checklist

Complete all items before going live:

**Network and Access**

- [ ] Server has a DNS hostname (A record registered)
- [ ] Port 443 open in Windows Firewall for client access
- [ ] configure-hostname.cmd run with production FQDN
- [ ] Verified: clients can reach https://hostname/ from the network

**TLS Certificates**

- [ ] Certificate issued by organization CA for the server FQDN
- [ ] configure-tls.cmd run with cert and key file paths
- [ ] Verified: browser shows trusted connection (no warnings)

**Authentication**

- [ ] LDAP user federation configured in Keycloak stigman realm
- [ ] AD users can log in and see the STIG Manager home page
- [ ] STIG Manager realm roles assigned to AD users
- [ ] Test accounts (stigman-admin, stigman-user) disabled or removed

**Security**

- [ ] All default passwords changed (see Section 14)
- [ ] MySQL root password set to a strong value
- [ ] MySQL only listens on localhost (verify: netstat -an | findstr 3306)
- [ ] Keycloak admin console password changed

**Operations**

- [ ] All services set to Automatic start type
- [ ] Services survive a server reboot (test with Restart-Computer)
- [ ] Database backup schedule configured (mysqldump scheduled task)
- [ ] Log rotation verified (WinSW roll-by-size at 10 MB, 3 files kept)
- [ ] Certificate renewal process documented (before expiry date)

## 16. Applying Updates

STIG Manager releases new versions periodically. Because the STIG Manager API is stateless, updating is straightforward: stop the service, replace the binary, and restart. The existing service configuration, database, and Keycloak realm are all preserved. Only the stig-manager-win.exe binary changes.

Most updates require no database changes. Some releases include a database migration — when they do, the release notes say so explicitly. STIG Manager tracks the database schema version and applies any required migration automatically the first time the new version starts. No manual SQL is required.

> **Important:** Always back up the stigman database before applying a release that includes a database migration. Once a migration runs, the schema is upgraded and the previous version of the binary may no longer be compatible. The backup is your rollback path.

### Step 16.1: Review the Release Notes

Before downloading, read the release notes for every version between your current version and the target version. Check specifically for:

- Database migrations (requires a backup first)
- Breaking changes or configuration changes
- New required environment variables in stig-manager-svc.xml
- Platform requirements, such as the minimum MySQL version. STIG Manager 1.6.17 and later requires MySQL 8.4.0 or later and will not start on an older release

Release notes are published at: https://github.com/NUWCDIVNPT/stig-manager/releases

Confirm your current running version:

```
(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version
```

If the release notes mention a platform requirement, confirm the MySQL version as well. It must be at or above the stated minimum (the lab prints 8.4.11):

```
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe' -u root -N -e "SELECT VERSION();"
$env:MYSQL_PWD = $null
```

### Step 16.2: Back Up the Database

Create a timestamped backup of the stigman schema. Run from an elevated PowerShell. Adjust the mysqldump path if your MySQL version differs.

```
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dump = "C:\Backups\stigman-$stamp.sql"
New-Item -ItemType Directory -Path C:\Backups -Force | Out-Null
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root -p --databases stigman --routines --triggers --single-transaction --result-file=$dump
Write-Host "Backup written to $dump"
```

> **Note:** --single-transaction takes a consistent snapshot without locking tables. --routines and --triggers ensure stored programs are included. You will be prompted for the MySQL root password.

### Step 16.3: Download and Stage the New Binary

Download the Windows release ZIP for the target version (replace VERSION with the version number, e.g., 1.6.17):

```
$ver = '1.6.17'
$url = "https://github.com/NUWCDIVNPT/stig-manager/releases/download/$ver/stig-manager-win-$ver.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\stig-manager-win-$ver.zip"
```

Verify the download before you use it. GitHub shows a SHA-256 digest beside each file on the release page, and the hash of your download must match it exactly (Get-FileHash prints upper case; the comparison is not case sensitive). If it does not match, delete the file and download it again.

```
(Get-FileHash "C:\Installers\stig-manager-win-$ver.zip" -Algorithm SHA256).Hash
```

### Step 16.4: Stop the Services

If the Watcher is installed, it depends on the STIGManager service. You must stop the Watcher first, otherwise Stop-Service STIGManager fails with “Cannot stop service ... because it has dependent services.” Run these from an elevated PowerShell. MySQL, Keycloak, and Caddy stay running.

```
Stop-Service STIGManagerWatcher   # skip if the Watcher is not installed
Stop-Service STIGManager
Get-Service STIGManagerWatcher, STIGManager | Select-Object Name, Status
```

> **Note:** Both should report Stopped before you replace the binary. Do not use Stop-Service STIGManager -Force as a shortcut — while it does cascade-stop the Watcher, stopping the Watcher explicitly first keeps the shutdown ordered and makes the restart symmetric.

### Step 16.5: Replace the Binary

Back up the current binary, then extract the new one over it. The service config (stig-manager-svc.xml), WinSW wrapper, and logs are left untouched.

```
# Preserve the old binary in case rollback is needed
Rename-Item C:\Services\stig-manager\stig-manager-win.exe stig-manager-win.exe.bak
```

```
# Extract the new binary to a temp folder, then copy just the exe
Expand-Archive "C:\Installers\stig-manager-win-$ver.zip" -DestinationPath C:\Installers\stigman-$ver -Force
Copy-Item "C:\Installers\stigman-$ver\stig-manager-win.exe" C:\Services\stig-manager\stig-manager-win.exe
```

> **Note:** If the ZIP extracts into a nested folder, adjust the Copy-Item source path so it points at stig-manager-win.exe. Only the .exe needs to be replaced; the service XML and environment variables stay the same.

### Step 16.6: Start the Service and Watch the Migration

Start only the STIGManager service first (the Watcher is started later, in Step 16.7, after the API is confirmed healthy). If the release includes a database migration, it runs automatically during startup. Watch the log to confirm a clean start.

```
Start-Service STIGManager
Get-Content C:\Services\stig-manager\stig-manager-svc.out.log -Tail 40 -Wait
```

In the log, confirm these signals in order (press Ctrl+C to stop following). When a migration is included, you will see:

```
"type":"migration" ... "message":"MySQL schema requires N update"
"type":"migration" ... "status":"start" ... "name":"0047"
"type":"migration" ... "status":"finish" ... "name":"0047"
"type":"migration" ... "message":"All migrations performed successfully"
"type":"state-changed" ... "currentState":"available" ... "db":true,"oidc":true
```

If there is no migration in the release, you will instead see “MySQL schema is up to date” followed by the state-changed line. Either way, the final state must be available with both db and oidc true.

> **Important:** If the service fails to reach the available state, do not panic. Check the log for the specific error, then follow the rollback in Step 16.8. If a migration already completed, you must restore the database backup from Step 16.2 before starting the old binary — the upgraded schema is not compatible with the previous version.

### Step 16.7: Verify and Restart the Watcher

Confirm the API now reports the new version:

```
(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version
```

Then log in through the browser at https://YOUR_SERVER_IP/ and confirm the application loads and a collection opens without errors.

Once the API is confirmed healthy, restart the Watcher (if installed) and confirm it reconnects:

```
Start-Service STIGManagerWatcher
Start-Sleep -Seconds 20
Get-Content C:\Services\stigman-watcher\stigman-watcher-svc.out.log -Tail 10
```

Look for “preflight api requests succeeded” in the Watcher log, which confirms it re-authenticated against the upgraded API. The Watcher takes several seconds to write it, so the lines must be new: check their timestamps (times in the log are UTC) and that remoteApiVersion shows the version you just installed. The lines from the previous start look the same apart from the version. Finally, verify the full service set:

```
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
```

Once everything is verified, you can delete the .bak binary and the temporary extraction folder.

### Step 16.8: Rollback (If Needed)

If the new version must be reverted:

1. Stop the services (Watcher first): Stop-Service STIGManagerWatcher; Stop-Service STIGManager
2. Restore the previous binary: remove the new exe and rename stig-manager-win.exe.bak back to stig-manager-win.exe
3. If a database migration had run, restore the backup from Step 16.2 (the upgraded schema is not compatible with the older binary)
4. Start STIGManager and verify the version, then start STIGManagerWatcher

> **Important:** Rollback after a migration always requires restoring the database backup. This is why the Step 16.2 backup is mandatory for any release with a migration.

### Step 16.9: Updating Keycloak

Keycloak updates differently from STIG Manager. STIG Manager is a single binary you swap in place; Keycloak is a full distribution installed into a version-named folder (C:\Services\keycloak-\<version>). The supported approach is to install the new version into a new folder, migrate your configuration into it, rebuild, and re-point the Windows service. Keeping the old folder gives you an instant rollback path.

> **Important:** Use this same install-fresh-and-re-point pattern for any component that lives in a version-named folder. Releases within the same major series (for example 26.8.0 to 26.8.1, or 26.7.4 to 26.8.0) carry no realm export/import work — Keycloak migrates its own internal schema automatically on first start.

**1. Review the release notes and back up**

Security releases should be applied promptly. Back up the Keycloak config file and the keycloak database schema before starting:

```
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Copy-Item C:\Services\keycloak-<oldver>\conf\keycloak.conf "C:\Backups\keycloak.conf.$stamp.bak"
$env:MYSQL_PWD = '<mysql-root-password>'
& 'C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqldump.exe' -u root --databases keycloak --routines --triggers --single-transaction --result-file="C:\Backups\keycloak-db-$stamp.sql"
$env:MYSQL_PWD = $null
```

**2. Download and extract the new version**

```
$ver = '26.8.1'
Invoke-WebRequest -Uri "https://github.com/keycloak/keycloak/releases/download/$ver/keycloak-$ver.zip" -OutFile "C:\Installers\keycloak-$ver.zip"
(Get-FileHash "C:\Installers\keycloak-$ver.zip" -Algorithm SHA256).Hash
```

Compare that hash with the SHA-256 digest shown beside the file on the GitHub release page. Only if they match, extract it:

```
Expand-Archive "C:\Installers\keycloak-$ver.zip" -DestinationPath C:\Services
```

This creates C:\Services\keycloak-\<newver>\.

**3. Migrate configuration into the new folder**

Copy the whole conf folder and the WinSW service wrapper from the old folder. conf holds keycloak.conf and also subfolders such as truststores (the certificates LDAPS federation relies on), which a copy of keycloak.conf alone would silently leave behind. The service XML uses %BASE%, so it works unchanged in the new location. If you added any custom providers or themes, copy those subfolders too.

```
$old = 'C:\Services\keycloak-<oldver>'; $new = 'C:\Services\keycloak-<newver>'
Copy-Item "$old\conf\*" "$new\conf" -Recurse -Force
Copy-Item "$old\keycloak-svc.exe"     "$new\keycloak-svc.exe"     -Force
Copy-Item "$old\keycloak-svc.xml"     "$new\keycloak-svc.xml"     -Force
```

**4. Build for optimized start**

Build with the JDK the service itself runs on. Read it from the service wrapper, because the machine-wide or user-level JAVA_HOME can be out of date (on the test server the user-level one still named a JDK that a later update had removed, so a build run in a fresh window without this step failed).

```
$svc = [xml](Get-Content "$new\keycloak-svc.xml" -Raw)
$env:JAVA_HOME = ($svc.service.env | Where-Object { $_.name -eq 'JAVA_HOME' }).value
Test-Path $env:JAVA_HOME    # must print True
cd C:\Services\keycloak-<newver>
.\bin\kc.bat build
```

> **Note:** kc.bat build bakes the configuration (db vendor, hostname, features) into an optimized image so the service can start with --optimized. It is required after extracting a new distribution. The “run time options ... ignored during build time” message is normal — those settings apply at start, not build.

**5. Cut over the service**

Stop the dependents and Keycloak, then point the existing Windows service at the new folder. Run from an elevated PowerShell. Type sc.exe, not sc (sc is a PowerShell alias for Set-Content), and keep the space after binPath=.

```
Stop-Service STIGManagerWatcher; Stop-Service STIGManager; Stop-Service Keycloak
sc.exe config Keycloak binPath= "C:\Services\keycloak-<newver>\keycloak-svc.exe"
sc.exe qc Keycloak    # BINARY_PATH_NAME must name the new folder; DEPENDENCIES must still list MySQL84
```

> **Note:** sc.exe config changes only the binary path. The service name, its dependencies, its start type (including delayed start) and its recovery settings stay exactly as they are, so the dependencies declared by STIGManager and the Watcher continue to resolve. Re-registering the service from keycloak-svc.xml instead would take the start type from that file, which may not be what you configured.

**6. Start in order and verify**

```
Start-Service Keycloak
# Wait for 200. A connection failure (000) while Keycloak starts is normal; the loop gives up after three minutes.
$n = 0; do { Start-Sleep -Seconds 5; $n++; $code = curl.exe -s -o NUL -w "%{http_code}" http://localhost:8080/realms/stigman/.well-known/openid-configuration; $code } until ($code -eq '200' -or $n -ge 36)
Start-Service STIGManager
Start-Service STIGManagerWatcher
```

Confirm a clean start in the Keycloak log. Look for “Keycloak \<newver> ... started” and “Profile prod activated”. Some version bumps also log realm migration lines; a patch release may not:

```
Get-Content C:\Services\keycloak-<newver>\keycloak-svc.out.log -Tail 15
```

Then verify the identity path end-to-end: the realm OIDC metadata is served, and STIG Manager login works.

```
(Invoke-RestMethod 'http://localhost:8080/realms/stigman/.well-known/openid-configuration').issuer
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
```

Log in through https://YOUR_SERVER_IP/ to confirm authentication still works. Once verified, the old keycloak-\<oldver> folder can be archived or deleted; until then it is your rollback: stop the three services, run sc.exe config Keycloak binPath= "C:\Services\keycloak-\<oldver>\keycloak-svc.exe", and start them again in the order above. Keycloak logs a warning that the database was already migrated by the newer version and then starts normally; restore the keycloak database backup from step 1 only if it refuses to start.

> **Note:** Keycloak 26.8.0 changes one behaviour that applies from this version forward: brute-force lockout data is now stored in the keycloak database by default instead of in server memory, and the previous in-memory behaviour is only available through the deprecated login-failures:v1 feature switch. The practical difference is that a temporarily locked-out user stays locked out after a Keycloak restart; before 26.8.0 the lockouts were kept in memory and a restart cleared them. The imported realm (stigman-realm.json) has brute-force protection enabled, so failed logins do lock users out. No step in this procedure changes, and the step-1 dump of the keycloak schema already covers the new table. If in-memory behaviour is specifically required, set features=login-failures:v1 in keycloak.conf and rebuild; the switch is deprecated.

### Step 16.10: Updating Caddy

Caddy is a single binary you swap in place, like STIG Manager in Step 16.5. The Caddyfile, TLS material, and branding folder are left untouched, and Caddy has no database, so there is no backup step — the old binary kept beside the new one is the rollback. Caddy 2.11.6 changes two defaults that apply from this version forward and to every request through the proxy — a 16 KiB request-header cap (before, Go's 1 MiB) and an abort of any body read or response write that makes no progress for more than 60 seconds — and it validates Caddyfiles more strictly, so a config that started before may fail to start now. That is why this step has checks a plain binary swap does not. Read the release notes for every version between your current and target release first: https://github.com/caddyserver/caddy/releases

**1. Download and verify the new binary**

```
$ver = '2.11.7'
$url = "https://github.com/caddyserver/caddy/releases/download/v$ver/caddy_${ver}_windows_amd64.zip"
Invoke-WebRequest -Uri $url -OutFile "C:\Installers\caddy_${ver}_windows_amd64.zip"
(Get-FileHash "C:\Installers\caddy_${ver}_windows_amd64.zip" -Algorithm SHA256).Hash
```

Compare that hash with the SHA-256 digest shown beside the file on the GitHub release page. Only if they match, extract it (the archive contains caddy.exe):

```
Expand-Archive "C:\Installers\caddy_${ver}_windows_amd64.zip" -DestinationPath C:\Installers\caddy-$ver -Force
```

> **Note:** If the archive extracts caddy.exe into a nested folder, use that path in the following steps instead of C:\Installers\caddy-$ver\caddy.exe.

**2. Validate the current Caddyfile with the new binary, before swapping**

Stricter validation in 2.11.6 rejects Caddyfile constructs that earlier 2.11 releases silently accepted, so a config that started before can fail to start now. Run the new binary against the live Caddyfile before you replace anything (keep the & and quotes as shown — a command path containing a variable does not expand without them):

```
& "C:\Installers\caddy-$ver\caddy.exe" validate --config C:\Services\caddy\Caddyfile
```

It must report success before you continue. If it reports an error, fix the Caddyfile and validate again — starting the service with a config the new binary rejects would leave the site down.

**3. Swap the binary and start**

```
Stop-Service Caddy
Rename-Item C:\Services\caddy\caddy.exe caddy-<oldver>.exe.bak
Copy-Item "C:\Installers\caddy-$ver\caddy.exe" C:\Services\caddy\caddy.exe -Force
Start-Service Caddy
C:\Services\caddy\caddy.exe version
```

The version line must name the new release, the service must be Running, and the site must answer through the proxy:

```
Get-Service Caddy | Select-Object Name, Status
curl.exe -sk -o NUL -w "%{http_code}" https://localhost/api/op/configuration
```

That endpoint returns 200 only if Caddy is serving TLS and proxying /api/\* to the STIG Manager API.

**4. Verify the paths the new defaults can break**

- Header cap: log in through the browser at https://YOUR_SERVER_IP/ and confirm the application loads and a collection opens, exactly as Step 16.7 does. A client whose cookies or OIDC tokens push the request headers past 16 KiB now gets 431 Request Header Fields Too Large on every proxied route, so a login that worked before this swap but fails now is the first place to look. If you see 431 responses, raise the cap with the max_header_size server option in the Caddyfile, then reload Caddy (Appendix C). The same login check covers request header fields containing '.' (dropped in 2.11.6 the way underscores were in 2.11.4); if a client relies on one, allow it back with the expected_dot_headers server option.
- Idle timeout: a request body read or response write through Caddy that makes no progress for more than 60 seconds is now aborted (on the test server a stalled upload stayed open past 80 seconds on 2.11.4 and was cut off at 60 seconds with HTTP 499 on 2.11.6). An upload that keeps moving, however slowly, is left alone. This applies to browser traffic, such as a file uploaded in the web UI. It does not apply to the Watcher as this guide installs it: Install-Watcher.ps1 points the Watcher straight at the API on localhost:54000, so its imports do not pass through Caddy. If uploads through the web UI start failing after a pause of about a minute, or if you have pointed a Watcher at the public HTTPS address instead, raise the limits with read_body_idle and write_idle in the timeouts server option, then reload Caddy (Appendix C).

If the Watcher is installed, confirm it still imports after the update: place a scan result in its watched folder and check that the file is listed in the Watcher's history file on its next scan.

Finally, verify the full service set:

```
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
```

Once everything is verified, you can delete the .bak binary; until then it is your rollback: stop Caddy, delete caddy.exe, rename the .bak back to caddy.exe, and start Caddy again.

## 17. Customize the Home Page (Optional)

STIG Manager's Home tab shows a Welcome widget you can brand with your organization's logo, a title, a message, and a link. These come from STIGMAN_CLIENT_\* environment variables that the service reads from stig-manager-svc.xml. Because the config is loaded by the Windows service, edit it with the Set-HomePage.ps1 script, which updates the service config and restarts STIG Manager for you — no hand-editing XML or restarting services manually.

### What you can set

- Title — the Welcome widget heading (STIGMAN_CLIENT_WELCOME_TITLE)
- Message — body text, for example a usage policy or point-of-contact information (STIGMAN_CLIENT_WELCOME_MESSAGE)
- Link — an optional hyperlink shown after the message (STIGMAN_CLIENT_WELCOME_LINK)
- Logo — an image shown in the widget, scaled to a maximum of 125 pixels (STIGMAN_CLIENT_WELCOME_IMAGE)
- Classification banner — one of NONE, U, CUI, C, S, TS, or SCI (STIGMAN_CLASSIFICATION)

> **Note:** The logo is referenced by URL — STIG Manager does not store the image itself. Set-HomePage.ps1 self-hosts it through Caddy (the Caddyfile includes a /branding route), so you do not need a separate web server.

### Run the script

From an elevated PowerShell at the repo root, pass the values you want. This is a single line — do not break it:

```
.\install\Set-HomePage.ps1 -Title "ACME Cyber Operations" -Message "Authorized use only. SOC: soc@acme.example, x1234." -Link "https://intranet.acme.example/cyber" -LogoFile "C:\branding\acme-logo.png"
```

The script copies your logo into C:\Services\caddy\branding, points the Welcome image at https://YOUR_SERVER_IP/branding/\<file>, writes the other values into stig-manager-svc.xml, and restarts the service. When it finishes, hard-refresh the Home tab in the browser (Ctrl+F5) to see the changes.

> **Note:** Provide only the parameters you want to change; omit the rest. Pass an empty value (for example -Title "") to clear a setting back to its default. To use an image you already host, use -LogoUrl "https://..." instead of -LogoFile. To change the logo later, re-run with a new -LogoFile, or just replace C:\Services\caddy\branding\logo.\<ext>.

> **Important:** The logo URL must be reachable from each user's browser. The default https://YOUR_SERVER_IP/branding/... works once the certificate is trusted (Step 8.3). If you would rather not host the image at all, set STIGMAN_CLIENT_WELCOME_IMAGE to a data URI (data:image/png;base64,...) in stig-manager-svc.xml instead.

## Appendix A: Architecture

All components run on a single Windows Server. Caddy is the only externally-facing service — it terminates TLS and routes requests to the backend services. All inter-service communication uses HTTP on localhost.

**Request Flow:**

```
  Client Browser
       |
  HTTPS :443 (only external port)
       |
  [ Caddy - Reverse Proxy ]
       |                  |
  /api, /            /realms, /resources
       |                  |
  [ STIG Manager ]   [ Keycloak ]
  HTTP :54000        HTTP :8080
       |                  |
       +--- [ MySQL ] ----+
            :3306
```

**Service Ports:**

| Port | Service | Listens On | Purpose |
|----|----|----|----|
| `443` | Caddy | All interfaces | HTTPS (external) |
| `2019` | Caddy Admin API | localhost only | Config reload |
| `8080` | Keycloak | localhost only | OIDC / Auth |
| `54000` | STIG Manager | All interfaces* | API / Web UI |
| `3306` | MySQL | localhost only | Database |

> **Note:** \*STIG Manager listens on 0.0.0.0:54000 but should only be accessed through Caddy. Consider adding a Windows Firewall rule to block direct access to port 54000 from external hosts.

## Appendix B: Credentials Reference

This table shows all accounts and the default test passwords used in this guide. Record any password changes you make during installation.

| Service | Account | Default Test Password | Configured In |
|----|----|----|----|
| MySQL Root | root@localhost | `STIGman_Root_2026!` | MySQL only |
| MySQL (STIG Mgr) | stigman@localhost | `STIGman_DB_2026!` | stig-manager-svc.xml |
| MySQL (Keycloak) | keycloak@localhost | `Keycloak_DB_2026!` | keycloak.conf |
| Keycloak Admin | admin | `Admin_KC_2026!` | bootstrap-admin CLI |
| STIG Mgr Admin | stigman-admin | `STIGman_Admin_2026!` | stigman-realm.json |
| STIG Mgr User | stigman-user | `STIGman_User_2026!` | stigman-realm.json |
| Watcher Client | stigman-watcher | `(generated secret)` | Keycloak + .env |

> **Important:** Change ALL passwords before deploying to production. See Section 14 for the step-by-step password change procedure.

## Appendix C: Service Management Commands

Common commands for managing the STIG Manager services. All commands require an elevated (Administrator) PowerShell.

**Check service status:**

```
Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status, StartType
```

**Start all services (dependency order):**

```
Start-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher
```

**Stop all services (reverse dependency order):**

```
Stop-Service STIGManagerWatcher, Caddy, STIGManager
Stop-Service Keycloak
Stop-Service MySQL84
```

> **Note:** STIGManagerWatcher and STIGManager depend on Keycloak, so they must be stopped first. Attempting to stop Keycloak while dependent services are running will fail unless you use the -Force flag, which forcibly terminates dependent services.

**Restart a single service:**

```
Restart-Service STIGManager
```

**View STIG Manager logs:**

```
Get-Content C:\Services\stig-manager\stig-manager-svc.out.log -Tail 50
```

**View Keycloak logs:**

```
Get-Content C:\Services\keycloak-26.8.1\keycloak-svc.out.log -Tail 50
```

**View Caddy logs (if Caddy fails to start):**

```
C:\Services\caddy\caddy.exe run --config C:\Services\caddy\Caddyfile
```

> **Note:** Running Caddy interactively shows errors directly in the console. Press Ctrl+C to stop, then fix the Caddyfile and restart the service.

**Reload Caddy config without restarting:**

```
$body = Get-Content C:\Services\caddy\Caddyfile -Raw
Invoke-WebRequest -Uri 'http://localhost:2019/load' -Method POST -Body $body -ContentType 'text/caddyfile' -UseBasicParsing
```

**View Watcher logs:**

```
Get-Content C:\Services\stigman-watcher\stigman-watcher-svc.out.log -Tail 50
```

**Verify STIG Manager version:**

```
(Invoke-RestMethod -Uri 'http://localhost:54000/api/op/definition').info.version
```
