# Registers and starts the Windows services (Section 7).
# Version-agnostic: the Keycloak folder is detected automatically, so this keeps
# working after a Keycloak version bump (the old register-services.cmd hardcoded
# keycloak-26.6.2 and broke when the package moved to 26.6.3).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Register-Services.ps1
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

$kcDir   = Resolve-KeycloakDir -ServicesDir $ServicesDir -Version $KeycloakVersion
$smDir   = Join-Path $ServicesDir 'stig-manager'
$caddy   = Join-Path $ServicesDir 'caddy\caddy.exe'
$winsw   = Join-Path $InstallersDir 'WinSW-x64.exe'
Write-Note "Using Keycloak folder: $kcDir"

# ---- Caddy (sc.exe) ----
Write-Step "Registering Caddy"
if (-not (Get-Service Caddy -ErrorAction SilentlyContinue)) {
    & sc.exe create Caddy binPath= "`"$caddy`" run --config `"$ServicesDir\caddy\Caddyfile`"" start= auto | Out-Null
    & sc.exe description Caddy "Caddy reverse proxy for STIG Manager" | Out-Null
    Write-Ok "Caddy registered."
} else { Write-Ok "Caddy already registered." }

# ---- Build Keycloak (required before --optimized service start) ----
Write-Step "Building Keycloak for production"
$env:JAVA_HOME = $JdkHome
& (Join-Path $kcDir 'bin\kc.bat') build
if ($LASTEXITCODE -ne 0) { Fail "kc.bat build failed." }

# ---- Keycloak (WinSW) ----
Write-Step "Registering Keycloak"
$kcSvcExe = Join-Path $kcDir 'keycloak-svc.exe'
if (-not (Test-Path $kcSvcExe)) {
    if (-not (Test-Path $winsw)) { Fail "WinSW-x64.exe not found in $InstallersDir." }
    Copy-Item $winsw $kcSvcExe -Force
}
$kcSvcXml = Join-Path $kcDir 'keycloak-svc.xml'
if (-not (Test-Path $kcSvcXml)) {
    $src = Join-Path $ServiceConfigsDir 'keycloak-svc.xml'
    if (Test-Path $src) { Copy-Item $src $kcSvcXml -Force; Write-Note "Copied keycloak-svc.xml into $kcDir" }
    else { Fail "keycloak-svc.xml missing in $kcDir and not found at $src." }
}
if (-not (Get-Service Keycloak -ErrorAction SilentlyContinue)) { & $kcSvcExe install | Out-Null }
Write-Ok "Keycloak registered."

# ---- STIG Manager (WinSW) ----
Write-Step "Registering STIG Manager"
if (-not (Get-Service STIGManager -ErrorAction SilentlyContinue)) { & (Join-Path $smDir 'stig-manager-svc.exe') install | Out-Null }
Write-Ok "STIGManager registered."

# ---- Watcher (optional) ----
$watchDir = Join-Path $ServicesDir 'stigman-watcher'
if (Test-Path (Join-Path $watchDir 'stigman-watcher-svc.exe')) {
    if (-not (Get-Service STIGManagerWatcher -ErrorAction SilentlyContinue)) { & (Join-Path $watchDir 'stigman-watcher-svc.exe') install | Out-Null }
    Write-Ok "STIGManagerWatcher registered."
}

# ---- Dependencies ----
Write-Step "Setting service dependencies"
& sc.exe config Keycloak    depend= MySQL84 | Out-Null
& sc.exe config STIGManager depend= MySQL84/Keycloak | Out-Null
if (Get-Service STIGManagerWatcher -ErrorAction SilentlyContinue) { & sc.exe config STIGManagerWatcher depend= MySQL84/Keycloak/STIGManager | Out-Null }

# ---- Start in order ----
Write-Step "Starting services"
foreach ($s in 'MySQL84','Keycloak') { Start-Service $s; Write-Note "$s $((Get-Service $s).Status)" }
Write-Note "Waiting 30s for Keycloak to finish starting..."
Start-Sleep -Seconds 30
foreach ($s in 'STIGManager','Caddy') { Start-Service $s; Write-Note "$s $((Get-Service $s).Status)" }
if (Get-Service STIGManagerWatcher -ErrorAction SilentlyContinue) { Start-Service STIGManagerWatcher -ErrorAction SilentlyContinue }

Write-Step "Service registration complete."
Get-Service MySQL84, Keycloak, STIGManager, Caddy -ErrorAction SilentlyContinue | Format-Table Name, Status, StartType -AutoSize
