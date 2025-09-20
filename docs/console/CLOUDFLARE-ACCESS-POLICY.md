# Cloudflare Access Policy – Torvus Console

Torvus Console sits behind Cloudflare Zero Trust (`console.torvussecurity.com`). The edge gate ensures only Torvus staff groups reach the Next.js application before Supabase session evaluation.

## Policy model

- **Application:** `https://console.torvussecurity.com/*`
- **Session duration:** 8 hours (shorter than platform default)
- **Authentication:** SAML (Okta) + mandatory hardware key
- **Group allow list:**
  - `torvus-staff-operations`
  - `torvus-security-admin`
  - `torvus-break-glass`
- **Service bindings:**
  - Header `X-Torvus-Staff-Identity` (email) forwarded to the app
  - Header `X-Torvus-Staff-Groups` (comma separated group IDs)

## Dual-control alignment

When a staff member initiates a dual-control request, their Cloudflare identity headers are captured in the audit payload and persisted with the correlation ID. Approvers must present the same identity headers; mismatches trigger rejection before hitting the database.

## Break-glass flow

1. Security Admin flips the break-glass feature flag in Cloudflare to include the `torvus-break-glass` group.
2. Cloudflare logs the event to SIEM and sends webhook to Security Operations.
3. The console app still enforces Supabase RBAC: break-glass members map to `break_glass` role for maximum permissions.
4. Upon resolution, revoke the group assignment and rotate Supabase service keys.

## Configuration checklist

- [ ] Apply IP allow lists for Torvus corporate ranges.
- [ ] Enable device posture checks (disk encryption + OS version) for staff devices.
- [ ] Configure `csp-report@torvussecurity.com` as the email recipient for Access anomaly alerts.
- [ ] Verify that Access sessions inject the `CF-Access-Client-Id` header for audit correlation.

## Change control

Any modification to Access policies must be approved via the dual-control workflow and linked to an incident or change management ticket. Export the Access policy JSON and attach it to the evidence package before enabling in production.
