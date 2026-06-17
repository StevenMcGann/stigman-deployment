# Installs Microsoft OpenJDK 17 and sets JAVA_HOME (Section 3).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Java.ps1
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

Write-Step "Installing Microsoft OpenJDK 17"
if (Test-Path (Join-Path $JdkHome 'bin\java.exe')) {
    Write-Ok "JDK already present at $JdkHome"
} else {
    $msi = Get-ChildItem (Join-Path $InstallersDir 'microsoft-jdk-*-windows-x64.msi') -ErrorAction SilentlyContinue | Select-Object -First 1
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
