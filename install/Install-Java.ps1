# Installs Microsoft OpenJDK 17 and sets JAVA_HOME (Section 3).
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Java.ps1
#
# Uses the ZIP distribution, never the MSI: the MSI removes the previous JDK
# as part of installing the new one, which takes away the rollback the update
# procedure (guide Step 16.12) depends on.
. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

$javaExe = Join-Path $JdkHome 'bin\java.exe'

Write-Step "Installing Microsoft OpenJDK 17"
if (Test-Path $javaExe) {
    Write-Ok "JDK already present at $JdkHome"
} else {
    # If more than one version has been staged, take the newest: by name alone
    # 17.0.19 sorts before 17.0.20 and 17.0.21.0.2. Versions can have five parts,
    # which [version] cannot hold, so sort on the parts zero-padded to a fixed
    # width - a plain string sort of the padded parts orders like a version.
    $newest = {
        $m = [regex]::Match($_.Name, 'microsoft-jdk-(\d+(\.\d+){1,4})-windows-x64\.zip$')
        if ($m.Success) { ($m.Groups[1].Value -split '\.' | ForEach-Object { '{0:D8}' -f [int]$_ }) -join '.' } else { '' }
    }
    $zip = Get-ChildItem (Join-Path $InstallersDir 'microsoft-jdk-*-windows-x64.zip') -ErrorAction SilentlyContinue | Sort-Object $newest -Descending | Select-Object -First 1
    if (-not $zip) { Fail "JDK zip not found in $InstallersDir (expected microsoft-jdk-*-windows-x64.zip, from learn.microsoft.com/java/openjdk/download)." }
    Write-Note "Installing $($zip.Name) ..."

    # Verify against the publisher's checksum file when it was staged beside
    # the zip (published as <zip name>.sha256sum.txt on the same download page).
    $sum = Join-Path $InstallersDir "$($zip.Name).sha256sum.txt"
    if (Test-Path $sum) {
        $published = ((Get-Content $sum) -split '\s+')[0]
        $actual = (Get-FileHash $zip.FullName -Algorithm SHA256).Hash
        if ($published -ne $actual) { Fail "SHA-256 mismatch for $($zip.Name): published $published, got $actual." }
        Write-Ok "SHA-256 verified against $($zip.Name).sha256sum.txt"
    } else {
        Write-Warn2 "No $($zip.Name).sha256sum.txt staged; skipping hash verification."
    }

    # The zip extracts to jdk-<version>+<build>. Install beside any existing
    # JDKs and drop the '+build' suffix so $JdkHome contains no '+'.
    $dest = Split-Path $JdkHome -Parent
    $ver = (Split-Path $JdkHome -Leaf) -replace '^jdk-', ''
    Expand-Archive $zip.FullName -DestinationPath $dest
    Get-ChildItem $dest -Directory -Filter "jdk-$ver*" |
        Where-Object { $_.Name -ne "jdk-$ver" } |
        ForEach-Object { Rename-Item $_.FullName "jdk-$ver" }
    if (-not (Test-Path $javaExe)) {
        Fail "JDK not found at $JdkHome after install. Update `$JdkHome in stigman-config.ps1 to match the installed path."
    }
}

Write-Step "Removing compromised eMudhra root certificates (openjdk.org/emudhra)"
# The private keys of eight eMudhra intermediate CA certificates were
# compromised (OpenJDK advisories 2026-10-21 / 2026-10-24, CVE-2026-114820).
# Microsoft builds do not fix this yet, so the interim action from
# openjdk.org/emudhra applies: delete the affected roots by hand, with a
# backup kept beside the keystore. Microsoft's keytool names entries by their
# full DN, not by the short aliases used in the advisory, so find them by
# content and delete each one found.
$keystore = Join-Path $JdkHome 'lib\security\cacerts'
$keytool = Join-Path $JdkHome 'bin\keytool.exe'
if (-not (Test-Path $keystore)) { Fail "cacerts not found at $keystore." }
# Keep the first backup: on a re-run the keystore is already cleaned.
if (-not (Test-Path "$keystore.bak")) { Copy-Item $keystore "$keystore.bak" }
$findAffected = {
    @(& $keytool -list -cacerts -storepass changeit |
        Select-String emsign,emudhra,aaa_certificate_services |
        ForEach-Object { ($_.Line -replace ', [A-Z][a-z]{2} \d{1,2}, \d{4}, trustedCertEntry.*$', '').Trim() })
}
$affected = & $findAffected
if ($affected.Count -gt 0) {
    foreach ($alias in $affected) {
        $null = & $keytool -delete -cacerts -storepass changeit -alias $alias 2>&1
    }
    $left = & $findAffected
    if ($left.Count -gt 0) { Fail "Could not remove from ${keystore}: $($left -join '; ')" }
    $affected | ForEach-Object { Write-Ok "removed $_" }
} else {
    Write-Ok "none present in $JdkHome (this build already excludes them)"
}

Write-Step "Setting JAVA_HOME (machine-wide)"
[Environment]::SetEnvironmentVariable('JAVA_HOME', $JdkHome, 'Machine')
$env:JAVA_HOME = $JdkHome
$env:PATH = "$JdkHome\bin;$env:PATH"
Write-Ok "JAVA_HOME = $JdkHome"

Write-Step "Verifying Java"
& $javaExe -version
if ($LASTEXITCODE -ne 0) { Fail "java -version failed." }
Write-Step "Java ready."
