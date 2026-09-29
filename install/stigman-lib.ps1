# Shared helpers for the STIG Manager install scripts.
# Dot-sourced by each script after stigman-config.ps1.

function Write-Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok($m)   { Write-Host "    [OK] $m" -ForegroundColor Green }
function Write-Note($m) { Write-Host "    $m" -ForegroundColor Gray }
function Write-Warn2($m){ Write-Host "    [!] $m"  -ForegroundColor Yellow }
function Fail($m)       { Write-Host "    [X] $m"  -ForegroundColor Red; exit 1 }

# Abort unless the current session is elevated.
function Assert-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $pr = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $pr.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
        Fail "This script must be run from an elevated (Administrator) PowerShell."
    }
}

# Resolve the Keycloak install folder. Prefers the configured version; otherwise
# returns the highest-numbered keycloak-* folder under $ServicesDir. This keeps
# the scripts working after a Keycloak version bump (issue: hardcoded 26.6.2).
function Resolve-KeycloakDir {
    param([Parameter(Mandatory)][string]$ServicesDir, [string]$Version)
    if ($Version) {
        $p = Join-Path $ServicesDir "keycloak-$Version"
        if (Test-Path $p) { return $p }
    }
    $dirs = Get-ChildItem -Path $ServicesDir -Directory -Filter 'keycloak-*' -ErrorAction SilentlyContinue
    if (-not $dirs) { Fail "No keycloak-* folder found under $ServicesDir." }
    $sorted = $dirs | Sort-Object {
        try { [version]($_.Name -replace '^keycloak-','') } catch { [version]'0.0.0' }
    } -Descending
    return $sorted[0].FullName
}

# Run a SQL string against MySQL as root. On a fresh install root has no
# password, so we probe first; if that fails we authenticate with $RootPw.
# Returns the mysql.exe exit code.
function Invoke-MySqlAsRoot {
    param(
        [Parameter(Mandatory)][string]$Sql,
        [Parameter(Mandatory)][string]$MySqlBin,
        [string]$RootPw
    )
    $mysql = Join-Path $MySqlBin 'mysql.exe'
    if (-not (Test-Path $mysql)) { Fail "mysql.exe not found at $mysql" }

    Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    "SELECT 1;" | & $mysql -u root 2>$null | Out-Null
    $rootHasNoPassword = ($LASTEXITCODE -eq 0)

    if (-not $rootHasNoPassword) {
        if (-not $RootPw) { Fail "Cannot connect to MySQL as root without a password and none was provided in stigman-config.ps1." }
        $env:MYSQL_PWD = $RootPw
    }
    try {
        $Sql | & $mysql -u root
        return $LASTEXITCODE
    } finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
}

# ---- Config-file builders -------------------------------------------------
# These generate the service config files with your settings substituted in,
# so the scripted install never depends on pasting file contents by hand.

function New-KeycloakConf {
    param([Parameter(Mandatory)][string]$KeycloakDbPassword, [Parameter(Mandatory)][string]$ServerIp)
    @"
# Keycloak Configuration for STIG Manager Deployment

# Database
db=mysql
db-url-host=localhost
db-url-database=keycloak
db-username=keycloak
db-password=$KeycloakDbPassword

# Hostname (v2 format) - frontend URL as seen by browsers through Caddy
hostname=https://$ServerIp
hostname-backchannel-dynamic=true

# HTTP (Caddy terminates TLS)
http-enabled=true
http-port=8080
proxy-headers=xforwarded
"@
}

function New-Caddyfile {
    param([Parameter(Mandatory)][string]$ServerIp)
    # Note the /admin/* route: without it the Keycloak admin console URL
    # (https://host/admin) falls through to STIG Manager and returns
    # "Cannot GET /admin".
    @"
$ServerIp, localhost {
	tls internal

	# HSTS: instruct browsers to only connect over HTTPS (Nessus: "HSTS Missing
	# From HTTPS Server"). Browsers apply this per hostname (ignored for raw IP
	# access) and it hard-blocks certificate errors, so clients must trust the
	# serving CA (see Trust-CaddyCert.ps1 / your CA-issued certificate).
	# The "?" sets the header only when the upstream didn't already send one
	# (Keycloak sends its own HSTS header; without "?" those responses carry it twice).
	header ?Strict-Transport-Security "max-age=31536000; includeSubDomains"

	# Keycloak paths (OIDC, login page resources, and admin console)
	handle /realms/* {
		reverse_proxy localhost:8080
	}
	handle /resources/* {
		reverse_proxy localhost:8080
	}
	handle /admin/* {
		reverse_proxy localhost:8080
	}

	# API routes: disable caching (prevents 304 issues with ExtJS)
	handle /api/* {
		header Cache-Control "no-store"
		reverse_proxy localhost:54000 {
			flush_interval -1
		}
	}

	# Branding assets for the Home page (drop your logo in C:\Services\caddy\branding)
	handle_path /branding/* {
		root * C:\Services\caddy\branding
		file_server
	}

	# Static assets and web UI
	handle {
		reverse_proxy localhost:54000
	}
}
"@
}

function New-StigmanSvcXml {
    param([Parameter(Mandatory)][string]$StigmanDbPassword, [Parameter(Mandatory)][string]$ServerIp)
    @"
<service>
  <id>STIGManager</id>
  <name>STIG Manager</name>
  <description>STIG Manager OSS - DISA STIG assessment management</description>
  <executable>%BASE%\stig-manager-win.exe</executable>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>3</keepFiles>
  </log>
  <env name="STIGMAN_DB_HOST" value="localhost" />
  <env name="STIGMAN_DB_PORT" value="3306" />
  <env name="STIGMAN_DB_USER" value="stigman" />
  <env name="STIGMAN_DB_PASSWORD" value="$StigmanDbPassword" />
  <env name="STIGMAN_DB_SCHEMA" value="stigman" />
  <env name="STIGMAN_API_ADDRESS" value="0.0.0.0" />
  <env name="STIGMAN_CLASSIFICATION" value="U" />
  <env name="STIGMAN_OIDC_PROVIDER" value="http://localhost:8080/realms/stigman" />
  <env name="STIGMAN_CLIENT_OIDC_PROVIDER" value="https://$ServerIp/realms/stigman" />
  <env name="TEMP" value="$(Join-Path $ServicesDir 'stig-manager\temp')" />
  <env name="TMP" value="$(Join-Path $ServicesDir 'stig-manager\temp')" />
  <depend>MySQL84</depend>
  <depend>Keycloak</depend>
</service>
"@
}

# Write text to a file as UTF-8 without a BOM (config parsers dislike the BOM).
function Set-TextFile {
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Content)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

# GET a JSON-array API endpoint and return it as a proper PowerShell array.
# Works around a Windows PowerShell 5.1 quirk where Invoke-RestMethod can
# collapse an array of like-shaped objects into one object with array-valued
# properties. Parsing the raw body with ConvertFrom-Json avoids that.
function Get-ApiArray {
    param([Parameter(Mandatory)][string]$Uri, [Parameter(Mandatory)][hashtable]$Headers)
    $raw = (Invoke-WebRequest -Uri $Uri -Headers $Headers -UseBasicParsing).Content
    if (-not $raw) { return @() }
    return @(ConvertFrom-Json $raw)
}

# Query helper: returns mysql output lines (batch mode, no headers).
function Get-MySqlRows {
    param(
        [Parameter(Mandatory)][string]$Sql,
        [Parameter(Mandatory)][string]$MySqlBin,
        [string]$RootPw
    )
    $mysql = Join-Path $MySqlBin 'mysql.exe'
    if ($RootPw) { $env:MYSQL_PWD = $RootPw }
    try {
        $out = $Sql | & $mysql -u root --batch --skip-column-names 2>$null
    } finally {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    }
    return @($out)
}
