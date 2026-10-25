from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from content.models import AuditEvent, ContactMessage, ContentItem, VisitorSuggestion
from content.permissions import MODERATOR_GROUP
from django.contrib.auth.models import Group


class CompletionOperationsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _superuser(self):
        return get_user_model().objects.create_superuser(
            username='operations-owner', email='operations-owner@example.com',
            password='ALIB-Operations-Owner-Test-Password-2026!',
        )

    def test_public_slug_detail_is_available_by_slug_and_staff_can_preview_private_item(self):
        public = ContentItem.objects.create(title='Slug route', slug='slug-route', status='published', visibility='public')
        self.assertEqual(self.client.get('/api/v1/content/by-slug/slug-route/').status_code, 200)
        private = ContentItem.objects.create(title='Private preview', slug='private-preview', status='draft', visibility='private')
        self.assertEqual(self.client.get('/api/v1/content/by-slug/private-preview/').status_code, 404)
        owner = self._superuser()
        self.client.force_authenticate(user=owner)
        result = self.client.get('/api/v1/content/by-slug/private-preview/')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.data['id'], private.pk)

    def test_search_filters_by_tag_featured_and_date(self):
        from content.models import Tag
        tag = Tag.objects.create(name='release-notes', slug='release-notes')
        item = ContentItem.objects.create(
            title='Featured release', slug='featured-release', status='published',
            visibility='public', featured=True, published_at=timezone.now() - timedelta(days=2),
        )
        item.tags.add(tag)
        response = self.client.get('/api/v1/content/?tag=release-notes&featured=true')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row['id'] for row in response.data['results']], [item.pk])
        invalid = self.client.get('/api/v1/content/?from_date=not-a-date')
        self.assertEqual(invalid.status_code, 400)

    def test_bulk_suggestion_review_is_moderator_only_and_audited(self):
        first = VisitorSuggestion.objects.create(title='Site A', url='https://a.example.com')
        second = VisitorSuggestion.objects.create(title='Site B', url='https://b.example.com')
        self.assertEqual(self.client.post('/api/v1/suggestions/bulk-review/', {'ids': [first.pk, second.pk], 'status': 'approved'}, format='json').status_code, 403)
        user = get_user_model().objects.create_user(username='moderation-owner', password='ALIB-Moderator-Test-Password-2026!', is_staff=True)
        group, _ = Group.objects.get_or_create(name=MODERATOR_GROUP)
        user.groups.add(group)
        self.client.force_authenticate(user=user)
        response = self.client.post('/api/v1/suggestions/bulk-review/', {'ids': [first.pk, second.pk], 'status': 'approved'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['updated'], 2)
        self.assertEqual(VisitorSuggestion.objects.filter(status='approved').count(), 2)
        self.assertEqual(AuditEvent.objects.filter(action='suggestion.bulk_reviewed').count(), 2)

    def test_duplicate_nonrejected_suggestion_url_is_blocked(self):
        VisitorSuggestion.objects.create(title='Existing link', url='https://example.com/reference')
        response = self.client.post('/api/v1/suggestions/', {'title': 'Same link', 'url': 'https://example.com/reference', 'reason': 'Duplicate'}, format='json')
        self.assertEqual(response.status_code, 400)

    @override_settings(ALIB_SCHEDULER_TOKEN='scheduler-token-for-testing-which-is-long-enough-123456')
    def test_secret_scheduler_endpoint_publishes_due_content_and_rejects_missing_token(self):
        due = ContentItem.objects.create(title='Scheduler due', status='scheduled', visibility='public', scheduled_for=timezone.now() - timedelta(minutes=10))
        denied = self.client.post('/api/v1/admin/maintenance/publish-scheduled/', {}, format='json')
        self.assertEqual(denied.status_code, 403)
        result = self.client.post(
            '/api/v1/admin/maintenance/publish-scheduled/', {}, format='json',
            HTTP_X_ALIB_SCHEDULER_TOKEN='scheduler-token-for-testing-which-is-long-enough-123456',
        )
        self.assertEqual(result.status_code, 200)
        due.refresh_from_db()
        self.assertEqual(due.status, 'published')

    @override_settings(ALIB_CONTACT_NOTIFICATION_EMAIL='creator@example.com')
    @patch('content.views.send_mail', return_value=1)
    def test_contact_message_is_persisted_and_creator_notified_when_configured(self, send_mail_mock):
        response = self.client.post('/api/v1/contact/', {'name': 'Reader', 'email': 'reader@example.com', 'message': 'A complete message for the creator.'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['notification_sent'])
        self.assertEqual(ContactMessage.objects.count(), 1)
        send_mail_mock.assert_called_once()

    def test_audit_and_newsletter_export_are_owner_only(self):
        self.assertEqual(self.client.get('/api/v1/admin/audit/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/admin/newsletter/?export=csv').status_code, 403)
        self.client.force_authenticate(user=self._superuser())
        self.assertEqual(self.client.get('/api/v1/admin/audit/').status_code, 200)
        export = self.client.get('/api/v1/admin/newsletter/?format=csv')
        self.assertEqual(export.status_code, 200)
        self.assertIn('text/csv', export['Content-Type'])
