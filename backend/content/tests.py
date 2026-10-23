from django.contrib.auth import get_user_model
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
    def setUp(self): self.client = APIClient()
    def test_non_staff_user_cannot_login_to_creator_studio(self):
        user = get_user_model().objects.create_user(username='visitor', password='Sufficiently-long-pass-123!')
        response = self.client.post('/api/v1/auth/login/', {'username': 'visitor', 'password': 'Sufficiently-long-pass-123!'}, format='json')
        self.assertEqual(response.status_code, 400)
