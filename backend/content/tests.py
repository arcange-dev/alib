import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command, CommandError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient
from .models import ContentItem, MediaAsset


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

    def test_public_detail_increments_view_count_and_reports_read_time(self):
        response = self.client.get('/api/v1/content/by-slug/public-note/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['view_count'], 1)
        self.assertEqual(response.data['read_minutes'], 0)
        ContentItem.objects.filter(slug='public-note').update(body='word ' * 450)
        response = self.client.get('/api/v1/content/by-slug/public-note/')
        self.assertEqual(response.data['view_count'], 2)
        self.assertEqual(response.data['read_minutes'], 3)
        self.assertEqual(ContentItem.objects.get(slug='public-note').view_count, 2)

    def test_staff_detail_does_not_increment_view_count(self):
        user = get_user_model().objects.create_user(username='staffer', password='Sufficiently-long-pass-123!', is_staff=True)
        self.client.force_authenticate(user=user)
        self.client.get('/api/v1/content/by-slug/public-note/')
        self.assertEqual(ContentItem.objects.get(slug='public-note').view_count, 0)

    def test_analytics_includes_top_viewed_items(self):
        user = get_user_model().objects.create_user(username='adminviewer', password='Sufficiently-long-pass-123!', is_staff=True)
        ContentItem.objects.filter(slug='public-note').update(view_count=7)
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/v1/admin/analytics/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['top_viewed'][0]['title'], 'Public note')
        self.assertEqual(response.data['top_viewed'][0]['view_count'], 7)

    def test_private_detail_is_not_found_for_anonymous(self):
        response = self.client.get('/api/v1/content/by-slug/private-draft/')
        self.assertEqual(response.status_code, 404)


class SessionAuthenticationTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()

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


class MediaAssetAdminTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.staff = get_user_model().objects.create_user(
            username='media-staff', email='media@example.com',
            password='Sufficiently-long-pass-123!', is_staff=True)
        self.client.force_login(self.staff)

    def _asset(self, **overrides):
        defaults = dict(title='Cover art', original_filename='cover.png',
                        storage_path='abc123/cover.png', mime_type='image/png', file_size=10)
        defaults.update(overrides)
        return MediaAsset.objects.create(**defaults)

    def test_editor_can_edit_media_details(self):
        asset = self._asset()
        response = self.client.patch(f'/api/v1/admin/media/{asset.pk}/',
                                     {'title': 'New cover', 'description': 'Updated caption', 'alt_text': 'Alt text'},
                                     format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'New cover')
        asset.refresh_from_db()
        self.assertEqual(asset.description, 'Updated caption')
        self.assertEqual(asset.alt_text, 'Alt text')

    def test_editor_can_delete_media_and_storage_cleanup_is_attempted(self):
        asset = self._asset()
        with patch('content.views.delete_object', return_value=True) as storage_delete:
            response = self.client.delete(f'/api/v1/admin/media/{asset.pk}/')
        self.assertEqual(response.status_code, 204)
        storage_delete.assert_called_once_with('abc123/cover.png')
        self.assertFalse(MediaAsset.objects.filter(pk=asset.pk).exists())

    def test_delete_still_removes_the_record_when_storage_cleanup_fails(self):
        asset = self._asset(title='Orphaned', storage_path='zzz/gone.png')
        with patch('content.views.delete_object', side_effect=Exception('storage down')):
            response = self.client.delete(f'/api/v1/admin/media/{asset.pk}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(MediaAsset.objects.filter(pk=asset.pk).exists())

    def test_app_shell_is_served_without_browser_caching(self):
        # CI runs Django tests before the frontend build is copied in, so the
        # shell may be a 503 there; the cache header must be set either way.
        response = self.client.get('/')
        self.assertIn(response.status_code, (200, 503))
        self.assertEqual(response['Cache-Control'], 'no-cache, must-revalidate')

    def test_anonymous_user_cannot_edit_or_delete_media(self):
        client = APIClient()
        asset = self._asset()
        self.assertEqual(client.patch(f'/api/v1/admin/media/{asset.pk}/', {'title': 'Nope'}, format='json').status_code, 403)
        self.assertEqual(client.delete(f'/api/v1/admin/media/{asset.pk}/').status_code, 403)
        self.assertTrue(MediaAsset.objects.filter(pk=asset.pk).exists())


class LoginLockoutTests(TestCase):
    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def _staff_user(self, username='lockadmin', password='A-Safe-Passw0rd-2026'):
        from django.contrib.auth import get_user_model
        return get_user_model().objects.create_user(username=username, email=f'{username}@example.com', password=password, is_staff=True)

    def test_account_locks_after_five_failed_logins(self):
        user = self._staff_user()
        for _ in range(4):
            response = self.client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'wrong-pass'}, content_type='application/json')
            self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'wrong-pass'}, content_type='application/json')
        self.assertEqual(response.status_code, 429)
        self.assertIn('Too many failed attempts', response.data['detail'])

    def test_locked_account_rejects_correct_password(self):
        user = self._staff_user()
        for _ in range(5):
            self.client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'wrong-pass'}, content_type='application/json')
        response = self.client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'A-Safe-Passw0rd-2026'}, content_type='application/json')
        self.assertEqual(response.status_code, 429)

    def test_successful_login_resets_failure_counter(self):
        user = self._staff_user()
        for _ in range(4):
            self.client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'wrong-pass'}, content_type='application/json')
        response = self.client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'A-Safe-Passw0rd-2026'}, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        from content.models import LoginAttempt
        self.assertFalse(LoginAttempt.objects.filter(username=user.username.lower()).exists())
        from content.models import AuditEvent
        self.assertTrue(AuditEvent.objects.filter(action='auth.login', object_id=str(user.pk)).exists())
        self.assertTrue(AuditEvent.objects.filter(action='auth.login_failed').exists())

    def test_require_2fa_flag_blocks_staff_without_2fa(self):
        user = self._staff_user()
        with override_settings(ALIB_REQUIRE_2FA=True):
            response = self.client.post('/api/v1/auth/login/', {'username': user.username, 'password': 'A-Safe-Passw0rd-2026'}, content_type='application/json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('Two-factor authentication is required', response.data['detail'])

    def test_csp_header_present_on_public_pages(self):
        response = self.client.get('/')
        self.assertIn('Content-Security-Policy', response.headers)
        self.assertIn("default-src 'self'", response.headers['Content-Security-Policy'])
