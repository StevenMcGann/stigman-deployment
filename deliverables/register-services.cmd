@echo off
echo ============================================
echo  STIG Manager - Windows Service Registration
echo ============================================
echo.
echo This script must be run as Administrator.
echo.

REM Stop any running foreground processes first
echo Stopping any running foreground processes...
taskkill /F /IM caddy.exe 2>nul
taskkill /F /IM stig-manager-win.exe 2>nul
taskkill /F /IM java.exe 2>nul
timeout /t 3 /nobreak >nul

REM ---- Step 1: Caddy ----
echo.
echo [1/5] Registering Caddy service...
sc.exe create Caddy binPath= "\"C:\Services\caddy\caddy.exe\" run --config \"C:\Services\caddy\Caddyfile\"" start= auto
sc.exe description Caddy "Caddy reverse proxy for STIG Manager"

REM ---- Step 2: Build Keycloak ----
echo.
echo [2/5] Building Keycloak for production...
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
cd /d C:\Services\keycloak-26.6.2
call bin\kc.bat build

REM ---- Step 3: Keycloak via WinSW ----
echo.
echo [3/5] Registering Keycloak service (WinSW)...
REM Copy WinSW executable if not present
if not exist "C:\Services\keycloak-26.6.2\keycloak-svc.exe" (
    copy "C:\Services\stig-manager\stig-manager-svc.exe" "C:\Services\keycloak-26.6.2\keycloak-svc.exe"
)
cd /d C:\Services\keycloak-26.6.2
keycloak-svc.exe install
echo Verifying Keycloak service...
sc.exe query Keycloak | findstr STATE
if errorlevel 1 (
    echo ERROR: Keycloak service not registered. Check keycloak-svc.xml.
    pause
    exit /b 1
)

REM ---- Step 4: STIG Manager via WinSW ----
echo.
echo [4/5] Registering STIG Manager service (WinSW)...
cd /d C:\Services\stig-manager
stig-manager-svc.exe install
echo Verifying STIGManager service...
sc.exe query STIGManager | findstr STATE
if errorlevel 1 (
    echo ERROR: STIGManager service not registered. Check stig-manager-svc.xml.
    pause
    exit /b 1
)

REM ---- Step 5: STIG Manager Watcher via WinSW ----
echo.
echo [5/6] Registering STIG Manager Watcher service (WinSW)...
cd /d C:\Services\stigman-watcher
stigman-watcher-svc.exe install
echo Verifying STIGManagerWatcher service...
sc.exe query STIGManagerWatcher | findstr STATE
if errorlevel 1 (
    echo ERROR: STIGManagerWatcher service not registered. Check stigman-watcher-svc.xml.
    pause
    exit /b 1
)

REM ---- Step 6: Set dependencies ----
echo.
echo [6/6] Setting service dependencies...
sc.exe config Keycloak depend= MySQL84
sc.exe config STIGManager depend= MySQL84/Keycloak
sc.exe config STIGManagerWatcher depend= MySQL84/Keycloak/STIGManager

REM ---- Start services in dependency order ----
echo.
echo Starting services...
net start MySQL84 2>nul
echo Waiting for MySQL to initialize...
timeout /t 10 /nobreak >nul

net start Keycloak
echo Waiting for Keycloak to initialize...
timeout /t 30 /nobreak >nul

net start STIGManager
echo Waiting for STIG Manager to initialize...
timeout /t 10 /nobreak >nul

net start Caddy

net start STIGManagerWatcher

echo.
echo ============================================
echo  Service registration complete!
echo ============================================
echo.
echo Service status:
sc.exe query MySQL84 | findstr STATE
sc.exe query Keycloak | findstr STATE
sc.exe query STIGManager | findstr STATE
sc.exe query Caddy | findstr STATE
sc.exe query STIGManagerWatcher | findstr STATE
echo.
echo Next steps:
echo   1. Open https://localhost in a browser
echo   2. Accept the self-signed certificate warning
echo   3. Log in with: stigman-admin / STIGman_Admin_2026!
echo   4. Drop .ckl/.cklb/XCCDF files into C:\Services\stigman-watcher\watched\
echo.
pause
