# Imports the STIG Manager Keycloak realm (stigman-realm.json).
#
# Replaces the copy-paste token/import block in Section 4.4. That block pastes
# poorly into the console and required manually timing Keycloak's startup in a
# second window. This script waits for Keycloak to be ready, imports the realm
# if it is not already present, and verifies the result.
#
# Keycloak must be running and reachable on http://localhost:8080 first
# (either the temporary `kc.bat start-dev`, or the installed Keycloak service).
#
# Run from an elevated PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Import-Realm.ps1

param(
    [string]$RealmJsonPath,
    [int]$TimeoutSeconds = 120
)

. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"

$kcBase = 'http://localhost:8080'
if (-not $RealmJsonPath) { $RealmJsonPath = Join-Path $InstallersDir 'stigman-realm.json' }

if (-not (Test-Path $RealmJsonPath)) { Fail "Realm file not found: $RealmJsonPath" }

# ---- Wait for Keycloak + get an admin token ----
Write-Step "Waiting for Keycloak on $kcBase"
$tokenBody = @{
    grant_type = 'password'; client_id = 'admin-cli'
    username   = $KeycloakAdminUser; password = $KeycloakAdminPassword
}
$token = $null
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while (-not $token -and (Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-RestMethod -Uri "$kcBase/realms/master/protocol/openid-connect/token" `
            -Method Post -Body $tokenBody -ContentType 'application/x-www-form-urlencoded' -ErrorAction Stop
        $token = $resp.access_token
    } catch {
        Start-Sleep -Seconds 3
    }
}
if (-not $token) { Fail "Keycloak did not respond within $TimeoutSeconds s, or the admin credentials in stigman-config.ps1 are wrong." }
Write-Ok "Admin token acquired."
$headers = @{ Authorization = "Bearer $token" }

# ---- Skip if the realm already exists ----
try {
    $existing = Invoke-RestMethod -Uri "$kcBase/admin/realms/stigman" -Headers $headers -ErrorAction Stop
    Write-Warn2 "Realm 'stigman' already exists (enabled=$($existing.enabled)). Nothing to import."
    Write-Step "Done."
    return
} catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__ -ne 404) {
        Fail "Unexpected error checking for existing realm: $($_.Exception.Message)"
    }
}

# ---- Import ----
Write-Step "Importing realm from $RealmJsonPath"
$realmJson = Get-Content $RealmJsonPath -Raw
# Resolve the browser address before importing a new realm.
# BEGIN STIGMAN ADDRESS VALIDATION
$address = ([string]$ServerIp).Trim()
if ([string]::IsNullOrWhiteSpace($address)) { Fail 'ServerIp is empty. Set the browser host name or IP address in stigman-config.ps1.' }
$addressUri = $null
if ($address -match '[/\\\s"<>]' -or -not [uri]::TryCreate(('https://' + $address), [UriKind]::Absolute, [ref]$addressUri) -or $addressUri.UserInfo -or $addressUri.AbsolutePath -ne '/' -or $addressUri.Query -or $addressUri.Fragment) {
    Fail 'ServerIp must be a host name or IP address, optionally with a port, without a scheme or path.'
}
$realmJson = $realmJson.Replace('__STIGMAN_ADDRESS__', $address)
if ($realmJson.Contains('__STIGMAN_ADDRESS__')) { Fail 'The realm address placeholder was not resolved.' }
try { $null = $realmJson | ConvertFrom-Json -ErrorAction Stop }
catch { Fail 'The resolved realm file is not valid JSON.' }
# END STIGMAN ADDRESS VALIDATION
try {
    Invoke-RestMethod -Uri "$kcBase/admin/realms" -Method Post -Headers $headers `
        -Body $realmJson -ContentType 'application/json' -ErrorAction Stop | Out-Null
} catch {
    Fail "Realm import failed: $($_.Exception.Message)"
}

# ---- Verify ----
$check = Invoke-RestMethod -Uri "$kcBase/admin/realms/stigman" -Headers $headers
if ($check.realm -eq 'stigman' -and $check.enabled) { Write-Ok "Realm 'stigman' imported and enabled." }
else { Fail "Realm import did not verify." }

Write-Step "Done."
