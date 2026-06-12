# STIG Manager Complete Cleanup Script
# Run from an elevated PowerShell session
# Removes all deployment components for clean reinstall test

Write-Host "=== STIG Manager Complete Cleanup ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verify services are stopped and deleted
Write-Host "[1/5] Checking services..." -ForegroundColor Yellow
foreach ($svc in @('STIGManagerWatcher', 'STIGManager', 'Keycloak', 'Caddy', 'MySQL84')) {
    $s = Get-Service $svc -ErrorAction SilentlyContinue
    if ($s) {
        if ($s.Status -eq 'Running') { Stop-Service $svc -Force }
        sc.exe delete $svc | Out-Null
        Write-Host "  Deleted service: $svc"
    } else {
        Write-Host "  Service already removed: $svc"
    }
}

# 2. Delete C:\Services
Write-Host "[2/5] Removing C:\Services..." -ForegroundColor Yellow
if (Test-Path "C:\Services") {
    Remove-Item "C:\Services" -Recurse -Force
    Write-Host "  Deleted C:\Services"
} else {
    Write-Host "  C:\Services already removed"
}

# 3. Delete MySQL data
Write-Host "[3/5] Removing MySQL data..." -ForegroundColor Yellow
if (Test-Path "C:\ProgramData\MySQL") {
    Remove-Item "C:\ProgramData\MySQL" -Recurse -Force
    Write-Host "  Deleted C:\ProgramData\MySQL"
} else {
    Write-Host "  MySQL data already removed"
}
if (Test-Path "C:\Program Files\MySQL") {
    Remove-Item "C:\Program Files\MySQL" -Recurse -Force
    Write-Host "  Deleted C:\Program Files\MySQL"
} else {
    Write-Host "  MySQL program files already removed"
}

# 4. Delete JDK
Write-Host "[4/5] Removing JDK..." -ForegroundColor Yellow
$jdkPath = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
if (Test-Path $jdkPath) {
    Remove-Item $jdkPath -Recurse -Force
    Write-Host "  Deleted $jdkPath"
} else {
    Write-Host "  JDK already removed"
}

# 5. Clean JAVA_HOME if set
Write-Host "[5/5] Cleaning environment variables..." -ForegroundColor Yellow
$javaHome = [Environment]::GetEnvironmentVariable("JAVA_HOME", "Machine")
if ($javaHome) {
    [Environment]::SetEnvironmentVariable("JAVA_HOME", $null, "Machine")
    Write-Host "  Removed JAVA_HOME ($javaHome)"
} else {
    Write-Host "  JAVA_HOME not set"
}

# Verification
Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
Write-Host "Services remaining:" -ForegroundColor Yellow
foreach ($svc in @('STIGManagerWatcher', 'STIGManager', 'Keycloak', 'Caddy', 'MySQL84')) {
    $s = Get-Service $svc -ErrorAction SilentlyContinue
    if ($s) { Write-Host "  WARNING: $svc still exists!" -ForegroundColor Red }
    else { Write-Host "  $svc - GONE" -ForegroundColor Green }
}

Write-Host "Directories:" -ForegroundColor Yellow
foreach ($dir in @("C:\Services", "C:\ProgramData\MySQL", "C:\Program Files\MySQL", $jdkPath)) {
    if (Test-Path $dir) { Write-Host "  WARNING: $dir still exists!" -ForegroundColor Red }
    else { Write-Host "  $dir - GONE" -ForegroundColor Green }
}

Write-Host ""
Write-Host "Cleanup complete. System is ready for fresh install." -ForegroundColor Green
