# Trusts Caddy's internal root CA on this machine.
#
# With the self-signed certificate from "tls internal", browsers refuse to
# register STIG Manager's ServiceWorker (SecurityError, code 18) and the app
# hangs at "Authorizing". Importing Caddy's root CA into the Trusted Root store
# makes the certificate valid and resolves it. Run from an elevated PowerShell.
#
# For network clients: this script also exports the root CA to
# C:\Services\caddy\caddy-root-ca.crt -- copy that file to each client and
# import it into their "Trusted Root Certification Authorities" (Local Machine),
# or install a CA-issued certificate instead (guide Section 12).

. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

Write-Step "Locating Caddy's internal root CA"
$candidates = @(
    "$env:SystemRoot\System32\config\systemprofile\AppData\Roaming\Caddy\pki\authorities\local\root.crt",
    "$env:SystemRoot\System32\config\systemprofile\AppData\Local\Caddy\pki\authorities\local\root.crt",
    "C:\ProgramData\Caddy\pki\authorities\local\root.crt",
    "$env:USERPROFILE\AppData\Roaming\Caddy\pki\authorities\local\root.crt"
)
$crt = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $crt) {
    $hit = Get-ChildItem "$env:SystemRoot\System32\config\systemprofile" -Recurse -Filter 'root.crt' -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match 'Caddy' } | Select-Object -First 1
    if ($hit) { $crt = $hit.FullName }
}
if (-not $crt) { Fail "Caddy root.crt not found. Start the Caddy service at least once so it generates its CA, then re-run." }
Write-Ok "Found: $crt"

$cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2 $crt
Write-Note "Subject: $($cert.Subject)"
Write-Note "Expires: $($cert.NotAfter)"

Write-Step "Importing into Trusted Root Certification Authorities (Local Machine)"
if (Test-Path "Cert:\LocalMachine\Root\$($cert.Thumbprint)") {
    Write-Ok "Already trusted."
} else {
    Import-Certificate -FilePath $crt -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Write-Ok "Imported (thumbprint $($cert.Thumbprint))."
}

Write-Step "Exporting a copy for network clients"
$export = 'C:\Services\caddy\caddy-root-ca.crt'
Copy-Item $crt $export -Force
Write-Ok "Copied to $export"

Write-Step "Done. Fully close and reopen the browser, then load the site again."
