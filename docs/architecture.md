# ALIB architecture

## Request flow

1. React routes render public pages and the Creator Studio.
2. `frontend/src/api.ts` is the single typed API client and sends same-origin/session credentials plus the CSRF header for non-safe methods.
3. Django REST Framework validates input, checks permissions, and filters content before serializing it.
4. Django ORM migrations define the schema. In production, `DATABASE_URL` points to Supabase PostgreSQL.
5. If Storage is configured, upload and signed-URL issuance run through Django. The service-role key is never shipped to the browser.

## Data model

- `CreatorProfile` and `SiteSettings`: editable profile and top-level branding settings.
- `ContentItem`: article/note/link/project/video/book/resource/file/gallery/podcast, with publication status, visibility, content type, SEO-ready slug, tags, category and metadata.
- `Category`, `Tag`: reusable taxonomy.
- `Collection` + `CollectionItem`: curated ordered relationships to content.
- `MediaAsset`: storage key, filename, MIME, size and access flags (not a public storage URL).
- `VisitorSuggestion`: private moderation queue.
- `ContactMessage`: private creator inbox.
- `AuditEvent`: administrative content/media history.

## Authentication

Django is the admin identity authority. Admin routes use Django staff/superuser permissions and session authentication. The API provides a CSRF bootstrap endpoint, login, current-user and logout endpoints. Production requires a strong secret and HTTPS cookies. Do not rely on hiding a React route for security.

## Public publication rule

A public item must satisfy all three conditions: `status='published'`, `visibility='public'`, and `published_at <= now`. The same rule is used by content list/detail routes and homepage payload. Unlisted/private items do not appear in public search. Admin users may see all statuses through the same authenticated content endpoint.
