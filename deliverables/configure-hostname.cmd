@echo off
REM Thin launcher for Configure-Hostname.ps1 (kept for compatibility with older
REM instructions). The real logic lives in Configure-Hostname.ps1, which is
REM version-agnostic and avoids cmd.exe escaping issues.
if "%~1"=="" (
    echo Usage: configure-hostname.cmd ^<hostname-or-ip^>
    echo   example: configure-hostname.cmd stigman.yourdomain.mil
    pause
    exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Configure-Hostname.ps1" %*
pause
