# Customizes the STIG Manager Home page "Welcome" widget (title, message, link,
# and your logo) and, optionally, the classification banner.
#
# These are STIGMAN_CLIENT_WELCOME_* / STIGMAN_CLASSIFICATION environment
# variables that the API serves to the browser. Because the service loads its
# config from stig-manager-svc.xml, this script edits that file's <env> entries
# and restarts the service for you.
#
# Examples (elevated PowerShell, from the repo root):
#   .\install\Set-HomePage.ps1 -Title "ACME Cyber Operations" `
#       -Message "Authorized use only. POC: soc@acme.example | x1234." `
#       -Link "https://intranet.acme.example/cyber" `
#       -LogoFile "C:\branding\acme-logo.png"
#
#   .\install\Set-HomePage.ps1 -LogoUrl "https://intranet.acme.example/logo.png"
#
# -LogoFile copies the image into Caddy's branding folder and serves it at
#   https://<ServerIp>/branding/<file>. STIG Manager scales it to <=125 px.
# -LogoUrl  points the Welcome image at a URL you already host.
# Pass -Title "" (etc.) to clear a value back to its default.

param(
    [string]$Title,
    [string]$Message,
    [string]$Link,
    [string]$LogoFile,
    [string]$LogoUrl,
    [ValidateSet('NONE','U','CUI','C','S','TS','SCI')][string]$Classification
)

. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
Assert-Admin

$svcXml = Join-Path $ServicesDir 'stig-manager\stig-manager-svc.xml'
if (-not (Test-Path $svcXml)) { Fail "Service config not found: $svcXml" }
[xml]$xml = Get-Content $svcXml

function Set-SvcEnv([string]$name, [string]$value) {
    $node = @($xml.service.env) | Where-Object { $_.name -eq $name } | Select-Object -First 1
    if ($node) { $node.value = $value }
    else {
        $e = $xml.CreateElement('env')
        $e.SetAttribute('name', $name); $e.SetAttribute('value', $value)
        $firstDepend = $xml.service.SelectSingleNode('depend')
        if ($firstDepend) { [void]$xml.service.InsertBefore($e, $firstDepend) } else { [void]$xml.service.AppendChild($e) }
    }
    Write-Ok "$name = '$value'"
}

Write-Step "Updating Home page settings"
if ($PSBoundParameters.ContainsKey('Title'))   { Set-SvcEnv 'STIGMAN_CLIENT_WELCOME_TITLE'   $Title }
if ($PSBoundParameters.ContainsKey('Message')) { Set-SvcEnv 'STIGMAN_CLIENT_WELCOME_MESSAGE' $Message }
if ($PSBoundParameters.ContainsKey('Link'))    { Set-SvcEnv 'STIGMAN_CLIENT_WELCOME_LINK'    $Link }
if ($Classification)                           { Set-SvcEnv 'STIGMAN_CLASSIFICATION'         $Classification }

if ($LogoFile) {
    if (-not (Test-Path $LogoFile)) { Fail "LogoFile not found: $LogoFile" }
    $brand = Join-Path $ServicesDir 'caddy\branding'
    New-Item -ItemType Directory -Path $brand -Force | Out-Null
    $name = 'logo' + [System.IO.Path]::GetExtension($LogoFile).ToLower()
    Copy-Item $LogoFile (Join-Path $brand $name) -Force
    Write-Note "Logo copied to $brand\$name (served by Caddy at /branding/$name)"
    Set-SvcEnv 'STIGMAN_CLIENT_WELCOME_IMAGE' "https://$ServerIp/branding/$name"
} elseif ($LogoUrl) {
    Set-SvcEnv 'STIGMAN_CLIENT_WELCOME_IMAGE' $LogoUrl
}

$xml.Save($svcXml)

Write-Step "Restarting STIGManager to apply"
$watcher = Get-Service STIGManagerWatcher -ErrorAction SilentlyContinue
if ($watcher -and $watcher.Status -eq 'Running') { Stop-Service STIGManagerWatcher }
Restart-Service STIGManager
Start-Sleep -Seconds 6
if ($watcher) { Start-Service STIGManagerWatcher -ErrorAction SilentlyContinue }
Write-Ok "STIGManager is $((Get-Service STIGManager).Status)"

Write-Step "Done. Reload the STIG Manager Home tab in your browser (Ctrl+F5)."
Write-Note "The Welcome widget reads these at page load; a hard refresh picks them up."
