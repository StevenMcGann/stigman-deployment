# =====================================================================
#  STIG Manager - one-shot installer (Part I, Sections 2-8)
#  ---------------------------------------------------------------
#  Runs every install step in order, reading settings from
#  stigman-config.ps1. Designed so users never have to paste
#  multi-line commands into the console.
#
#  1. Edit stigman-config.ps1 (server address + passwords).
#  2. From an elevated PowerShell, run:
#       powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-All.ps1
#
#  Safe to re-run: every step is idempotent and skips work already done.
# =====================================================================
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

function Invoke-InstallStep($script, $argList = @()) {
    $path = Join-Path $PSScriptRoot $script
    Write-Host "`n################ $script ################" -ForegroundColor Magenta
    & powershell -NoProfile -ExecutionPolicy Bypass -File $path @argList
    if ($LASTEXITCODE -ne 0) { Fail "$script failed (exit $LASTEXITCODE). Fix the issue above and re-run Install-All.ps1." }
}

Write-Step "STIG Manager scripted install starting"
Write-Note "Server address: $ServerIp"

# Prereqs: directories + firewall
New-Item -ItemType Directory -Path $InstallersDir -Force | Out-Null
New-Item -ItemType Directory -Path $ServicesDir   -Force | Out-Null
if (-not (Get-NetFirewallRule -DisplayName 'STIG Manager HTTPS' -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName 'STIG Manager HTTPS' -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow | Out-Null
    Write-Ok "Opened firewall for TCP 443."
}

Invoke-InstallStep 'Initialize-MySql.ps1'
Invoke-InstallStep 'Create-Databases.ps1'
Invoke-InstallStep 'Install-Java.ps1'
Invoke-InstallStep 'Install-Keycloak.ps1'
Invoke-InstallStep 'Install-StigManager.ps1'
Invoke-InstallStep 'Install-Caddy.ps1'
Invoke-InstallStep 'Register-Services.ps1'

# Import the realm against the now-running Keycloak service, then restart STIG
# Manager so it picks up the realm immediately.
Invoke-InstallStep 'Import-Realm.ps1' @('-RealmJsonPath', $RealmJsonSource)
Restart-Service STIGManager -ErrorAction SilentlyContinue

Write-Step "Verifying endpoints"
Start-Sleep -Seconds 5
$checks = @(
    @{ n = 'STIG Manager API'; u = 'http://localhost:54000/api/op/definition' },
    @{ n = 'Keycloak realm';   u = 'http://localhost:8080/realms/stigman/.well-known/openid-configuration' }
)
foreach ($c in $checks) {
    try { Invoke-RestMethod -Uri $c.u -TimeoutSec 10 | Out-Null; Write-Ok "$($c.n) responding" }
    catch { Write-Warn2 "$($c.n) not responding yet ($($c.u)) - it may still be starting." }
}

Write-Step "Install complete."
Write-Host @"

    Open a browser to:  https://$ServerIp/
    Accept the self-signed certificate warning, then log in with:
        stigman-admin / STIGman_Admin_2026!

    Keycloak admin console:  https://$ServerIp/admin/
        $KeycloakAdminUser / (the admin password from stigman-config.ps1)

    CHANGE all sample passwords before production use (guide Section 14).
"@ -ForegroundColor Cyan
