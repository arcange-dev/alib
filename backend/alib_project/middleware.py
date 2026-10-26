"""Security middleware: strict Content-Security-Policy for the single-origin app."""
from django.conf import settings


class ContentSecurityPolicyMiddleware:
    """Sets a conservative CSP. Fonts come from Google Fonts; images from any https source."""

    POLICY = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' https: data: blob:; "
        "connect-src 'self'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none'"
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not response.headers.get('Content-Security-Policy'):
            response.headers['Content-Security-Policy'] = self.POLICY
        return response
