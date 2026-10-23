# ALIB security notes

- Never commit `.env`, database strings, Django secrets, Supabase service-role keys, access tokens, or real admin credentials.
- Keep `DJANGO_DEBUG=false` in production; the backend intentionally fails startup if a production secret or database URL is missing.
- Admin APIs check Django `is_staff` permissions server-side. React visibility is only a UI decision, never the security boundary.
- Session cookies are HttpOnly and Secure in production. Unsafe authenticated API requests use CSRF tokens. CORS and trusted origins should list exact origins.
- Anonymous content results are filtered to published, public, time-eligible records. Private storage objects are not returned as permanent URLs.
- Contact and suggestion endpoints validate data and have DRF scope-based rate limits. Visitor suggestions remain pending for moderation.
- Uploaded files are size-limited, MIME-allowlisted and stored under generated keys. For higher-assurance production use, inspect file signatures as well as declared MIME types, add malware scanning if required, and set provider bucket access policies to private.
- External URLs are stored, not fetched server-side in this first iteration. If metadata previews are added, implement SSRF controls, DNS/IP checks, redirect revalidation, response/time limits, allowed content types and size caps.
- Production browser/API deployment across unrelated site domains can run into third-party cookie restrictions. Prefer same-site deployment, or test Secure/SameSite cookie behaviour with all target browsers before release.

## Remaining production hardening

Configure monitoring and backups for Supabase, rotate credentials, confirm storage bucket policies, set real deployment origins, run dependency vulnerability scans, add automated end-to-end authorization tests, and review any newsletter/analytics service before enabling it.
