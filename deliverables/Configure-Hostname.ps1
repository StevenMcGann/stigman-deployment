# Updates the server hostname/IP across all STIG Manager config files, rebuilds
# Keycloak, and restarts the stack. Self-contained (no other files needed).
#
# Run from an elevated PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Configure-Hostname.ps1 stigman.yourdomain.mil
#
# This replaces the old configure-hostname.cmd, which hardcoded the Keycloak
# folder name (broke after the 26.6.2 -> 26.6.3 update) and mangled its
# Set-Content commands through cmd.exe caret-escaping.

param([Parameter(Mandatory)][string]$NewHost)

$ErrorActionPreference = 'Stop'
function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    [OK] $m" -ForegroundColor Green }

# Elevation check
$pr = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $pr.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
    Write-Host "This script must be run as Administrator." -ForegroundColor Red; exit 1
}

$ServicesDir = 'C:\Services'
$JdkHome = 'C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot'

# Detect the Keycloak folder (highest version) - version-agnostic.
$kcDir = Get-ChildItem -Path $ServicesDir -Directory -Filter 'keycloak-*' -ErrorAction SilentlyContinue |
    Sort-Object { try { [version]($_.Name -replace '^keycloak-','') } catch { [version]'0.0.0' } } -Descending |
    Select-Object -First 1 -ExpandProperty FullName
if (-not $kcDir) { Write-Host "No keycloak-* folder under $ServicesDir" -ForegroundColor Red; exit 1 }

Write-Host "Configuring all services for: $NewHost"
Write-Host "Using Keycloak folder: $kcDir"

Step "Stopping services"
foreach ($s in 'STIGManagerWatcher','Caddy','STIGManager','Keycloak') {
    $svc = Get-Service $s -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq 'Running') { Stop-Service $s -Force }
}

Step "[1/4] Updating Caddyfile"
$caddyfile = "$ServicesDir\caddy\Caddyfile"
$lines = Get-Content $caddyfile
$lines[0] = "$NewHost, localhost {"      # site address is always the first line
Set-Content $caddyfile $lines -Encoding utf8
Ok "Caddyfile site address set."

Step "[2/4] Updating keycloak.conf"
$kcConf = Join-Path $kcDir 'conf\keycloak.conf'
(Get-Content $kcConf) -replace '^hostname=https://.*', "hostname=https://$NewHost" | Set-Content $kcConf -Encoding utf8
Ok "keycloak.conf hostname set."

Step "[3/4] Updating stig-manager-svc.xml"
$smXml = "$ServicesDir\stig-manager\stig-manager-svc.xml"
(Get-Content $smXml) -replace '(STIGMAN_CLIENT_OIDC_PROVIDER" value=")https://[^"]+', "`${1}https://$NewHost/realms/stigman" |
    Set-Content $smXml -Encoding utf8
Ok "stig-manager-svc.xml CLIENT_OIDC_PROVIDER set."

Step "[4/4] Rebuilding Keycloak"
$env:JAVA_HOME = $JdkHome
& (Join-Path $kcDir 'bin\kc.bat') build
if ($LASTEXITCODE -ne 0) { Write-Host "kc.bat build failed." -ForegroundColor Red; exit 1 }

Step "Restarting services"
Start-Service Keycloak;    Start-Sleep -Seconds 30
Start-Service STIGManager; Start-Sleep -Seconds 10
Start-Service Caddy;       Start-Sleep -Seconds 5
Start-Service STIGManagerWatcher -ErrorAction SilentlyContinue

# Reload Caddy from the updated file
try {
    $body = Get-Content $caddyfile -Raw
    Invoke-WebRequest -Uri 'http://localhost:2019/load' -Method POST -Body $body -ContentType 'text/caddyfile' -UseBasicParsing | Out-Null
    Ok "Caddy reloaded."
} catch { Write-Host "    [!] Caddy reload skipped: $($_.Exception.Message)" -ForegroundColor Yellow }

Step "Configuration complete. Access STIG Manager at: https://$NewHost/"
Get-Service Keycloak, STIGManager, Caddy -ErrorAction SilentlyContinue | Format-Table Name, Status -AutoSize
