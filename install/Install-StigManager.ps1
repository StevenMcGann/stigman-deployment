# Installs STIG Manager (Sections 5.1-5.3):
#   - extracts the STIG Manager binary
#   - copies the WinSW wrapper
#   - writes stig-manager-svc.xml with your settings
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-StigManager.ps1
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

$smDir = Join-Path $ServicesDir 'stig-manager'
$exe   = Join-Path $smDir 'stig-manager-win.exe'

Write-Step "Extracting STIG Manager $StigmanVersion"
if (Test-Path $exe) {
    Write-Ok "STIG Manager already extracted at $smDir"
} else {
    New-Item -ItemType Directory -Path $smDir -Force | Out-Null
    $zip = Join-Path $InstallersDir "stig-manager-win-$StigmanVersion.zip"
    if (-not (Test-Path $zip)) { Fail "STIG Manager zip not found: $zip" }
    Expand-Archive -Path $zip -DestinationPath $smDir -Force
    if (-not (Test-Path $exe)) {
        # Handle a nested folder inside the zip.
        $nested = Get-ChildItem $smDir -Recurse -Filter 'stig-manager-win.exe' | Select-Object -First 1
        if ($nested) { Move-Item $nested.FullName $exe -Force }
    }
    if (-not (Test-Path $exe)) { Fail "stig-manager-win.exe not found under $smDir after extract." }
}

Write-Step "Setting up the WinSW service wrapper"
$winsw = Join-Path $InstallersDir 'WinSW-x64.exe'
if (-not (Test-Path $winsw)) { Fail "WinSW-x64.exe not found in $InstallersDir." }
Copy-Item $winsw (Join-Path $smDir 'stig-manager-svc.exe') -Force
Write-Ok "stig-manager-svc.exe in place."

Write-Step "Writing stig-manager-svc.xml"
Set-TextFile -Path (Join-Path $smDir 'stig-manager-svc.xml') -Content (New-StigmanSvcXml -StigmanDbPassword $StigmanDbPassword -ServerIp $ServerIp)
Write-Ok "stig-manager-svc.xml written (CLIENT_OIDC_PROVIDER=https://$ServerIp/realms/stigman)."
Write-Step "STIG Manager ready."
