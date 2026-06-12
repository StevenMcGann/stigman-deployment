@echo off
setlocal enabledelayedexpansion

echo =============================================
echo  STIG Manager - Configure Server Hostname
echo =============================================
echo.
echo This script updates all service configs to use
echo a new hostname or IP address. Run as Administrator.
echo.

if "%~1"=="" (
    echo Usage: configure-hostname.cmd ^<hostname-or-ip^>
    echo.
    echo Examples:
    echo   configure-hostname.cmd stigman.yourdomain.mil
    echo   configure-hostname.cmd 192.168.1.100
    echo.
    pause
    exit /b 1
)

set "NEW_HOST=%~1"
echo Configuring all services for: %NEW_HOST%
echo.

REM ---- Stop services (Watcher first - it depends on STIGManager/Keycloak) ----
echo Stopping services...
net stop STIGManagerWatcher 2>nul
net stop Caddy 2>nul
net stop STIGManager 2>nul
net stop Keycloak 2>nul
timeout /t 5 /nobreak >nul

REM ---- Update Caddyfile ----
echo.
echo [1/4] Updating Caddyfile...
set "CADDYFILE=C:\Services\caddy\Caddyfile"
if not exist "%CADDYFILE%" (
    echo ERROR: %CADDYFILE% not found
    pause
    exit /b 1
)

REM Use PowerShell for reliable file replacement
powershell -NoProfile -Command ^
  "$f = Get-Content '%CADDYFILE%' -Raw;" ^
  "$f = $f -replace '^[^\r\n{]+\{', '%NEW_HOST%, localhost {';" ^
  "Set-Content '%CADDYFILE%' $f -Encoding utf8 -NoNewline"
echo    Caddyfile updated.

REM ---- Update keycloak.conf ----
echo.
echo [2/4] Updating keycloak.conf...
set "KCCONF=C:\Services\keycloak-26.6.2\conf\keycloak.conf"
powershell -NoProfile -Command ^
  "(Get-Content '%KCCONF%') -replace 'hostname=https://.*', 'hostname=https://%NEW_HOST%' | Set-Content '%KCCONF%' -Encoding utf8"
echo    keycloak.conf updated.

REM ---- Update stig-manager-svc.xml ----
echo.
echo [3/4] Updating stig-manager-svc.xml...
set "SMXML=C:\Services\stig-manager\stig-manager-svc.xml"
powershell -NoProfile -Command ^
  "(Get-Content '%SMXML%') -replace 'STIGMAN_CLIENT_OIDC_PROVIDER\" value=\"https://[^\"]+', 'STIGMAN_CLIENT_OIDC_PROVIDER\" value=\"https://%NEW_HOST%/realms/stigman' | Set-Content '%SMXML%' -Encoding utf8"
echo    stig-manager-svc.xml updated.

REM ---- Rebuild Keycloak ----
echo.
echo [4/4] Rebuilding Keycloak with new hostname...
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd /d C:\Services\keycloak-26.6.2
call bin\kc.bat build

REM ---- Restart services ----
echo.
echo Restarting services...
net start Keycloak
echo Waiting for Keycloak to initialize...
timeout /t 30 /nobreak >nul

net start STIGManager
echo Waiting for STIG Manager to initialize...
timeout /t 10 /nobreak >nul

net start Caddy
timeout /t 5 /nobreak >nul

net start STIGManagerWatcher 2>nul

REM ---- Reload Caddy ----
echo Reloading Caddy configuration...
powershell -NoProfile -Command ^
  "$body = Get-Content 'C:\Services\caddy\Caddyfile' -Raw;" ^
  "Invoke-WebRequest -Uri 'http://localhost:2019/load' -Method POST -Body $body -ContentType 'text/caddyfile' -UseBasicParsing"

echo.
echo =============================================
echo  Configuration complete!
echo =============================================
echo.
echo Service status:
sc.exe query Keycloak | findstr STATE
sc.exe query STIGManager | findstr STATE
sc.exe query Caddy | findstr STATE
sc.exe query STIGManagerWatcher | findstr STATE
echo.
echo Access STIG Manager at: https://%NEW_HOST%/
echo.
pause
