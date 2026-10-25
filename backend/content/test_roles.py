from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.test import TestCase
from rest_framework.test import APIClient

from content.models import ContentItem, VisitorSuggestion
from content.permissions import ADMIN_GROUP, EDITOR_GROUP, MODERATOR_GROUP, SUPPORT_GROUP


class CreatorStudioRoleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.User = get_user_model()
        self.editor = self._staff('editor', EDITOR_GROUP)
        self.moderator = self._staff('moderator', MODERATOR_GROUP)
        self.support = self._staff('support', SUPPORT_GROUP)
        self.owner = self.User.objects.create_superuser(
            username='owner', email='owner@example.com', password='ALIB-Role-Test-Owner-Password-2026!'
        )

    def _staff(self, username, group_name):
        user = self.User.objects.create_user(
            username=username, email=f'{username}@example.com',
            password='ALIB-Role-Test-Password-2026!', is_staff=True,
        )
        group, _ = Group.objects.get_or_create(name=group_name)
        user.groups.add(group)
        return user

    def test_editor_can_manage_content_but_not_team_or_site_settings(self):
        self.client.force_authenticate(user=self.editor)
        created = self.client.post('/api/v1/content/', {'title': 'Editor draft', 'body': 'Text', 'status': 'draft', 'visibility': 'private'}, format='json')
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.client.get('/api/v1/admin/team/').status_code, 403)
        self.assertEqual(self.client.put('/api/v1/admin/settings/', {'site_title': 'No'}, format='json').status_code, 403)

    def test_moderator_can_review_suggestions_but_cannot_edit_content(self):
        suggestion = VisitorSuggestion.objects.create(title='Recommended site', url='https://example.com')
        self.client.force_authenticate(user=self.moderator)
        reviewed = self.client.post(f'/api/v1/suggestions/{suggestion.pk}/review/', {'status': 'approved'}, format='json')
        self.assertEqual(reviewed.status_code, 200)
        self.assertEqual(self.client.post('/api/v1/content/', {'title': 'Not allowed'}, format='json').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/admin/contact/').status_code, 200)

    def test_support_can_view_analytics_but_cannot_moderate(self):
        self.client.force_authenticate(user=self.support)
        self.assertEqual(self.client.get('/api/v1/admin/analytics/').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/admin/contact/').status_code, 403)

    @patch('content.views.send_mail', return_value=1)
    def test_owner_can_invite_editor_and_invitation_requires_password_setup(self, send_mail_mock):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post('/api/v1/admin/team/', {
            'username': 'new-editor', 'email': 'new-editor@example.com', 'role': 'editor',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        member = self.User.objects.get(username='new-editor')
        self.assertTrue(member.is_staff)
        self.assertFalse(member.has_usable_password())
        self.assertTrue(member.groups.filter(name=EDITOR_GROUP).exists())
        self.assertIn('/reset-password?uid=', send_mail_mock.call_args.args[1])

    @patch('content.views.send_mail', return_value=0)
    def test_invitation_failure_does_not_leave_staff_account(self, send_mail_mock):
        self.client.force_authenticate(user=self.owner)
        response = self.client.post('/api/v1/admin/team/', {
            'username': 'mail-failed', 'email': 'mail-failed@example.com', 'role': 'editor',
        }, format='json')
        self.assertEqual(response.status_code, 503)
        self.assertFalse(self.User.objects.filter(username='mail-failed').exists())

    def test_editor_cannot_escalate_another_user_to_administrator(self):
        self.client.force_authenticate(user=self.editor)
        response = self.client.patch(f'/api/v1/admin/team/{self.moderator.pk}/', {'role': 'administrator'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_moderator_does_not_receive_unpublished_content(self):
        ContentItem.objects.create(title='Private material', status='draft', visibility='private')
        self.client.force_authenticate(user=self.moderator)
        response = self.client.get('/api/v1/content/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('Private material', [item['title'] for item in response.data['results']])
