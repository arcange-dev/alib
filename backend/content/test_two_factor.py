import time

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from content.models import AuditEvent, StaffTwoFactor
from content.two_factor import code_for_step, decrypt_secret, encrypt_secret, generate_secret


class StaffTwoFactorTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username='secure-editor', email='secure-editor@example.com',
            password='ALIB-Two-Factor-Test-Password-2026!', is_staff=True,
        )

    def test_secret_is_encrypted_at_rest_and_authenticator_setup_enables(self):
        status = self.client.force_authenticate(user=self.user)
        try:
            response = self.client.get('/api/v1/auth/2fa/')
            self.assertEqual(response.status_code, 200)
            self.assertFalse(response.data['enabled'])
            self.assertTrue(response.data['secret'])
            self.assertTrue(response.data['otpauth_uri'].startswith('otpauth://totp/ALIB'))
            state = StaffTwoFactor.objects.get(user=self.user)
            self.assertNotEqual(state.secret_encrypted, response.data['secret'])
            self.assertEqual(decrypt_secret(state.secret_encrypted), response.data['secret'])
            step = int(time.time() // 30)
            code = code_for_step(response.data['secret'], step)
            enabled = self.client.post('/api/v1/auth/2fa/', {'action': 'enable', 'code': code}, format='json')
            self.assertEqual(enabled.status_code, 200)
            state.refresh_from_db()
            self.assertTrue(state.enabled)
            self.assertEqual(state.last_verified_step, step)
            self.assertTrue(AuditEvent.objects.filter(action='auth.2fa_enabled', actor=self.user).exists())
            self.assertEqual(self.client.get('/api/v1/auth/2fa/').data['secret'], '')
        finally:
            self.client.force_authenticate(user=None)

    def test_enabled_two_factor_requires_valid_challenge_code_and_blocks_replay(self):
        secret = generate_secret()
        state = StaffTwoFactor.objects.create(user=self.user, secret_encrypted=encrypt_secret(secret), enabled=True)
        login_response = self.client.post('/api/v1/auth/login/', {
            'username': 'secure-editor', 'password': 'ALIB-Two-Factor-Test-Password-2026!',
        }, format='json')
        self.assertEqual(login_response.status_code, 200)
        self.assertTrue(login_response.data['requires_two_factor'])
        self.assertIn('challenge', login_response.data)
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 403)
        step = int(time.time() // 30)
        code = code_for_step(secret, step)
        verified = self.client.post('/api/v1/auth/2fa/verify-login/', {
            'challenge': login_response.data['challenge'], 'code': code,
        }, format='json')
        self.assertEqual(verified.status_code, 200)
        self.assertEqual(verified.data['user']['username'], 'secure-editor')
        self.assertEqual(self.client.get('/api/v1/auth/me/').status_code, 200)
        replay = self.client.post('/api/v1/auth/2fa/verify-login/', {
            'challenge': login_response.data['challenge'], 'code': code,
        }, format='json')
        self.assertEqual(replay.status_code, 400)
        state.refresh_from_db()
        self.assertGreaterEqual(state.last_verified_step, step)
        self.assertTrue(AuditEvent.objects.filter(action='auth.2fa_login', actor=self.user).exists())

    def test_bad_authenticator_code_does_not_enable_two_factor(self):
        self.client.force_authenticate(user=self.user)
        self.client.get('/api/v1/auth/2fa/')
        response = self.client.post('/api/v1/auth/2fa/', {'action': 'enable', 'code': 'invalid'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(StaffTwoFactor.objects.get(user=self.user).enabled)
