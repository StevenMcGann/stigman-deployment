# =====================================================================
#  STIG Manager deployment settings
#  ---------------------------------------------------------------
#  Edit the values below to match your environment, then run the
#  install scripts in this folder. Every script reads its settings
#  from this one file, so you only enter them once.
# =====================================================================

# Address browsers will use to reach the server: an IP or DNS name.
# Do NOT include https:// -- just the host.
#   Examples:  '192.168.1.100'   or   'stigman.yourdomain.mil'
$ServerIp = '192.168.3.157'

# ---- Passwords --------------------------------------------------
# These are the sample passwords from the guide. CHANGE them before
# production use (see Section 14 of the deployment guide).
$MySqlRootPassword     = 'STIGman_Root_2026!'
$StigmanDbPassword     = 'STIGman_DB_2026!'
$KeycloakDbPassword    = 'Keycloak_DB_2026!'
$KeycloakAdminUser     = 'admin'
$KeycloakAdminPassword = 'Admin_KC_2026!'

# ---- Paths ------------------------------------------------------
$InstallersDir = 'C:\Installers'   # where you copied the downloaded files (Section 1)
$ServicesDir   = 'C:\Services'     # install root for all components

# ---- Versions (match the files you downloaded in Section 1) -----
$KeycloakVersion = '26.7.3'
$StigmanVersion  = '1.6.16'

# ---- Tool locations (defaults match the guide) -----------------
$JdkHome  = 'C:\Program Files\Microsoft\jdk-17.0.20.101-hotspot'
$MySqlBin = 'C:\Program Files\MySQL\MySQL Server 8.4\bin'

# ---- Package paths (auto-derived; normally no need to edit) -----
$PackageRoot       = Split-Path $PSScriptRoot -Parent
$ServiceConfigsDir = Join-Path $PackageRoot 'deliverables\service-configs'
$RealmJsonSource   = Join-Path $PackageRoot 'deliverables\stigman-realm.json'
