# Deploy ALIB to Render with Supabase

The recommended deployment uses **one Render web service** for both the React website and Django API. That keeps the site, Creator Studio, API, session cookies, and CSRF cookie on one HTTPS origin.

## Before you start

You need access to the GitHub repository [arcange-dev/alib](https://github.com/arcange-dev/alib), a Supabase project, and a Render account. Never commit database URLs, passwords, a Django secret, or the Supabase service-role key.

## 1. Get a Render-compatible Supabase connection URL

1. Open your project in the Supabase dashboard.
2. Click **Connect** and select **Session pooler**.
3. Copy the connection string. It normally uses the pooler host, port **5432**, and a username that includes your project reference.
4. Replace the password placeholder with your actual database password. URL-encode reserved password characters such as `#`, `?`, `&`, or spaces.
5. Keep the connection string private.

Use the Supabase session pooler for the standard Render setup because Render's network is IPv4-only, while the direct Supabase database endpoint is normally IPv6-only without an IPv4 add-on. See the [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Create the Render deployment from the Blueprint

1. Open the [Render Dashboard](https://dashboard.render.com/).
2. Choose **New + → Blueprint**.
3. Connect GitHub if asked, then select **arcange-dev/alib**, branch **main**.
4. Render reads the root `render.yaml` and creates one Python web service named `alib`. If that service hostname is unavailable, choose a different name and update the matching self-reference in `render.yaml`.
5. When Render prompts for `DATABASE_URL`, paste the Supabase session-pooler connection string.
6. Apply the Blueprint. Render generates `DJANGO_SECRET_KEY` and derives the allowed host from the assigned Render hostname.
7. Monitor the service's **Events** and **Logs**. The build installs Python/Node dependencies, builds React, copies the build into Django static files, and runs `collectstatic`. The start command applies database migrations and starts Gunicorn.

The Blueprint selects Render's free web-service plan and Frankfurt region. Free services can sleep when inactive, so the first request after inactivity can take longer. See Render's [deployment guide](https://render.com/docs/deploy-django).

### Manual setup (alternative)

Create a **Web Service** from GitHub repository `arcange-dev/alib`, branch `main`, leaving the root directory blank.

**Build Command**
```bash
pip install -r backend/requirements.txt && npm --prefix frontend install --no-audit --no-fund && npm --prefix frontend run build && rm -rf backend/static/frontend && mkdir -p backend/static/frontend && cp -R frontend/dist/. backend/static/frontend/ && cd backend && python manage.py collectstatic --noinput
```

**Start Command**
```bash
cd backend && python manage.py migrate --noinput && gunicorn alib_project.wsgi:application --bind 0.0.0.0:$PORT
```

Add these environment variables in Render → service → **Environment**:

| Key | Value |
| --- | --- |
| `DJANGO_SECRET_KEY` | Generate a strong random secret in Render |
| `DJANGO_DEBUG` | `false` |
| `DATABASE_URL` | Your Supabase session-pooler URL |
| `ALLOWED_HOSTS` | Exact assigned hostname, e.g. `alib.onrender.com`, without protocol |
| `SECURE_SSL_REDIRECT` | `true` |
| `TIME_ZONE` | `Africa/Kigali` |

Do not set `VITE_API_URL` for the single-service deployment; requests use `/api/v1` on the same origin.

## 3. Create the initial administrator

After the service has successfully deployed:

Render Free web services do not have Shell access, so ALIB supports a temporary, guarded bootstrap flow that does not expose a public account-creation endpoint.

1. In Render → your `alib` service → **Environment**, add all three variables below. Use your own values; do not send the password in chat or commit it to GitHub.

   | Key | Value |
   | --- | --- |
   | `ALIB_BOOTSTRAP_ADMIN_USERNAME` | A username you choose, e.g. `alib-owner` |
   | `ALIB_BOOTSTRAP_ADMIN_EMAIL` | Your email address |
   | `ALIB_BOOTSTRAP_ADMIN_PASSWORD` | A unique strong password (at least 12 characters, preferably longer) |

2. Save the environment changes and let Render redeploy. The startup command runs migrations then `python manage.py bootstrap_admin`. It creates the first active superuser only if none exists and never resets an existing administrator password.
3. After the deploy starts successfully and logs say the first superuser was created, return to **Environment** and delete all three `ALIB_BOOTSTRAP_ADMIN_*` variables. Save changes and redeploy again. The administrator account stays in Supabase PostgreSQL; removing the temporary variables does not delete it.
4. Open the Render URL followed by `/admin` and sign in with the username and password you chose.

If you use a paid Render service with Shell access instead, you can use `cd backend && python manage.py createsuperuser`. The React Creator Studio is at `/admin`; Django's built-in maintenance interface is at `/django-admin/`.

## 4. Verify the live deployment

Replace `alib.onrender.com` below with the exact hostname Render assigned:

- `/` loads the React homepage.
- `/health/` returns `{"status":"ok","service":"alib-api"}`.
- `/api/docs/` loads API documentation.
- `/api/v1/content/` returns the public content API response.
- `/discover`, `/posts`, and `/admin` work on direct navigation and browser refresh.
- Sign into `/admin`, create a draft, confirm it stays private, then publish it and confirm it appears on the public website.

GitHub Actions checks the frontend, Django API/privacy rules, combined React/Django packaging, static collection, and a basic SPA/API smoke test. Render is set to deploy after repository checks pass.

## 5. Optional: enable Supabase Storage for uploads

The site/database can deploy without Storage. To enable uploads later:

1. Create a **private** Supabase Storage bucket named `alib-media`.
2. In Render → service → **Environment**, add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=alib-media`, and optionally `MAX_UPLOAD_BYTES=20971520`.
3. Keep the service-role key server-side only. Never expose it via a `VITE_*` variable.
4. Save and redeploy; test an allowed upload, signed preview URL, and denial of anonymous access to private assets.

## Troubleshooting

- **Database connection fails:** re-copy the Supabase session-pooler URL; check the password is URL-encoded.
- **DisallowedHost:** set `ALLOWED_HOSTS` to the assigned hostname without `https://` or a trailing slash.
- **Frontend routes return 503:** the frontend was not built/copied. Check the Vite build, copy, and `collectstatic` steps in Render's logs.
- **Static assets return 404:** verify `backend/static/frontend/assets` was created during build and `collectstatic` succeeded.
- **CSRF sign-in error:** use the exact HTTPS Render URL consistently and redeploy after environment changes.
- **Upload says storage is not configured:** add the optional Storage environment variables and create the private bucket.
