# Statuspage Embed – Torvus Console

The `/overview` page embeds the Torvus Statuspage component for quick visibility into customer-facing incidents.

## Configuration

1. In Vercel, add one of the following env vars for the Console project:
   - `NEXT_PUBLIC_STATUSPAGE_PAGE_ID` – the Statuspage page identifier (e.g., `abcd1234`). The app renders `https://<PAGE_ID>.statuspage.io/embed/status`.
   - `NEXT_PUBLIC_STATUSPAGE_URL` – override with a full URL if Statuspage runs on a custom domain.
2. Optional: set `STATUSPAGE_EMBED_THEME=dark` in Statuspage to match Torvus branding.

## CSP + security

- `frame-src` allows `https://*.statuspage.io` by default; custom domains are added dynamically when `NEXT_PUBLIC_STATUSPAGE_URL` is set.
- `frame-ancestors 'none'` ensures the Console itself cannot be embedded elsewhere while still allowing outbound Statuspage iframes.
- The iframe uses `referrerPolicy="no-referrer"` and `sandbox="allow-same-origin allow-scripts allow-popups"`.

## Time zone note

Statuspage timestamps display in the viewer’s local time zone. The Console shows Torvus system timestamps in UTC for evidence. When exporting incident timelines, normalise Statuspage times to UTC before attaching to audit packages.

## Troubleshooting

- Verify that the Statuspage plan allows embedded iframes (some tiers disable it).
- If the iframe is blank, check the browser console for CSP violations and confirm the domain appears in the `frame-src` directive.
- For change control, capture a screenshot of the embedded widget and archive it with the deployment evidence bundle.
