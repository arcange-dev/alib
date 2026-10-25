from xml.sax.saxutils import escape

from django.http import HttpResponse
from django.utils import timezone
from django.utils.feedgenerator import Atom1Feed, Rss201rev2Feed

from .models import ContentItem


def public_items():
    return ContentItem.objects.filter(
        status='published', visibility='public', published_at__lte=timezone.now()
    ).order_by('-published_at', '-created_at')


def rss_feed(request):
    origin = request.build_absolute_uri('/').rstrip('/')
    feed = Rss201rev2Feed(
        title='ALIB — Digital Home',
        link=origin,
        description='New articles, projects, and resources from ALIB.',
        language='en',
    )
    for item in public_items()[:50]:
        feed.add_item(
            title=item.title,
            link=request.build_absolute_uri(f'/content/{item.slug}'),
            description=item.summary or item.body[:500],
            unique_id=request.build_absolute_uri(f'/content/{item.slug}'),
            pubdate=item.published_at or item.created_at,
        )
    return HttpResponse(feed.writeString('utf-8'), content_type='application/rss+xml; charset=utf-8')


def atom_feed(request):
    origin = request.build_absolute_uri('/').rstrip('/')
    feed = Atom1Feed(
        title='ALIB — Digital Home',
        link=origin,
        feed_url=request.build_absolute_uri('/atom.xml'),
        description='New articles, projects, and resources from ALIB.',
        language='en',
    )
    for item in public_items()[:50]:
        link = request.build_absolute_uri(f'/content/{item.slug}')
        feed.add_item(
            title=item.title,
            link=link,
            description=item.summary or item.body[:500],
            unique_id=link,
            updateddate=item.updated_at,
            published=item.published_at or item.created_at,
        )
    return HttpResponse(feed.writeString('utf-8'), content_type='application/atom+xml; charset=utf-8')


def sitemap_xml(request):
    origin = request.build_absolute_uri('/').rstrip('/')
    urls = [('/', None), ('/discover', None), ('/about', None), ('/collections', None)]
    urls.extend((f'/content/{item.slug}', item.updated_at) for item in public_items())
    body = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for path, modified in urls:
        body.append('<url><loc>{}</loc>{}</url>'.format(
            escape(origin + path),
            f'<lastmod>{modified.isoformat()}</lastmod>' if modified else '',
        ))
    body.append('</urlset>')
    return HttpResponse('\n'.join(body), content_type='application/xml; charset=utf-8')


def robots_txt(request):
    origin = request.build_absolute_uri('/').rstrip('/')
    return HttpResponse(
        f'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: {origin}/sitemap.xml\n',
        content_type='text/plain; charset=utf-8',
    )
