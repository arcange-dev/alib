from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from content.models import (
    AnalyticsEvent,
    ContactMessage,
    ContentComment,
    ContentItem,
    ContentRevision,
    ContentReaction,
    NewsletterSubscriber,
    SiteSettings,
    VisitorSuggestion,
)


class CompletionPublicApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.published = ContentItem.objects.create(
            title='Public release note',
            slug='public-release-note',
            summary='A public summary',
            body='A public body',
            status='published',
            visibility='public',
        )
        self.private = ContentItem.objects.create(
            title='Secret draft',
            slug='secret-draft',
            status='draft',
            visibility='private',
        )

    def test_rss_feed_only_lists_published_public_content(self):
        response = self.client.get('/feed.xml')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/rss+xml', response['Content-Type'])
        self.assertContains(response, 'Public release note')
        self.assertNotContains(response, 'Secret draft')

    def test_sitemap_omits_private_and_unpublished_items(self):
        response = self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, '/content/public-release-note')
        self.assertNotContains(response, 'secret-draft')

    def test_robots_txt_points_to_sitemap_and_disallows_admin(self):
        response = self.client.get('/robots.txt')
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Disallow: /admin')
        self.assertContains(response, '/sitemap.xml')

    def test_public_site_settings_has_safe_defaults(self):
        response = self.client.get('/api/v1/settings/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['theme_preferences']['primary'], '#2563eb')
        self.assertEqual(response.data['theme_preferences']['secondary'], '#facc15')

    def test_analytics_accepts_local_path_and_rejects_external_or_api_path(self):
        response = self.client.post('/api/v1/analytics/event/', {'event_type': 'page_view', 'path': '/discover'}, format='json')
        self.assertEqual(response.status_code, 202)
        self.assertEqual(AnalyticsEvent.objects.count(), 1)
        self.assertEqual(self.client.post('/api/v1/analytics/event/', {'event_type': 'page_view', 'path': '//evil.example'}, format='json').status_code, 400)
        self.assertEqual(self.client.post('/api/v1/analytics/event/', {'event_type': 'page_view', 'path': '/api/v1/content/'}, format='json').status_code, 400)

    def test_reactions_are_counted_and_duplicate_reaction_is_idempotent(self):
        first = self.client.post(f'/api/v1/content/{self.published.pk}/reactions/', {'reaction': 'like'}, format='json')
        second = self.client.post(f'/api/v1/content/{self.published.pk}/reactions/', {'reaction': 'like'}, format='json')
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(ContentReaction.objects.filter(item=self.published, reaction='like').count(), 1)
        self.assertEqual(second.data['counts']['like'], 1)

    def test_public_comment_is_saved_pending_and_not_returned_publicly_until_moderated(self):
        response = self.client.post('/api/v1/comments/', {
            'item_id': self.published.pk,
            'name': 'Reader',
            'email': 'reader@example.com',
            'body': 'A useful comment for the article.',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(ContentComment.objects.count(), 1)
        public_comments = self.client.get(f'/api/v1/comments/?item_id={self.published.pk}')
        self.assertEqual(public_comments.status_code, 200)
        self.assertEqual(public_comments.data['results'], [])

    def test_comment_submission_is_rejected_for_private_item(self):
        response = self.client.post('/api/v1/comments/', {
            'item_id': self.private.pk,
            'name': 'Reader',
            'email': 'reader@example.com',
            'body': 'A comment on a private draft.',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ContentComment.objects.count(), 0)

    @patch('content.views.send_mail', return_value=1)
    def test_newsletter_requires_confirmation_and_supplies_unsubscribe_link(self, send_mail_mock):
        response = self.client.post('/api/v1/newsletter/subscribe/', {'email': 'reader@example.com'}, format='json')
        self.assertEqual(response.status_code, 202)
        subscriber = NewsletterSubscriber.objects.get(email='reader@example.com')
        self.assertFalse(subscriber.is_active)
        self.assertTrue(subscriber.token_hash)
        email_body = send_mail_mock.call_args.args[1]
        self.assertIn('/api/v1/newsletter/confirm/', email_body)
        self.assertIn('/api/v1/newsletter/unsubscribe/', email_body)

    @patch('content.views.send_mail', return_value=1)
    def test_newsletter_confirmation_and_unsubscribe(self, send_mail_mock):
        self.client.post('/api/v1/newsletter/subscribe/', {'email': 'reader@example.com'}, format='json')
        email_body = send_mail_mock.call_args.args[1]
        import re
        confirm_token = re.search(r'/api/v1/newsletter/confirm/([^/]+)/', email_body).group(1)
        confirm = self.client.get(f'/api/v1/newsletter/confirm/{confirm_token}/')
        self.assertEqual(confirm.status_code, 200)
        subscriber = NewsletterSubscriber.objects.get(email='reader@example.com')
        self.assertTrue(subscriber.is_active)
        unsubscribe_query = re.search(r'/api/v1/newsletter/unsubscribe/\?([^\s]+)', email_body).group(1)
        from urllib.parse import parse_qs
        params = parse_qs(unsubscribe_query)
        result = self.client.get('/api/v1/newsletter/unsubscribe/', {'email': params['email'][0], 'token': params['token'][0]})
        self.assertEqual(result.status_code, 200)
        subscriber.refresh_from_db()
        self.assertFalse(subscriber.is_active)

    def test_contact_messages_are_only_available_to_staff(self):
        ContactMessage.objects.create(name='Visitor', email='visitor@example.com', message='Please get back to me.')
        self.assertEqual(self.client.get('/api/v1/admin/contact/').status_code, 403)
        staff = get_user_model().objects.create_superuser(username='owner', email='owner@example.com', password='ALIB-Test-Owner-Password-2026!')
        self.client.force_authenticate(user=staff)
        response = self.client.get('/api/v1/admin/contact/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['email'], 'visitor@example.com')

    def test_settings_write_requires_staff_and_persists(self):
        denied = self.client.put('/api/v1/admin/settings/', {'site_title': 'Not allowed'}, format='json')
        self.assertEqual(denied.status_code, 403)
        staff = get_user_model().objects.create_superuser(username='owner', email='owner@example.com', password='ALIB-Test-Owner-Password-2026!')
        self.client.force_authenticate(user=staff)
        response = self.client.put('/api/v1/admin/settings/', {
            'site_title': 'ALIB — My Library',
            'seo_description': 'A curated digital library.',
            'homepage_sections': ['featured', 'latest'],
            'theme_preferences': {'primary': '#2563eb', 'secondary': '#facc15'},
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(SiteSettings.objects.get().site_title, 'ALIB — My Library')

    def test_content_create_and_update_generate_revisions(self):
        staff = get_user_model().objects.create_superuser(username='owner', email='owner@example.com', password='ALIB-Test-Owner-Password-2026!')
        self.client.force_authenticate(user=staff)
        created = self.client.post('/api/v1/content/', {'title': 'Revision One', 'body': 'First version', 'status': 'draft', 'visibility': 'private'}, format='json')
        self.assertEqual(created.status_code, 201)
        item_id = created.data['id']
        self.client.patch(f'/api/v1/content/{item_id}/', {'title': 'Revision Two', 'body': 'Second version'}, format='json')
        revisions = self.client.get(f'/api/v1/content/{item_id}/revisions/')
        self.assertEqual(revisions.status_code, 200)
        self.assertEqual(len(revisions.data), 2)
        first_id = next(row['id'] for row in revisions.data if row['snapshot']['title'] == 'Revision One')
        restored = self.client.post(f'/api/v1/content/{item_id}/restore-revision/', {'revision_id': first_id}, format='json')
        self.assertEqual(restored.status_code, 200)
        self.assertEqual(restored.data['title'], 'Revision One')
        self.assertEqual(ContentRevision.objects.filter(item_id=item_id).count(), 3)

    def test_suggestion_review_records_decision(self):
        anonymous = APIClient()
        created = anonymous.post('/api/v1/suggestions/', {'title': 'A useful website', 'url': 'https://example.com', 'reason': 'Useful reference'}, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data['status'], 'pending')
        staff = get_user_model().objects.create_superuser(username='owner', email='owner@example.com', password='ALIB-Test-Owner-Password-2026!')
        self.client.force_authenticate(user=staff)
        reviewed = self.client.post(f"/api/v1/suggestions/{created.data['id']}/review/", {'status': 'approved'}, format='json')
        self.assertEqual(reviewed.status_code, 200)
        self.assertEqual(VisitorSuggestion.objects.get(pk=created.data['id']).status, 'approved')
