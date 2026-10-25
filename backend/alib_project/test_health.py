from unittest.mock import patch

from django.db import OperationalError
from django.test import TestCase


class ReadinessHealthCheckTests(TestCase):
    def test_health_check_reports_database_ready(self):
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')
        self.assertEqual(response.json()['database'], 'ok')

    @patch('alib_project.health.connection.cursor', side_effect=OperationalError('private database details'))
    def test_health_check_fails_closed_when_database_is_unreachable(self, _cursor):
        response = self.client.get('/health/')
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['status'], 'unavailable')
        self.assertNotIn('private database details', response.content.decode())
