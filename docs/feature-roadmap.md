# ALIB Product Completion Roadmap

This is the proposed backlog for taking ALIB from its current creator-managed digital-library foundation to a dependable public release. Items below are planned work, not features claimed to be implemented simply because this document exists.

## Existing foundation

The current codebase includes a React/TypeScript public site and Creator Studio, a Django REST Framework API, Django session/CSRF authentication for staff, Supabase PostgreSQL support, content types and publication states, categories and tags, collections, a private media model with optional Supabase Storage, visitor suggestions, a contact inbox model, basic admin statistics, dark/light themes, and an administrative audit-event model.

The roadmap focuses on completing workflows, adding reader value, and closing production gaps instead of replacing that foundation. Keep the existing blue-and-yellow visual system and same-origin Render deployment unless there is a tested reason to change them.

## The 20 features

### 1. Rich content editor and reusable blocks — Priority P0
Build an accessible editor for headings, paragraphs, lists, quotes, links, images, video embeds, code blocks, and callouts. Include an editing toolbar and a clear fallback for plain text/Markdown content.

**Done when:** a creator can author and edit an article without raw HTML; saved content renders safely; images have alt text; and preview output matches the public article.

### 2. Autosave, private preview, and unsaved-change protection — Priority P0
Save drafts periodically, show the last-saved status, support a preview-only link that cannot reveal private drafts publicly, and warn before leaving with unsaved changes.

**Done when:** refreshing or losing the tab does not silently discard the most recent successfully saved draft; preview authorization is enforced server-side; and failed autosaves are clearly surfaced.

### 3. Content revision history and restore — Priority P1
Store dated revisions of titles, body, summary, metadata, and publish settings. Let the creator compare a revision with the current version and restore a selected version.

**Done when:** restoring creates a new revision rather than destroying history, and each revision records its actor and timestamp. The existing audit log alone is not a full revision history.

### 4. Reliable scheduled publishing — Priority P0
Add an idempotent publishing command and a reliable scheduled trigger. Do not rely on an in-memory timer or on a free web service staying awake. Use an appropriate Render cron/worker plan or a secured scheduler that runs the command.

**Done when:** due items publish at their configured time zone, repeated scheduler runs do not duplicate work, missed runs recover safely, and failures are logged and observable.

### 5. Advanced discovery and faceted search — Priority P1
Allow filtering by content type, category, tag, date, and featured status, plus relevance/newest/oldest sorting. Keep search terms and filters shareable in the URL and provide an accessible empty state.

**Done when:** filters combine correctly, results remain paginated, private/unlisted drafts never leak through search, and the UI works on mobile and keyboard navigation.

### 6. Reader bookmarks and read-later lists — Priority P1
Add a bookmark action to content cards and detail pages. Start with privacy-conscious local persistence for anonymous readers; add account sync only if reader accounts are deliberately introduced.

**Done when:** a reader can save/remove items, revisit a dedicated reading list, and receives a clear empty state; no private content is exposed by the feature.

### 7. Related content and contextual recommendations — Priority P2
Recommend related articles, projects, books, and resources based on shared tags, categories, content types, or manually curated links. Provide a creator override.

**Done when:** suggestions are relevant, never include private/unpublished content, avoid recommending the current item, and have a graceful fallback when little content exists.

### 8. Drag-and-drop collection ordering and homepage section controls — Priority P1
Finish the collection manager with an accessible way to order items, edit titles/descriptions/covers, and choose which curated sections appear on the home page.

**Done when:** ordering persists in the database, drag actions have a keyboard-accessible alternative, and hiding a home section does not delete its underlying content.

### 9. Production-ready media library — Priority P0
Add upload progress, image previews/thumbnails, filters, alt-text and caption fields, filename validation, storage usage indicators, and clear upload failures. Keep private files private and issue short-lived signed links.

**Done when:** upload size/type constraints are enforced on the server, file access respects visibility and permissions, deleted or replaced files are handled safely, and Storage can be tested independently of local development.

### 10. Complete profile, site settings, and branding editor — Priority P0
Expose the existing profile/site-settings foundation in Creator Studio: site title and description, creator profile, logo, favicon, social links, blue/yellow theme tokens, and homepage section ordering.

**Done when:** changes persist in PostgreSQL, public pages update without source-code edits, uploaded branding assets are validated, and safe defaults remain if settings are missing.

### 11. Technical SEO and structured metadata — Priority P0
Generate page-specific titles/descriptions, canonical links, Open Graph/Twitter metadata, JSON-LD where appropriate, XML sitemap and robots.txt. Avoid indexing drafts, unlisted content, private previews, and admin pages.

**Done when:** metadata matches each public item, sitemap entries follow publication rules, invalid slugs return appropriate status codes, and generated markup is verified in tests.

### 12. Social sharing tools and share-card previews — Priority P1
Add copy-link and native share actions, show creators how a content item will appear on common social platforms, and generate consistent card metadata using the content cover or a branded fallback.

**Done when:** share links use the canonical public URL, clipboard/share failures are handled, and cards remain readable when titles are long or no cover image is set.

### 13. RSS and Atom feeds — Priority P1
Publish feeds for all public items and, where useful, filtered categories or content types. Include full or summary text based on a deliberate content policy.

**Done when:** feeds are valid XML, update when items are published, respect visibility, use absolute canonical URLs, and advertise feed links in page metadata.

### 14. Opt-in newsletter subscriptions — Priority P2
Offer a clear subscription form with confirmation email, double opt-in, unsubscribe, and provider integration. Store secrets only in server-side environment variables; do not simulate subscriptions if the provider is not configured.

**Done when:** consent and subscription status are recorded, double opt-in is required, unsubscribe works without signing in, and delivery failures are visible to the administrator.

### 15. Reader reactions and moderated discussion — Priority P2
Add a small set of lightweight reactions and optional comments for selected public content. Keep comments disabled by default until moderation and abuse controls are ready.

**Done when:** per-IP/user rate limits, spam controls, moderation, delete/hide actions, and clear privacy terms are implemented; reader interactions never grant staff permissions.

### 16. Complete visitor-suggestion moderation — Priority P1
Improve the existing suggestions queue with status filters, bulk approve/reject, duplicate detection, optional reviewer notes, and an audit trail for each decision.

**Done when:** public suggestions always enter pending moderation, only authorized staff can approve or reject them, and approved content is not automatically published without an explicit creator decision.

### 17. Contact inbox workflow and notifications — Priority P1
Finish the existing contact-message inbox with unread/read states, archive/delete controls, filters, and optional email notifications or reply integration using a configured provider.

**Done when:** messages remain private to authorized staff, notifications do not leak message contents to logs, and the UI says clearly whether a message was saved, emailed, or replied to.

### 18. Privacy-conscious analytics dashboard — Priority P2
Report real counts for views, referrers, popular public items, search terms where safe, and outbound-link clicks. Explain data collection and offer a privacy-friendly implementation.

**Done when:** metrics derive from real events and are not fabricated, bot traffic is filtered reasonably, private content is excluded, retention is documented, and analytics-consent requirements are respected.

### 19. Secure multi-admin access and account recovery — Priority P0
Introduce least-privilege roles or staff groups, controlled administrator invitations, password reset, optional two-factor authentication, login throttling, session management, and an audit-log viewer. Retain a secure break-glass owner account.

**Done when:** each API operation checks server-side permissions, recovery tokens expire, brute-force attempts are throttled, secrets never appear in logs, and admin activity can be reviewed.

### 20. Release-readiness, observability, and recovery — Priority P0
Add end-to-end browser checks for public discovery, sign-in, editing, publishing, upload, contact and suggestions; accessibility checks; mobile/performance budgets; production error monitoring; uptime/health alerts; database backup verification and a tested restore runbook; dependency and secret scanning.

**Done when:** CI fails on critical regressions, production incidents can be diagnosed without exposing secrets or private user data, backups are recoverable (not merely enabled), and rollback steps are documented and tested.

## Recommended delivery order

1. **Stabilize launch:** correct the Supabase DATABASE_URL, verify migrations and bootstrap the first administrator, verify deployment and key permissions.
2. **Close creator workflow gaps:** features 1, 2, 4, 9, 10 and 19.
3. **Make public content discoverable and shareable:** features 5, 8, 11, 12 and 13.
4. **Increase reader value and creator efficiency:** features 3, 6, 7, 16 and 17.
5. **Add optional growth features after the basics are reliable:** features 14, 15 and 18.
6. **Keep release gates in force throughout:** feature 20 is continuous work, not a final cosmetic step.

## Scope and integration guardrails

- Keep the current React + TypeScript, Django REST Framework, Supabase PostgreSQL, and same-origin Render architecture unless a migration is documented and tested.
- Do not expose the Supabase service-role key, database URL, email provider token, or other secrets to Vite/client-side variables or GitHub.
- New scheduled work must operate safely even when a free Render web service sleeps.
- Add database migrations and automated tests whenever data models or permissions change.
- Every item is complete only after the UI, API, authorization, empty/loading/error states, mobile behavior, and tests are finished—not when a button merely appears.
