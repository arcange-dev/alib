# Render + Supabase deployment

## 1. Create Supabase database

1. Create a Supabase project.
2. Open Project Settings → Database and copy a PostgreSQL connection string that is appropriate for your hosting/network setup. Prefer the Supabase connection pooler when the host/runtime requires it.
3. Save it as the backend service's `DATABASE_URL` secret. Never add it to React's `VITE_*` variables.
4. Create a strong Django secret key and configure the backend production variables in the Render service settings.

## 2. Configure Render Blueprint

The repository's `render.yaml` describes two services:

- `alib-api`: Python/Django web service from the `backend` directory.
- `alib-web`: static Vite site from the `frontend` directory, with `VITE_API_URL` sourced from the API service URL.

Create the Blueprint from the GitHub repo. Configure `DATABASE_URL`, `DJANGO_SECRET_KEY`, and `CORS_ALLOWED_ORIGINS` / `CSRF_TRUSTED_ORIGINS` with the exact deployed frontend origin in the API service. Set `DJANGO_DEBUG=false`. Confirm allowed hosts include the API's assigned host. When the services are cross-site rather than same-site, set `CROSS_SITE_COOKIES=true` and verify third-party cookie behaviour in the actual browsers; serving both behind one site/domain is preferable where possible.

## 3. Run the app

The API start command runs migrations before Gunicorn starts. Once the API is healthy, open a Render Shell on the API service and create the initial admin:

```bash
python manage.py createsuperuser
```

Use that staff account to sign in at `/admin`. For emergency content maintenance, Django admin is available at `/django-admin/`.

## 4. Optional Supabase Storage

Create a **private** storage bucket named `alib-media` (or configure `SUPABASE_STORAGE_BUCKET`). Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` only in the API service environment. The backend upload endpoint accepts a small allowlist of MIME types and a configurable size limit. It creates private metadata by default; short-lived signed URLs are minted only after permission checks.

## 5. Smoke tests after deployment

- `/health/` returns `{"status":"ok","service":"alib-api"}`.
- `/api/docs/` loads the implemented API docs.
- A non-staff account/anonymous request cannot create or update content.
- A draft and a private item do not appear in public `/api/v1/content/` or `/api/v1/content/by-slug/<slug>/` requests.
- Publish a test item, confirm it appears in Discover and Home, then unpublish it and confirm it disappears from anonymous requests.
- Refresh `/discover`, `/posts/<slug>`, and `/admin` directly to confirm the static-site rewrite is configured.
- Upload a permitted test file only after Storage is configured; confirm URLs are short-lived and private files cannot be accessed by anonymous requests.
