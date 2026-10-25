from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from .spa import frontend_app
from content.public_views import atom_feed, robots_txt, rss_feed, sitemap_xml

urlpatterns = [
    path('django-admin/', admin.site.urls),
    path('api/v1/', include('content.urls')),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('feed.xml', rss_feed, name='rss-feed'),
    path('atom.xml', atom_feed, name='atom-feed'),
    path('sitemap.xml', sitemap_xml, name='sitemap'),
    path('robots.txt', robots_txt, name='robots'),
    path('health/', lambda request: JsonResponse({'status': 'ok', 'service': 'alib-api'}), name='health'),
    # Client-side routes such as /discover and /admin must return the React entry point
    # on direct navigation and page refresh. API/admin/static paths stay with Django.
    re_path(r'^(?!api/|django-admin/|health/|static/).*$',
            frontend_app, name='frontend-app'),
]
