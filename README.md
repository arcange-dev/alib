# ALIB — Creator-first digital home

ALIB is a creator-managed digital library for articles, short notes, useful websites, projects, books, videos, resources, collections, and permitted file downloads. It includes a responsive public React/TypeScript site, a private Creator Studio, a Django REST Framework API, and a Supabase PostgreSQL persistence path.

## Stack

- **Web:** React + TypeScript, Vite, React Router, Tailwind CSS v4, Lucide SVG icons.
- **API:** Python, Django, Django REST Framework, session-based administrator authentication, OpenAPI via drf-spectacular.
- **Data:** Django ORM + migrations; Supabase PostgreSQL in production, SQLite for local-only development when `DATABASE_URL` is omitted.
- **Optional files:** Supabase Storage through server-side upload and short-lived signed download/preview URLs.
- **Deployment:** Render blueprint in `render.yaml` (a static site and a Python web service).

## Repository map

```text
frontend/                 React website and Creator Studio
backend/                  Django project and REST API
design-system/alib/       UI/UX Pro Max master system and page overrides
docs/                     Setup, architecture, security, deployment notes
supabase/                 Storage setup and database guidance
render.yaml               Render Blueprint for web + API services
.env.example              Environment placeholders only
```

## Local development

Requirements: Node.js 20.19+ (22 LTS recommended), npm, and Python 3.12+.

### 1. Backend

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

The local API defaults to SQLite only when `DATABASE_URL` is blank and `DJANGO_DEBUG=true`. To use your Supabase database locally, set `DATABASE_URL` in your shell or local environment. Never commit a `.env` file or connection string.

### 2. Frontend

Open a second terminal:

```bash
cd frontend
npm install
# Optional: create .env.local and set VITE_API_URL=http://127.0.0.1:8000
npm run dev
```

Open `http://localhost:5173`. Creator Studio is at `/admin`. Sign in with the Django **staff/superuser** account created above. The frontend requests a CSRF token and uses Django's server-managed session cookie; it does not store privileged bearer tokens in browser local storage.

### 3. Validate locally

```bash
# Frontend production build and component smoke test
cd frontend
npm run build
npm test

# Backend migrations, API tests, and Django config checks
cd ../backend
python manage.py makemigrations --check --dry-run
python manage.py check
python manage.py test
```

## Core behaviour

- Anonymous visitors can only query content with `status=published`, `visibility=public`, and a publication timestamp that is not in the future.
- The Creator Studio can create, edit, publish, unpublish, archive, and delete content through protected API endpoints. A published public item appears on public lists/detail routes after the API responds with it.
- Search uses server-backed published content, with client filters and shareable query parameters on `/discover`.
- Collections reference content through an ordered relationship model. Collection endpoints expose only public collections to anonymous visitors.
- The contact form stores a private message in PostgreSQL; it does not pretend to send an email. Visitor suggestions enter a pending moderation state.
- Scheduled status is modeled, but automatic publication requires a configured background scheduler/worker; selecting “Scheduled” is not by itself an automatic publishing guarantee.
- Media uploads require the optional Supabase Storage environment variables. Uploads are restricted by size/MIME type, use generated object keys, and are private by default. Signed URLs are permission-checked and short-lived.
- There are no seeded fake analytics, fabricated popularity counts, or prefilled personal details. Configure the profile and publish real content after deployment.

## Environment variables

See [`.env.example`](.env.example), [deployment guide](docs/deployment.md), [security notes](docs/security.md), and [storage setup](supabase/README.md). For production, the API requires `DJANGO_SECRET_KEY`, `DATABASE_URL`, allowed host and origin configuration, and `DJANGO_DEBUG=false`. Keep Supabase service-role credentials exclusively on the backend.

## Admin options

- React Creator Studio: `https://your-site.example/admin`
- Django's built-in administration: `https://your-api.example/django-admin/`
- OpenAPI schema: `https://your-api.example/api/schema/`
- Swagger UI: `https://your-api.example/api/docs/`
- Health check: `https://your-api.example/health/`

## UI/UX Pro Max v2.15.0

The actual skill ZIP from the conversation library was extracted and its search tool executed. The selected direction is a grid-led Swiss Modernism/editorial system with a restrained black/white foundation, pink accent, Newsreader + Roboto typography, semantic color tokens, accessible SVG icons, responsive content cards, visible focus states, and reduced-motion support. Search evidence and page-specific design overrides live under `design-system/alib/` and `docs/uiux-pro-max/`. See [the search log](docs/uiux-pro-max/search-log.md).

## Known first-iteration limits

This is the first implementation foundation, not a declaration that every item in the full product brief is finished. Advanced integrations such as YouTube/Instagram metadata ingestion, newsletter provider integration, analytics reporting, a background scheduler, a rich WYSIWYG editor, full profile/appearance settings UI, and automated browser end-to-end tests remain follow-on work. External metadata retrieval must be added behind SSRF-safe server-side fetch rules; do not fetch arbitrary URLs from the browser/server without validation.
