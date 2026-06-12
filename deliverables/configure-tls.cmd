@echo off
echo =============================================
echo  STIG Manager - Configure TLS Certificates
echo =============================================
echo.
echo This script replaces Caddy's self-signed cert with
echo certificates from your organization's CA (AD CS).
echo Run as Administrator.
echo.
echo Prerequisites:
echo   - PEM-encoded certificate file (cert.pem)
echo   - PEM-encoded private key file (key.pem)
echo   - If your CA provides PFX/PKCS12 format, convert first:
echo       openssl pkcs12 -in cert.pfx -out cert.pem -clcerts -nokeys
echo       openssl pkcs12 -in cert.pfx -out key.pem -nocerts -nodes
echo.

if "%~1"=="" (
    echo Usage: configure-tls.cmd ^<cert.pem^> ^<key.pem^>
    echo.
    echo Example:
    echo   configure-tls.cmd C:\certs\stigman.pem C:\certs\stigman-key.pem
    echo.
    pause
    exit /b 1
)
if "%~2"=="" (
    echo ERROR: Both cert and key paths are required.
    echo Usage: configure-tls.cmd ^<cert.pem^> ^<key.pem^>
    pause
    exit /b 1
)

set "CERT_PATH=%~1"
set "KEY_PATH=%~2"

if not exist "%CERT_PATH%" (
    echo ERROR: Certificate file not found: %CERT_PATH%
    pause
    exit /b 1
)
if not exist "%KEY_PATH%" (
    echo ERROR: Key file not found: %KEY_PATH%
    pause
    exit /b 1
)

echo Installing certificates...

REM Create certs directory
if not exist "C:\Services\caddy\certs" mkdir "C:\Services\caddy\certs"

REM Copy cert files
copy /Y "%CERT_PATH%" "C:\Services\caddy\certs\cert.pem"
copy /Y "%KEY_PATH%" "C:\Services\caddy\certs\key.pem"

REM Lock down permissions on private key
icacls "C:\Services\caddy\certs\key.pem" /inheritance:r /grant:r "SYSTEM:R" "Administrators:R"

echo.
echo Updating Caddyfile...
set "CADDYFILE=C:\Services\caddy\Caddyfile"
powershell -NoProfile -Command ^
  "(Get-Content '%CADDYFILE%') -replace 'tls internal', 'tls C:\Services\caddy\certs\cert.pem C:\Services\caddy\certs\key.pem' | Set-Content '%CADDYFILE%' -Encoding utf8"

echo.
echo Reloading Caddy...
net stop Caddy 2>nul
timeout /t 3 /nobreak >nul
net start Caddy
timeout /t 5 /nobreak >nul
powershell -NoProfile -Command ^
  "$body = Get-Content 'C:\Services\caddy\Caddyfile' -Raw;" ^
  "Invoke-WebRequest -Uri 'http://localhost:2019/load' -Method POST -Body $body -ContentType 'text/caddyfile' -UseBasicParsing"

echo.
echo =============================================
echo  TLS certificate installation complete!
echo =============================================
echo.
echo Certificates installed to: C:\Services\caddy\certs\
echo Caddy reloaded with new certificates.
echo.
echo If the cert was issued by your internal CA (AD CS),
echo domain-joined clients will trust it automatically.
echo.
pause
