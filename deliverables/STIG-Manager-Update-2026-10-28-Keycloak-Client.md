# Update: restrict the STIG Manager Keycloak web client

Tested on the test server on 2026-10-28, including a complete rollback and reapplication.

## Summary

Apply this configuration change after confirming the addresses and scripts
that use the `stig-manager` client. It restricts sign-in redirects and browser
origins, disables direct password grants, and requires S256 Proof Key for Code
Exchange (PKCE). No service stop or restart is required; an omitted callback
address or an unidentified password-grant dependency can still interrupt access.

This finding comes from a configuration review. No specific vendor advisory or
Common Vulnerabilities and Exposures (CVE) identifier has been identified for
this configuration finding. Account takeover was not demonstrated.

## What changes

| Setting on the stig-manager client | Previous test-server value | Required value |
|---|---|---|
| Valid redirect URIs | A bare `*` | The approved HTTPS callback addresses; use `https://<server-address>/*` where required entry paths need a wildcard |
| Web origins | A bare `*` | `+`, which derives permitted origins from the redirect list |
| Direct access grants | Enabled | Disabled after confirming that no required script uses the password grant |
| Require PKCE and PKCE Method | PKCE optional | Require PKCE with method `S256` |
| Valid post logout redirect URIs | `+` | Preserved as `+`; narrow a bare `*` to `+` if one is present at the site |

A wildcard redirect lets an attacker who can reach Keycloak construct a login
request that returns its code to an outside site. A public client has no
client secret, so an attacker-controlled request without PKCE, or with a
verifier the attacker knows, can expose account access. Intercepting a code
from a legitimate S256 request still requires that request's verifier.
Requiring PKCE does not replace restricting the redirect list.

The password grant lets programs exchange a user's credentials without the
interactive sign-in page. Disabling it removes an unused sign-in path for this
web client. Restricting web origins prevents arbitrary sites from reading this
client's token-endpoint responses when they can complete a grant; permissive
CORS alone does not authenticate an attacker.

The separate `stigman-watcher` service account continues to use client
credentials. No other client or realm session/brute-force policy was changed.
[Keycloak's OIDC recommendations](https://www.keycloak.org/securing-apps/oidc-layers)
call for specific public-client redirects and prohibit the password grant
under current OAuth security best practice. [STIG Manager's authentication
guidance](https://stig-manager.readthedocs.io/en/latest/installation-and-setup/authentication.html)
recommends authorization code flow with PKCE for the web application.

## Test results

| Risk | Result on the test server |
|---|---|
| Allowed browser sign-in stops working | Passed with a fresh isolated browser context, S256 authorization code flow, the expected signed-in identity, and a protected API response of 200. |
| Outside redirects remain permitted | Changed from HTTP 200 with a login form to HTTP 400 for invalid `redirect_uri`. |
| PKCE can be omitted or weakened | Requests without PKCE or using `plain` changed from accepted to HTTP 302 error redirects identifying invalid or missing PKCE parameters. Missing-challenge requests were rejected in both states. |
| Direct password grants remain enabled | The independent no-Origin probe changed from HTTP 400 `invalid_grant` to HTTP 400 `unauthorized_client`. |
| Arbitrary browser origins remain permitted | The outside-origin probe changed from HTTP 400 `invalid_grant` with an echoed allow-origin header to HTTP 403 `Invalid origin` with no allow-origin header. |
| Approved origins lose token-endpoint access | The approved-origin probe retained its allow-origin header; the expected grant error changed to `unauthorized_client`. |
| Sign-out stops working | Passed using the application's logout control, Keycloak's normal logout confirmation, observed logout completion and a fresh prompt on revisit. |
| The Watcher loses access | A service-account token and protected API request passed; a newly completed authenticated Watcher cache-refresh cycle returned 200 for collection and user requests. No scan was injected or reimported. |
| Rollback does not restore optional PKCE | Passed after explicitly removing the added attribute with JSON null. Read-back restored its absence, all nine baseline probe results matched, and full browser, health, service-account and newly authenticated Watcher checks passed. |
| The complete configuration cannot be reapplied | Passed: all intended settings were read back, all nine hardened probe results matched, and full browser, health, service-account and a new authenticated Watcher cycle passed again. |
| Other configuration changes unintentionally | Other-client fingerprints, realm session/brute-force policy and unrelated web-client fields matched the original snapshots. All five services retained their original process IDs; no stop or restart was performed. |
| New installations retain unsafe defaults | The realm template now uses an address placeholder, `+`, disabled password grants and required S256. Eight offline address cases passed, and the existing-realm import path safely skipped the live realm. A fresh installation was not performed. |

## Before you start

- Sign in with a Keycloak administrator who can configure clients in the
  `stigman` realm. Use the site's actual administrative credentials; do not
  put them in commands, transcripts or reports.
- List every HTTPS address users enter, including any port and required
  callback paths. Prefer exact callback URIs when those paths are known. If
  users enter several paths and require a path wildcard, keep the scheme and
  host exact. Do not use a bare `*`.
- Inventory applications and scripts that use the `stig-manager` client. If
  a required script uses a username and password directly, retain direct
  access grants temporarily, record the exception, and migrate the script
  before completing that part of the hardening. The Watcher's own
  `stigman-watcher` client is not such a dependency.
- Record the original redirect URIs, web origins, direct-access-grant flag,
  Require PKCE state, PKCE Method and post-logout redirect URIs. Record whether
  the PKCE attribute was absent, rather than only writing down a blank value.
- Use a window that avoids automated maintenance or another administrator
  editing the client. Keep a separate administrative session available for
  immediate rollback if browser access fails.
- Confirm that MySQL84, Keycloak, STIGManager, Caddy and STIGManagerWatcher
  are running, where installed. Confirm that the application's configuration
  endpoint answers HTTP 200:

  ```powershell
  Get-Service MySQL84, Keycloak, STIGManager, Caddy, STIGManagerWatcher | Format-Table Name, Status
  curl.exe -s -o NUL -w "%{http_code}" https://<server-address>/api/op/configuration
  ```

  The test server used `-k` for curl against its local certificate authority.
  Production should trust the configured certificate and use the commands
  without that switch. Do not continue if the initial health check fails.

## Procedure

### 1. Open the correct client

Open `https://<server-address>/admin/`, sign in and select the `stigman` realm.
Open **Clients**, then **stig-manager**, then **Settings**.

Expected result: the client details identify `stig-manager`. Do not edit the
master realm or the `stigman-watcher` client.

### 2. Restrict redirects and browser origins

In **Valid redirect URIs**, remove the bare `*`. Add each approved HTTPS
callback, using an exact path where practical or
`https://<server-address>/*` for required paths. In **Web origins**, remove the
bare `*` and enter `+`.

Expected result: the redirect list contains only the site's approved HTTPS
callbacks, and Web origins contains `+`.

### 3. Disable unused password grants and require S256

On the same **Settings** tab, clear **Direct access grants** if the dependency
check permits it. Turn **Require PKCE** on and set **PKCE Method** to **S256**.
These labels were checked in the Keycloak 26.8.1 console; they are on Settings,
not Advanced.

Expected result: password grants are disabled unless a documented exception
is required, PKCE is required, and its method is S256.

### 4. Preserve or narrow the post-logout list and save

In **Valid post logout redirect URIs**, preserve an existing `+`. Replace a
bare `*` with `+` if present. Preserve another explicit list unless verified
sign-out requires a documented adjustment. Save the client and reopen its
Settings page to confirm every value.

Expected result: the settings are retained after reload. No service restart
is required. If legitimate browser access fails, restore the recorded values
immediately using the rollback section.

## Verify the update

Replace `<server-address>` below with an approved host name or IP address,
including a port if required. These probes use a fictitious user and a public
PKCE test challenge; do not submit real credentials or exchange a code through
them. Run the block once for each approved callback/origin. It retains raw
responses in memory and prints only selected results.

```powershell
$base = 'https://<server-address>/realms/stigman/protocol/openid-connect'
$ownOrigin = 'https://<server-address>'
$ownRedirects = @('https://<server-address>/') # add every confirmed callback

function Invoke-KcProbe([string[]]$ProbeArguments) {
    # Keep the combined response in memory. Never emit or save the raw reply.
    $raw = (& curl.exe -sS --noproxy '*' -m 20 -D - `
        -w "`nPROBE_HTTP:%{http_code}" @ProbeArguments) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'Probe transport failed; stop and investigate.' }
    $status = [regex]::Match($raw, '(?m)^PROBE_HTTP:(\d{3})\s*$')
    if (-not $status.Success) { throw 'Probe has no HTTP status; stop.' }
    if ($raw -match '"(?:access_token|refresh_token|id_token)"\s*:') {
        throw 'Unexpected token response; stop without saving the response.'
    }
    $decoded = [uri]::UnescapeDataString($raw.Replace('+', ' '))
    [pscustomobject]@{
        Status = [int]$status.Groups[1].Value
        LoginForm = $raw -match 'kc-form-login'
        RedirectRefused = $decoded -match 'Invalid parameter:\s*redirect_uri'
        PkceRefused = $decoded -match '(Missing|Invalid) parameter:\s*code[_ ]challenge'
        ErrorCode = [regex]::Match($raw, '"error"\s*:\s*"([^"]+)"').Groups[1].Value
        AllowOrigin = [regex]::Match($raw, '(?im)^Access-Control-Allow-Origin:\s*([^\r\n]+)').Groups[1].Value.Trim()
    }
}

function Test-Redirect(
    [string]$Client,
    [string]$Redirect,
    [ValidateSet('S256', 'None', 'Plain', 'MissingChallenge')]
    [string]$Pkce = 'S256'
) {
    $u = "$base/auth?client_id=$Client&response_type=code&scope=openid&redirect_uri=" + [uri]::EscapeDataString($Redirect)
    if ($Pkce -ne 'None') {
        $method = if ($Pkce -eq 'Plain') { 'plain' } else { 'S256' }
        $u += '&code_challenge_method=' + $method
        if ($Pkce -ne 'MissingChallenge') {
            $u += '&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
        }
    }
    $r = Invoke-KcProbe -ProbeArguments @($u)
    $what = if ($r.LoginForm -and $r.Status -eq 200) { 'ACCEPTED (sign-in form)' }
            elseif ($r.RedirectRefused) { 'REFUSED (redirect_uri)' }
            elseif ($r.PkceRefused) { 'REFUSED (PKCE)' }
            else { 'OTHER' }
    '{0} client={1} redirect={2} PKCE={3} -> {4}' -f $r.Status, $Client, $Redirect, $Pkce, $what
}

function Test-Token([string]$Origin = '') {
    $probeArguments = @(
        '-d', 'grant_type=password', '-d', 'client_id=stig-manager',
        '-d', 'username=no-such-user-probe', '-d', 'password=x'
    )
    if ($Origin) { $probeArguments += @('-H', "Origin: $Origin") }
    $probeArguments += "$base/token"
    $r = Invoke-KcProbe -ProbeArguments $probeArguments
    $label = if ($Origin) { $Origin } else { '(no Origin header)' }
    $allow = if ($r.AllowOrigin) { $r.AllowOrigin } else { '(none)' }
    '{0} origin={1} error={2} allow-origin={3}' -f $r.Status, $label, $r.ErrorCode, $allow
}

Test-Redirect 'stig-manager' 'https://example.invalid/' 'S256'
foreach ($redirect in $ownRedirects) { Test-Redirect 'stig-manager' $redirect 'S256' }
Test-Redirect 'account-console' 'https://example.invalid/' 'S256'
Test-Redirect 'stig-manager' $ownRedirects[0] 'None'
Test-Redirect 'stig-manager' $ownRedirects[0] 'Plain'
Test-Redirect 'stig-manager' $ownRedirects[0] 'MissingChallenge'
Test-Token
Test-Token 'https://example.invalid'
Test-Token $ownOrigin
# Repeat the own-origin token probe for every additional approved origin.
```

Expected results after the complete change, in the order printed:

1. The outside redirect is refused with HTTP 400 for `redirect_uri`.
2. Each approved callback with S256 reaches the login form with HTTP 200.
3. The account-console outside-redirect control remains refused.
4. Missing PKCE is refused; the test returned a 302 error redirect.
5. `plain` PKCE is refused; the test returned a 302 error redirect.
6. A missing challenge is refused; the test returned a 302 error redirect.
7. The no-Origin token probe returns 400 `unauthorized_client` and no
   allow-origin header. This proves that the grant is disabled independently
   of CORS.
8. The outside-origin token probe returns 403 `Invalid origin` and no
   allow-origin header. Origin validation happens before grant processing.
9. The approved-origin token probe returns 400 `unauthorized_client` and an
   allow-origin header matching that approved origin.

If password grants were intentionally retained for a documented dependency,
the no-Origin and approved-origin probes will still return `invalid_grant`
for the fictitious user. Report that setting as incomplete. Do not use a CORS
OPTIONS preflight as proof of origin restriction: it can echo an origin that
the actual token request rejects.

Then complete the functional checks:

- Use a fresh browser profile to sign in with an approved account. Verify the
  expected identity and a protected API request that returns 200. A public
  configuration response or a login-page screenshot is not sufficient.
- Use the application's logout control, accept Keycloak's logout confirmation
  if shown, and verify completion without an error. Revisit the application
  in the same profile and require a new sign-in prompt.
- Confirm all services remain running and the health endpoint remains 200.
- Confirm a new authenticated Watcher cycle in its log and corresponding
  successful API audit entries. Where an approved eligible scan is available,
  also confirm the completed import in STIG Manager. Do not create duplicate
  imports merely to obtain test evidence.

## Roll back

Restore the original values recorded before the change on the same client's
Settings page, including Require PKCE, PKCE Method and any logout adjustment.
Save, reload and verify the restored values. If PKCE was optional before the
change, turn Require PKCE off.

**API rollback detail:** Keycloak merges client attributes. Sending the
original JSON without the newly added `pkce.code.challenge.method` key leaves
S256 in place. The tested API rollback explicitly sent that attribute with a
JSON null value to remove it, then confirmed that it was absent on read-back.
Apply the same explicit removal to a logout attribute only if this change
added one that was originally absent. Preserve the original backup unchanged.

The rollback was tested successfully on 2026-10-28 and took effect immediately. It must restore the original probe behavior,
including optional PKCE and the original grant/origin results. Repeat a full
fresh-profile browser sign-in, expected identity, protected API access,
sign-out and prompt on revisit, plus the service-account and actual Watcher
checks. Reaching the login form alone does not prove a successful rollback.

Reapplication was tested successfully on the same day, including a separate fresh authenticated Watcher cycle. The test server ends with all intended
restrictions in place. Reapply any conditional logout adjustment as well as
the four primary settings. Do not restore production's original broad
settings for a rehearsal unless its administrators have explicitly planned
that separate exposure window.

## Not verified

- Production's actual client settings, addresses and external script
  dependencies were not inspected or changed.
- LDAP federation, external identity providers and production integrations
  are absent from this test deployment and were not exercised.
- The live configuration and rollback were applied through the administrator
  API. Console labels and locations were inspected read-only; the console Save
  operation itself was not used for this rehearsal.
- No fresh installation or Windows Server 2025 rebuild was performed. The
  template and address-validation checks do not substitute for that test.
- An authenticated Watcher cache-refresh cycle was verified in each phase;
  a new scan import was not injected or exercised for this configuration change.
