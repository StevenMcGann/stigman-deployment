# Creates the stigman and keycloak databases and service accounts in MySQL.
#
# Replaces the copy-paste SQL in Section 2.3. Pasting that multi-line block into
# the console is unreliable on a stock Windows Server (Windows PowerShell 5.1 +
# PSReadLine 2.0 in conhost cannot paste multi-line text safely), which silently
# left the databases uncreated. Running this script avoids pasting entirely.
#
# Run from an elevated PowerShell:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\Create-Databases.ps1
#
# Safe to re-run: it uses IF NOT EXISTS and re-applies passwords/grants.

. "$PSScriptRoot\stigman-config.ps1"
. "$PSScriptRoot\stigman-lib.ps1"
# (No elevation needed: this only connects to MySQL over localhost.)

Write-Step "Creating MySQL databases and users"
Write-Note "Server: localhost   MySQL bin: $MySqlBin"

$sql = @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$MySqlRootPassword';

-- Binary logs are on by default with no expiration configured anywhere in
-- this install (no my.ini ships with it), so on a busy or crash-looping
-- instance they grow unbounded and can fill the drive (issue #10). This is a
-- single standalone node with no replicas, so a short retention is safe;
-- SET PERSIST writes it to mysqld-auto.cnf so it survives service restarts.
SET PERSIST binlog_expire_logs_seconds = 604800;

CREATE DATABASE IF NOT EXISTS stigman CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'stigman'@'localhost' IDENTIFIED BY '$StigmanDbPassword';
ALTER USER 'stigman'@'localhost' IDENTIFIED BY '$StigmanDbPassword';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES, CREATE VIEW, LOCK TABLES, CREATE ROUTINE, ALTER ROUTINE, EXECUTE, EVENT, CREATE TEMPORARY TABLES ON stigman.* TO 'stigman'@'localhost';
GRANT SELECT ON performance_schema.* TO 'stigman'@'localhost';

CREATE DATABASE IF NOT EXISTS keycloak CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'keycloak'@'localhost' IDENTIFIED BY '$KeycloakDbPassword';
ALTER USER 'keycloak'@'localhost' IDENTIFIED BY '$KeycloakDbPassword';
GRANT ALL PRIVILEGES ON keycloak.* TO 'keycloak'@'localhost';

FLUSH PRIVILEGES;
"@

$code = Invoke-MySqlAsRoot -Sql $sql -MySqlBin $MySqlBin -RootPw $MySqlRootPassword
if ($code -ne 0) { Fail "MySQL returned exit code $code. Review the messages above." }

# ---- Verify ----
$rows = Get-MySqlRows -MySqlBin $MySqlBin -RootPw $MySqlRootPassword -Sql @"
SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('stigman','keycloak');
SELECT User FROM mysql.user WHERE User IN ('stigman','keycloak');
"@
foreach ($name in 'stigman','keycloak') {
    if ($rows -contains $name) { Write-Ok "database and user '$name' present" }
    else { Fail "expected '$name' was not found after creation" }
}

Write-Step "Databases ready."
Write-Note "Record the passwords you chose; they are needed in stig-manager-svc.xml and keycloak.conf."
