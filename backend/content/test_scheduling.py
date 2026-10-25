from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from content.models import ContentItem


class PublishScheduledCommandTests(TestCase):
    def test_publishes_only_due_public_scheduled_content_idempotently(self):
        due = ContentItem.objects.create(title='Due item', status='scheduled', visibility='public', scheduled_for=timezone.now() - timedelta(minutes=5))
        future = ContentItem.objects.create(title='Future item', status='scheduled', visibility='public', scheduled_for=timezone.now() + timedelta(days=1))
        private = ContentItem.objects.create(title='Private due item', status='scheduled', visibility='private', scheduled_for=timezone.now() - timedelta(minutes=5))
        from django.core.management import call_command
        call_command('publish_scheduled')
        due.refresh_from_db()
        future.refresh_from_db()
        private.refresh_from_db()
        self.assertEqual(due.status, 'published')
        self.assertIsNotNone(due.published_at)
        self.assertEqual(future.status, 'scheduled')
        self.assertEqual(private.status, 'scheduled')
        call_command('publish_scheduled')
        self.assertEqual(ContentItem.objects.filter(status='published').count(), 1)
