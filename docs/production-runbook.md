# ALIB Production Runbook

This document covers launch verification, common incidents, backup recovery and rollback. Keep it alongside the deployment and security guides; do not paste secrets into GitHub issues, screenshots or logs.

## Environment checklist

- [ ] Render service is healthy at /health/; direct navigation works for /, /discover, /posts, and /admin.
- [ ] Supabase DATABASE_URL uses the actual project session-pooler hostname and a URL-encoded password where needed.
- [ ] DJANGO_DEBUG=false, generated DJANGO_SECRET_KEY, HTTPS redirect, secure cookies and exact allowed hosts are active.
- [ ] Initial owner login works; remove every ALIB_BOOTSTRAP_ADMIN_* variable after first successful bootstrap.
- [ ] Optional Storage variables are configured only if a private alib-media bucket exists.
- [ ] SMTP is configured and tested before enabling password reset, team invitations, contact notifications or newsletter confirmation.
- [ ] Scheduled publishing is tested manually before enabling recurring runs; use the same secret token in Render and GitHub Actions.
- [ ] Run python manage.py check --deploy in a secure environment and review any warnings before production release. Do not enable debug to silence errors.

## Email environment variables

Set these in Render → ALIB → Environment using your chosen SMTP/transactional provider's exact values:

- EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD
- EMAIL_USE_TLS=true for the usual STARTTLS setup, or EMAIL_USE_SSL=true only when your provider requires implicit TLS (do not enable both)
- DEFAULT_FROM_EMAIL to a sender address verified by the provider
- ALIB_CONTACT_NOTIFICATION_EMAIL to the private inbox that should receive contact-message notices (optional)

Keep credentials server-side. Save changes, redeploy, then test a password-reset request for an existing staff account, a newsletter confirmation to an address you control, a team invitation to a test mailbox, and a contact message. Verify received emails and application logs. Do not use real subscriber addresses for testing.

## Database backups and restore drills

1. Open the correct Supabase project and verify that its plan and backup features meet your retention/recovery needs. Do not assume the Render filesystem is a backup; it is ephemeral.
2. Identify the latest known-good Supabase database backup or supported export and record its timestamp in your private operations notes.
3. Before a schema migration or bulk change, create/confirm a recoverable backup or export using the project's supported Supabase controls.
4. For a restore drill, prefer a separate staging Supabase project. Restore the backup into staging using Supabase-supported procedures, set the staging service's DATABASE_URL to that staging database only, and run the validation checklist below.
5. Never point production at a staging database. Do not paste connection strings into tickets or commit exported data to the public repository.
6. Record the restore start/end time, backup age, any data loss observed, and the steps needed to repeat it.

### Restore validation checklist

- [ ] python manage.py migrate --check and python manage.py check pass in the staging environment.
- [ ] Owner can sign in; a normal editor cannot open the owner-only team, site-settings, audit or subscriber-export APIs.
- [ ] Public content list and slug detail include published public items only.
- [ ] Drafts and private content remain unavailable to anonymous requests.
- [ ] Media URLs obey visibility and the restored storage bucket contains expected objects (database restore does not restore file objects automatically).
- [ ] Revision history, collection ordering, contact messages and moderation state match the expected restore point.
- [ ] After the drill, retire the staging credentials and document the result without sharing secret values.

## Incident triage

### Website returns 503 or fails to start
1. Check Render deploy and runtime logs from the failing release.
2. If migrations fail, inspect the first database error (hostname, credentials, connection mode or SSL) rather than repeatedly redeploying.
3. Check the /health/ endpoint after recovery. If the frontend bundle is missing, review the Vite build, static copy and collectstatic steps.

### Sign-in or CSRF fails
1. Use the exact HTTPS Render origin consistently.
2. Confirm cookies are not blocked and use a fresh browser session.
3. Verify that the account is active and staff-authorized. Do not reset a password by editing source code or committing credentials.
4. Use the email reset route only after SMTP has been verified.

### Scheduled item did not publish
1. Confirm its status is scheduled, visibility is public, and scheduled_for is in the past using the intended TIME_ZONE.
2. Run the GitHub Actions Publish scheduled ALIB content workflow manually.
3. Verify both required Actions secrets exist and ALIB_SCHEDULER_TOKEN matches in Render. Never print that token in a workflow step.
4. Check the HTTP status and Render runtime logs. GitHub schedules can run late and a sleeping free Render service can take time to wake.

### Unexpected permission or private-data exposure
1. Disable access to the affected account or rotate the compromised credential immediately.
2. Preserve relevant audit events and timestamps without copying secrets or private user content into public issues.
3. Review the relevant role group and permission code; fix the server-side authorization, add a regression test, and wait for CI to pass before redeploying.
4. If a database or provider credential may have leaked, rotate it at the provider and update Render environment variables.

## Rollback and release gate

- Use Render's prior known-good deploy/rollback capability when a new deployment causes a production regression; check Render's current dashboard labels and rollback behavior before acting.
- Do not roll back across a database migration blindly. Review migration compatibility first and restore from a known-good database backup only under an explicit recovery plan.
- Require green GitHub Actions, a successful Render health check, a creator sign-in, a draft/publish check, public/private visibility checks, and a tested media/email integration (where enabled) before calling a release ready.
- If a feature depends on an external provider that is not configured, document it as unavailable; never present a fake success message.
