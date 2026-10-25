import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from .models import ContentItem


class PublicContentTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        ContentItem.objects.create(title='Public note', slug='public-note', status='published', visibility='public')
        ContentItem.objects.create(title='Private draft', slug='private-draft', status='draft', visibility='private')

    def test_anonymous_content_list_excludes_drafts_and_private(self):
        response = self.client.get('/api/v1/content/')
        self.assertEqual(response.status_code, 200)
        titles = [item['title'] for item in response.data['results']]
        self.assertIn('Public note', titles)
        self.assertNotIn('Private draft', titles)

    def test_anonymous_cannot_create_content(self):
        response = self.client.post('/api/v1/content/', {'title': 'Unapproved'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_admin_can_create_content(self):
        user = get_user_model().objects.create_user(username='writer', password='Sufficiently-long-pass-123!', is_staff=True)
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/content/', {'title': 'First published item', 'status': 'published', 'visibility': 'public', 'content_type': 'article'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['slug'], 'first-published-item')
        self.assertIsNotNone(response.data['published_at'])

    def test_private_detail_is_not_found_for_anonymous(self):
        response = self.client.get('/api/v1/content/by-slug/private-draft/')
        self.assertEqual(response.status_code, 404)


class SessionAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_non_staff_user_cannot_login_to_creator_studio(self):
        user = get_user_model().objects.create_user(username='visitor', password='Sufficiently-long-pass-123!')
        response = self.client.post('/api/v1/auth/login/', {'username': 'visitor', 'password': 'Sufficiently-long-pass-123!'}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_session_endpoint_reports_anonymous_and_staff_without_403(self):
        response = self.client.get('/api/v1/auth/session/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['authenticated'])

        staff = get_user_model().objects.create_user(
            username='staffer', email='staffer@example.com', password='Sufficiently-long-pass-123!', is_staff=True)
        self.client.force_login(staff)
        response = self.client.get('/api/v1/auth/session/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['authenticated'])
        self.assertEqual(response.data['user']['username'], 'staffer')
        self.assertEqual(response.data['user']['is_staff'], True)

        visitor = get_user_model().objects.create_user(username='plain', password='Sufficiently-long-pass-123!')
        self.client.force_login(visitor)
        response = self.client.get('/api/v1/auth/session/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['authenticated'])


class BootstrapAdminCommandTests(TestCase):
    def _env(self, username="", email="", password=""):
        return patch.dict(os.environ, {
            "ALIB_BOOTSTRAP_ADMIN_USERNAME": username,
            "ALIB_BOOTSTRAP_ADMIN_EMAIL": email,
            "ALIB_BOOTSTRAP_ADMIN_PASSWORD": password,
        })

    def test_bootstrap_is_a_noop_when_not_configured(self):
        output = StringIO()
        with self._env():
            call_command("bootstrap_admin", stdout=output)
        self.assertIn("not configured", output.getvalue())
        self.assertEqual(get_user_model().objects.filter(is_superuser=True).count(), 0)

    def test_bootstrap_creates_first_superuser(self):
        username = "alib-owner"
        email = "owner@example.com"
        password = "ALIB-First-Owner-Strong-Password-2026!"
        output = StringIO()
        with self._env(username, email, password):
            call_command("bootstrap_admin", stdout=output)
        user = get_user_model().objects.get(username=username)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.check_password(password))
        self.assertNotIn(password, output.getvalue())

    def test_existing_superuser_prevents_creating_another(self):
        User = get_user_model()
        User.objects.create_superuser(username="already-owner", email="owner@example.com", password="ALIB-Existing-Owner-Password-2026!")
        output = StringIO()
        with self._env("second-owner", "second@example.com", "ALIB-Second-Owner-Password-2026!"):
            call_command("bootstrap_admin", stdout=output)
        self.assertEqual(User.objects.filter(is_superuser=True).count(), 1)
        self.assertIn("already exists", output.getvalue())

    def test_partial_bootstrap_environment_fails_safely(self):
        with self._env(username="owner"):
            with self.assertRaises(CommandError):
                call_command("bootstrap_admin")
