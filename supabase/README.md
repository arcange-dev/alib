# Supabase setup for ALIB

## PostgreSQL

Django migrations are the source of truth for the schema. To connect locally or in production, copy the Supabase PostgreSQL connection string to the **backend** `DATABASE_URL`. Do not paste it into frontend environment variables. Use a connection/pooler mode supported by your deployment runtime, keep TLS enabled in production, and avoid exposing the database password in logs or commits.

Initial schema is created with:

```bash
cd backend
python manage.py migrate
```

Core tables are represented by Django models: creator profile, site settings, content, categories, tags, collections and ordered collection items, media metadata, visitor suggestions, contact messages, and audit events. Export/backup through Supabase's database backup/export facilities; test recovery periodically.

## Storage

1. In Supabase Storage, create a **private** bucket named `alib-media` (or set `SUPABASE_STORAGE_BUCKET`).
2. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the Django server environment only. Never prefix these as `VITE_*` variables.
3. Optionally tune `MAX_UPLOAD_BYTES` (default 20 MiB).
4. Verify the backend's upload endpoint accepts only intended file types and confirm anonymous requests cannot request signed URLs for private assets.

The service-role key bypasses ordinary Storage policies, so Django's permission checks are mandatory. The first version uploads to generated object keys, stores metadata in PostgreSQL, and creates short-lived signed URLs after checking asset visibility/download flags. Private bucket policies should remain enabled; avoid public buckets for private assets.
