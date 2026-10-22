# Installs Microsoft OpenJDK 17 and sets JAVA_HOME (Section 3).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Java.ps1
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

Write-Step "Installing Microsoft OpenJDK 17"
if (Test-Path (Join-Path $JdkHome 'bin\java.exe')) {
    Write-Ok "JDK already present at $JdkHome"
} else {
    # If more than one version has been staged, take the newest: by name alone
    # 17.0.19 sorts before 17.0.20 and 17.0.20.1. Versions can have four parts.
    $newest = { if ($_.Name -match '(\d+(\.\d+){1,3})') { [version]$Matches[1] } else { [version]'0.0' } }
    $msi = Get-ChildItem (Join-Path $InstallersDir 'microsoft-jdk-*-windows-x64.msi') -ErrorAction SilentlyContinue | Sort-Object $newest -Descending | Select-Object -First 1
    if (-not $msi) { Fail "JDK MSI not found in $InstallersDir (expected microsoft-jdk-*-windows-x64.msi)." }
    Write-Note "Running $($msi.Name) ..."
    Start-Process msiexec.exe -ArgumentList '/i', "`"$($msi.FullName)`"", '/quiet' -Wait
    if (-not (Test-Path (Join-Path $JdkHome 'bin\java.exe'))) {
        Fail "JDK not found at $JdkHome after install. Update `$JdkHome in stigman-config.ps1 to match the installed path."
    }
}

Write-Step "Setting JAVA_HOME (machine-wide)"
[Environment]::SetEnvironmentVariable('JAVA_HOME', $JdkHome, 'Machine')
$env:JAVA_HOME = $JdkHome
$env:PATH = "$JdkHome\bin;$env:PATH"
Write-Ok "JAVA_HOME = $JdkHome"

Write-Step "Verifying Java"
& (Join-Path $JdkHome 'bin\java.exe') -version
if ($LASTEXITCODE -ne 0) { Fail "java -version failed." }
Write-Step "Java ready."
