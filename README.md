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

## Core behaviour and current limits

Anonymous visitors only see public, published content. The Creator Studio can create/edit/publish content, search uses backend data, and visitor suggestions are held for moderation. Contact messages are saved privately, not reported as emailed. Scheduled status is modeled, but automatic publication needs a background scheduler/worker. Uploads need optional Supabase Storage variables; files are private by default and signed URLs are permission-checked.

Advanced YouTube/Instagram metadata ingestion, newsletter-provider integration, analytics reporting, a background scheduler, rich WYSIWYG editing, full profile/appearance settings UI, and browser end-to-end tests remain follow-on work. No fake analytics or invented personal profile details are seeded.

See [deployment instructions](docs/deployment.md), [architecture](docs/architecture.md), [security](docs/security.md), and [Supabase Storage setup](supabase/README.md).

## UI/UX Pro Max

The supplied skill's search tool was executed. The selected direction is a grid-led Swiss Modernism/editorial system with a restrained monochrome foundation, pink accent, Newsreader + Roboto typography, accessible SVG icons, visible focus states, and reduced motion. See `design-system/alib/` and `docs/uiux-pro-max/search-log.md`.
