from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from content.models import ContactMessage


class ContactInboxArchiveTests(TestCase):
    def setUp(self):
        owner = get_user_model().objects.create_superuser(
            username='owner-test', email='owner-test@example.com', password='Long-Only-Test-Pass-2026!'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=owner)
        self.message = ContactMessage.objects.create(
            name='Reader', email='reader-test@example.com', message='A sample test message.'
        )

    def test_archive_restore_and_filter(self):
        response = self.client.patch(
            f'/api/v1/admin/contact/{self.message.pk}/',
            {'archived': True},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['archived'])
        inbox = self.client.get('/api/v1/admin/contact/')
        archive = self.client.get('/api/v1/admin/contact/?archived=true')
        self.assertEqual(inbox.data, [])
        self.assertEqual(len(archive.data), 1)
        restored = self.client.patch(
            f'/api/v1/admin/contact/{self.message.pk}/',
            {'archived': False, 'reviewed': True},
            format='json',
        )
        self.assertEqual(restored.status_code, 200)
        self.assertFalse(restored.data['archived'])
        self.assertTrue(restored.data['reviewed'])

    def test_anonymous_visitors_cannot_access_contact_inbox(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/v1/admin/contact/')
        self.assertIn(response.status_code, (401, 403))
