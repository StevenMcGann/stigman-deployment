# Installs and configures Keycloak (Sections 4.1-4.3 and 7.1):
#   - extracts the Keycloak distribution
#   - writes conf\keycloak.conf with your settings
#   - creates the bootstrap admin account
#   - builds Keycloak for optimized (production) start
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Keycloak.ps1
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

if (-not (Test-Path (Join-Path $JdkHome 'bin\java.exe'))) { Fail "JDK not found at $JdkHome. Run Install-Java.ps1 first." }
$env:JAVA_HOME = $JdkHome

$kcDir = Join-Path $ServicesDir "keycloak-$KeycloakVersion"

Write-Step "Extracting Keycloak $KeycloakVersion"
if (Test-Path (Join-Path $kcDir 'bin\kc.bat')) {
    Write-Ok "Keycloak already extracted at $kcDir"
} else {
    $zip = Join-Path $InstallersDir "keycloak-$KeycloakVersion.zip"
    if (-not (Test-Path $zip)) { Fail "Keycloak zip not found: $zip" }
    Expand-Archive -Path $zip -DestinationPath $ServicesDir -Force
    if (-not (Test-Path (Join-Path $kcDir 'bin\kc.bat'))) { Fail "kc.bat not found under $kcDir after extract." }
}

Write-Step "Writing keycloak.conf"
Set-TextFile -Path (Join-Path $kcDir 'conf\keycloak.conf') -Content (New-KeycloakConf -KeycloakDbPassword $KeycloakDbPassword -ServerIp $ServerIp)
Write-Ok "conf\keycloak.conf written (hostname=https://$ServerIp)."

Write-Step "Creating the Keycloak bootstrap admin account"
$env:KC_BOOTSTRAP_ADMIN_PASSWORD = $KeycloakAdminPassword
& (Join-Path $kcDir 'bin\kc.bat') bootstrap-admin user --username $KeycloakAdminUser --password:env KC_BOOTSTRAP_ADMIN_PASSWORD
Remove-Item Env:KC_BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
Write-Note "If the admin user already existed, Keycloak reports it and continues."

Write-Step "Building Keycloak for optimized start (this can take a minute)"
& (Join-Path $kcDir 'bin\kc.bat') build
if ($LASTEXITCODE -ne 0) { Fail "kc.bat build failed." }
Write-Step "Keycloak ready."
