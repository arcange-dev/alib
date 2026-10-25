import logging

from django.db import connection
from django.http import JsonResponse

logger = logging.getLogger(__name__)


def health_check(request):
    """Return readiness only when the application database is reachable."""
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            row = cursor.fetchone()
            if not row or row[0] != 1:
                raise RuntimeError("Database readiness query did not return the expected result.")
    except Exception:
        logger.warning("ALIB readiness check could not reach the configured database.")
        return JsonResponse(
            {"status": "unavailable", "service": "alib-api", "database": "unavailable"},
            status=503,
        )
    return JsonResponse({"status": "ok", "service": "alib-api", "database": "ok"})
