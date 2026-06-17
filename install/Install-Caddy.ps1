# Installs Caddy and writes the Caddyfile (Sections 6.1-6.2).
# Handles either form of the Caddy download: the .exe directly, or the GitHub
# release .zip that contains caddy.exe (this was a source of confusion in the
# manual steps).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Caddy.ps1
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

$caddyDir = Join-Path $ServicesDir 'caddy'
$caddyExe = Join-Path $caddyDir 'caddy.exe'

Write-Step "Setting up Caddy"
New-Item -ItemType Directory -Path $caddyDir -Force | Out-Null

if (Test-Path $caddyExe) {
    Write-Ok "caddy.exe already present at $caddyDir"
} else {
    $srcExe = Get-ChildItem (Join-Path $InstallersDir 'caddy*windows*amd64*.exe') -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($srcExe) {
        Copy-Item $srcExe.FullName $caddyExe -Force
    } else {
        $srcZip = Get-ChildItem (Join-Path $InstallersDir 'caddy*windows*amd64*.zip') -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $srcZip) { Fail "No Caddy binary found in $InstallersDir (expected caddy*windows*amd64*.exe or .zip)." }
        $tmp = Join-Path $env:TEMP ("caddy-" + [guid]::NewGuid().ToString('N'))
        Expand-Archive -Path $srcZip.FullName -DestinationPath $tmp -Force
        $inZip = Get-ChildItem $tmp -Recurse -Filter 'caddy.exe' | Select-Object -First 1
        if (-not $inZip) { Fail "caddy.exe not found inside $($srcZip.Name)." }
        Copy-Item $inZip.FullName $caddyExe -Force
        Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
    Write-Ok "caddy.exe in place."
}

Write-Step "Writing Caddyfile"
$caddyfile = Join-Path $caddyDir 'Caddyfile'
Set-TextFile -Path $caddyfile -Content (New-Caddyfile -ServerIp $ServerIp)
& $caddyExe validate --config $caddyfile --adapter caddyfile *>$null
if ($LASTEXITCODE -ne 0) { Fail "Caddyfile failed validation." }
Write-Ok "Caddyfile written and validated (site: $ServerIp, localhost)."
Write-Step "Caddy ready."
