# ALIB — Creator-first digital home

ALIB is a creator-managed digital library for articles, notes, websites, projects, books, videos, resources, collections, and permitted file downloads. It includes a React/TypeScript public website, a private Creator Studio, a Django REST Framework API, and Supabase PostgreSQL persistence.

## Stack

- **Web:** React + TypeScript, Vite, React Router, Tailwind CSS v4, Lucide SVG icons.
- **API:** Python, Django, Django REST Framework, session-based admin authentication, OpenAPI via drf-spectacular.
- **Data:** Django ORM and migrations; Supabase PostgreSQL in production, SQLite for local development when `DATABASE_URL` is omitted.
- **Optional files:** Supabase Storage with short-lived signed preview/download URLs.
- **Hosting:** One Render Python web service serves React and Django from one HTTPS origin.

## Deploy on Render

Follow [the step-by-step deployment guide](docs/deployment.md). In summary:

1. Create a Supabase project and copy its PostgreSQL **Session pooler** connection URL from **Connect**.
2. Open Render → **New + → Blueprint** and select GitHub repo `arcange-dev/alib`, branch `main`.
3. Enter the private connection string when Render prompts for `DATABASE_URL`. Render generates `DJANGO_SECRET_KEY`.
4. Apply the Blueprint and wait for the deployment to succeed.
5. Create the first superuser using the temporary `ALIB_BOOTSTRAP_ADMIN_USERNAME`, `ALIB_BOOTSTRAP_ADMIN_EMAIL`, and `ALIB_BOOTSTRAP_ADMIN_PASSWORD` Render environment variables described in [the deployment guide](docs/deployment.md), then remove them after the first successful bootstrap deploy.
6. Open the assigned Render URL, then `/admin`, to sign in.

Render serves the website and API from the same host, so the client uses relative `/api/v1` requests and Django's session/CSRF cookies remain same-origin. Leave `VITE_API_URL` blank for this deployment.

## Local development

Requirements: Node.js 20.19+ (Node 22 LTS recommended), npm, Python 3.12+.

### Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 127.0.0.1:8000
```

The API uses SQLite only when `DATABASE_URL` is blank and `DJANGO_DEBUG=true`. Never commit real connection strings or secrets.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to Django on port 8000. Creator Studio is at `/admin`. Sign in with the Django **staff/superuser** account created above.

### Tests

```bash
cd frontend
npm run build
npm test

cd ../backend
python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py test
```

## Implemented workflows

- Public content discovery supports server-side search, type/category/tag/featured/date filters, sort order, shareable URL state and pagination. Anonymous requests are restricted to published public entries.
- Creator Studio includes a Markdown block editor with formatting toolbar/live preview, browser draft recovery, unsaved-change warning for the open editor, scheduled publication fields, revision comparison/restore, taxonomy selection, media upload progress and editable image alt text.
- Collection curation persists item ordering. Homepage section order, public profile, site title/description, logo and favicon are editable through staff-only settings screens.
- Reader tools include a local read-later list, share/copy actions, related content, privacy-hashed reactions, and comments that remain pending until moderation.
- Administration includes least-privilege staff roles, email-based teammate invitations, password recovery, suggestion bulk moderation and duplicate-link checks, contact inbox, owner-only audit history, analytics summaries, and confirmed newsletter subscriber export.
- Public SEO resources include canonical/Open Graph/Twitter metadata, RSS at `/feed.xml`, sitemap at `/sitemap.xml`, and robots directives at `/robots.txt`.
- The backend includes an idempotent `publish_scheduled` management command and a protected trigger for scheduled workflows. CI checks the frontend, Django tests/privacy rules, packaging, collected assets and SPA/API smoke routes.

## External setup required for production

- **Supabase PostgreSQL:** set `DATABASE_URL` to the complete session-pooler connection URL. Never commit it.
- **Supabase Storage:** uploads require a private `alib-media` bucket plus server-side `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and optionally `SUPABASE_STORAGE_BUCKET` / `MAX_UPLOAD_BYTES`.
- **Email delivery:** team invitations, staff password reset, newsletter confirmation/unsubscribe emails, and optional contact notifications require working SMTP/provider settings. Without these credentials the application returns a clear delivery error; it does not claim an email was sent.
- **Scheduled publishing:** configure `ALIB_SCHEDULER_TOKEN` in Render and matching GitHub Actions secrets `ALIB_SCHEDULER_URL` and `ALIB_SCHEDULER_TOKEN`. See [deployment instructions](docs/deployment.md). GitHub's scheduler is best-effort, not a real-time guarantee.
- **Initial owner account:** use the temporary `ALIB_BOOTSTRAP_ADMIN_*` environment variables, then remove them after the account is created.
- **Operations:** verify Supabase backups/restores and review the [production runbook](docs/production-runbook.md).

## Remaining limitations and release gates

The current editor is a Markdown-based block/formatting workflow, not a full visual WYSIWYG editor. Two-factor authentication, a native reader-account system with cross-device synced bookmarks, automatic analytics retention/deletion, automated provider-specific social metadata ingestion, and full browser end-to-end tests are not included yet. Newsletter/contact/team email features must be tested with the chosen provider before public launch. The feature roadmap is a delivery checklist, not a claim that every conceivable production control is complete.

No fake analytics or invented personal profile details are seeded.

## UI/UX Pro Max

The supplied skill's search tool was executed. The selected direction is a grid-led Swiss Modernism/editorial system with a restrained navy/blue foundation and bright yellow accents, Newsreader + Roboto typography, accessible SVG icons, visible focus states, and reduced motion. See `design-system/alib/` and `docs/uiux-pro-max/search-log.md`.
