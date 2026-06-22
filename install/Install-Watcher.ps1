# Installs and fully configures the STIG Manager Watcher (Section 10) with no
# manual console clicking and no copy-pasting. It:
#   - extracts the Watcher
#   - assigns the watcher service-account roles in Keycloak (the realm import
#     does NOT assign them)
#   - regenerates the client secret and captures it
#   - registers the service account in STIG Manager
#   - creates the target collection (if needed) and grants the watcher access
#   - writes the .env, then registers and starts the Windows service
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Watcher.ps1
#   powershell ... -File .\Install-Watcher.ps1 -CollectionName "My Collection"
#
# Safe to re-run: roles, secret, collection, and grant are reconciled each time.

param(
    [string]$CollectionName = 'Watcher Imports',
    [int]$RoleId = 4,                         # 1=Restricted 2=Full 3=Manage 4=Owner
    [switch]$CreateCollection,                # auto-create the collection if it does not exist
    [string]$WatchPath,                       # folder the Watcher monitors (default C:\Services\stigman-watcher\watched)
    [string]$AdminUser,                       # overrides $KeycloakAdminUser from stigman-config.ps1
    [string]$AdminPassword                    # overrides $KeycloakAdminPassword from stigman-config.ps1
)

. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin
# Parameter overrides win over the values dot-sourced from the config file, so a
# changed/hardened Keycloak admin password can be supplied without editing config.
if ($AdminUser)     { $KeycloakAdminUser = $AdminUser }
if ($AdminPassword) { $KeycloakAdminPassword = $AdminPassword }

$kc  = 'http://localhost:8080'
$api = 'http://localhost:54000/api'
$watchDir = Join-Path $ServicesDir 'stigman-watcher'
if (-not $WatchPath) { $WatchPath = Join-Path $watchDir 'watched' }

# ---- 1. Extract the Watcher ----
Write-Step "Extracting the STIG Manager Watcher"
if (Test-Path (Join-Path $watchDir 'stigman-watcher-win.exe')) {
    Write-Ok "Watcher already extracted at $watchDir"
} else {
    New-Item -ItemType Directory -Path $watchDir -Force | Out-Null
    $zip = Get-ChildItem (Join-Path $InstallersDir 'stigman-watcher-win-*.zip') -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $zip) { Fail "Watcher zip not found in $InstallersDir (expected stigman-watcher-win-*.zip)." }
    Expand-Archive -Path $zip.FullName -DestinationPath $watchDir -Force
    if (-not (Test-Path (Join-Path $watchDir 'stigman-watcher-win.exe'))) {
        $n = Get-ChildItem $watchDir -Recurse -Filter 'stigman-watcher-win.exe' | Select-Object -First 1
        if ($n) { Move-Item $n.FullName (Join-Path $watchDir 'stigman-watcher-win.exe') -Force }
    }
    if (-not (Test-Path (Join-Path $watchDir 'stigman-watcher-win.exe'))) { Fail "stigman-watcher-win.exe not found after extract." }
}
New-Item -ItemType Directory -Path $WatchPath -Force | Out-Null
Write-Ok "Watched folder: $WatchPath"

# ---- 2. Keycloak: assign service-account roles + regenerate secret ----
Write-Step "Configuring the Keycloak watcher client"
Write-Note "Signing in to Keycloak as '$KeycloakAdminUser'"
$admTok = $null
try {
    $admTok = (Invoke-RestMethod -Uri "$kc/realms/master/protocol/openid-connect/token" -Method Post -ContentType 'application/x-www-form-urlencoded' `
        -Body @{ grant_type='password'; client_id='admin-cli'; username=$KeycloakAdminUser; password=$KeycloakAdminPassword }).access_token
} catch {
    Fail ("Keycloak admin login failed as '$KeycloakAdminUser' ($($_.Exception.Message)). " +
          "These must match your Keycloak admin account. If you changed the admin password, either update " +
          "`$KeycloakAdminUser / `$KeycloakAdminPassword in install\stigman-config.ps1, or re-run with " +
          "-AdminUser <name> -AdminPassword <password>.")
}
if (-not $admTok) { Fail "Keycloak returned no admin token. Check the admin credentials in stigman-config.ps1." }
$h = @{ Authorization = "Bearer $admTok" }
$client = Invoke-RestMethod -Uri "$kc/admin/realms/stigman/clients?clientId=stigman-watcher" -Headers $h
if (-not $client) { Fail "stigman-watcher client not found. Import the realm first (Section 4.4 / Import-Realm.ps1)." }
$sa = Invoke-RestMethod -Uri "$kc/admin/realms/stigman/clients/$($client.id)/service-account-user" -Headers $h
$reps = @(); foreach ($r in 'admin','user','create_collection') {
    $reps += Invoke-RestMethod -Uri "$kc/admin/realms/stigman/roles/$r" -Headers $h
}
Invoke-RestMethod -Uri "$kc/admin/realms/stigman/users/$($sa.id)/role-mappings/realm" -Method Post -Headers $h `
    -Body ($reps | ConvertTo-Json) -ContentType 'application/json' | Out-Null
Write-Ok "Service-account roles assigned: admin, user, create_collection"
$secret = (Invoke-RestMethod -Uri "$kc/admin/realms/stigman/clients/$($client.id)/client-secret" -Method Post -Headers $h).value
Write-Ok "Client secret regenerated."

# ---- 3. Register the service account in STIG Manager ----
Write-Step "Registering the watcher service account in STIG Manager"
$wtok = (Invoke-RestMethod -Uri "$kc/realms/stigman/protocol/openid-connect/token" -Method Post -ContentType 'application/x-www-form-urlencoded' `
    -Body @{ grant_type='client_credentials'; client_id='stigman-watcher'; client_secret=$secret }).access_token
$wh = @{ Authorization = "Bearer $wtok" }
$me = Invoke-RestMethod -Uri "$api/user" -Headers $wh
Write-Ok "Watcher userId: $($me.userId)"

# ---- 4. Locate the collection and grant the watcher access ----
# By default the collection must already exist (create it in the STIG Manager UI
# so YOUR account owns it and you can see the imports). -CreateCollection will
# auto-create one, but then only the watcher can see it until an admin grants
# their own account.
Write-Step "Locating collection '$CollectionName'"
$col = Invoke-RestMethod -Uri "$api/collections?elevate=true" -Headers $wh | Where-Object { $_.name -eq $CollectionName } | Select-Object -First 1
if (-not $col) {
    if (-not $CreateCollection) {
        Fail "Collection '$CollectionName' not found. Create it in the STIG Manager UI first (you will be its owner so you can view the imports), then re-run. To auto-create it instead, add -CreateCollection."
    }
    $body = @{ name=$CollectionName; description='STIG Manager Watcher target'; grants=@(@{ userId="$($me.userId)"; roleId=$RoleId }) } | ConvertTo-Json -Depth 6
    $col = Invoke-RestMethod -Uri "$api/collections?elevate=true" -Method Post -Headers $wh -Body $body -ContentType 'application/json'
    Write-Ok "Created collection (collectionId $($col.collectionId))"
    Write-Warn2 "The collection is owned by the watcher service account only. To view it in the STIG Manager UI, open it as an admin and grant your own account access."
} else {
    Write-Ok "Found collection (collectionId $($col.collectionId)); granting the watcher"
    $grant = '[{"userId":"' + $me.userId + '","roleId":' + $RoleId + '}]'
    try { Invoke-RestMethod -Uri "$api/collections/$($col.collectionId)/grants?elevate=true" -Method Post -Headers $wh -Body $grant -ContentType 'application/json' | Out-Null } catch { }
}
$collectionId = $col.collectionId

# ---- 5. Write the .env ----
Write-Step "Writing .env"
$envText = @"
WATCHER_ADD_EXISTING=true
WATCHER_API_BASE=$api
WATCHER_AUTHORITY=$kc/realms/stigman
WATCHER_CARGO_DELAY=2000
WATCHER_CARGO_SIZE=25
WATCHER_CLIENT_ID=stigman-watcher
WATCHER_CLIENT_SECRET=$secret
WATCHER_COLLECTION=$collectionId
WATCHER_MODE=scan
WATCHER_PATH=$WatchPath
"@
Set-TextFile -Path (Join-Path $watchDir '.env') -Content $envText
Write-Ok ".env written (collection $collectionId)"

# ---- 6. Register + start the Windows service ----
Write-Step "Registering the Watcher service"
$svcExe = Join-Path $watchDir 'stigman-watcher-svc.exe'
# Don't recopy the WinSW wrapper if it's already there - on a re-run the running
# service has it locked, and it's the same binary anyway.
if (-not (Test-Path $svcExe)) { Copy-Item (Join-Path $InstallersDir 'WinSW-x64.exe') $svcExe -Force }
$svcXmlSrc = Join-Path $ServiceConfigsDir 'stigman-watcher-svc.xml'
if (Test-Path $svcXmlSrc) { Copy-Item $svcXmlSrc (Join-Path $watchDir 'stigman-watcher-svc.xml') -Force }
else { Fail "stigman-watcher-svc.xml not found at $svcXmlSrc" }
if (-not (Get-Service STIGManagerWatcher -ErrorAction SilentlyContinue)) {
    & (Join-Path $watchDir 'stigman-watcher-svc.exe') install | Out-Null
    & sc.exe config STIGManagerWatcher depend= MySQL84/Keycloak/STIGManager | Out-Null
}
Restart-Service STIGManagerWatcher -ErrorAction SilentlyContinue
Start-Service STIGManagerWatcher -ErrorAction SilentlyContinue
Write-Ok "STIGManagerWatcher is $((Get-Service STIGManagerWatcher).Status)"

Write-Step "Watcher ready."
Write-Host @"

    Drop .ckl, .cklb, or XCCDF-Results .xml files into:
        $WatchPath
    They import automatically into collection '$CollectionName' (id $collectionId).
"@ -ForegroundColor Cyan
