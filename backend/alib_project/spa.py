from django.conf import settings
from django.http import FileResponse, JsonResponse


def frontend_app(request, path=''):
    """Serve the built React app for browser routes in the same origin as the API."""
    index_path = settings.BASE_DIR / 'static' / 'frontend' / 'index.html'
    if not index_path.is_file():
        return JsonResponse(
            {'detail': 'The frontend has not been built. Run the frontend build and copy it into backend/static/frontend.'},
            status=503,
            headers={'Cache-Control': 'no-cache, must-revalidate'},
        )
    response = FileResponse(index_path.open('rb'), content_type='text/html; charset=utf-8')
    # Hashed asset bundles can be cached forever, but the shell itself must always
    # revalidate so every deploy reaches visitors instead of a stale bundle.
    response['Cache-Control'] = 'no-cache, must-revalidate'
    return response
