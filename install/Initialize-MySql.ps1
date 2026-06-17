# Installs MySQL 8.4 (if needed), initializes the data directory, and registers
# and starts the MySQL84 service (Sections 2.1-2.2).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Initialize-MySql.ps1
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

$mysqld = Join-Path $MySqlBin 'mysqld.exe'

Write-Step "Installing MySQL 8.4 (if not already installed)"
if (Test-Path $mysqld) {
    Write-Ok "MySQL already installed at $MySqlBin"
} else {
    $msi = Get-ChildItem (Join-Path $InstallersDir 'mysql-*-winx64.msi') -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $msi) { Fail "MySQL MSI not found in $InstallersDir (expected mysql-*-winx64.msi)." }
    Write-Note "Running $($msi.Name) ..."
    Start-Process msiexec.exe -ArgumentList '/i', "`"$($msi.FullName)`"", '/quiet' -Wait
    if (-not (Test-Path $mysqld)) { Fail "mysqld.exe not found at $MySqlBin after install. Update `$MySqlBin in stigman-config.ps1." }
}

Write-Step "Initializing the database and service"
$svc = Get-Service MySQL84 -ErrorAction SilentlyContinue
if ($svc) {
    Write-Ok "MySQL84 service already registered."
} else {
    Write-Note "Initializing data directory (insecure root, password set in the next step)..."
    & $mysqld --initialize-insecure --console
    Write-Note "Registering the MySQL84 service..."
    & $mysqld --install MySQL84
}

if ((Get-Service MySQL84).Status -ne 'Running') { Start-Service MySQL84 }
Write-Ok "MySQL84 is $((Get-Service MySQL84).Status)."
Write-Step "MySQL ready. Next: Create-Databases.ps1"
