from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from content.models import AuditEvent, ContentItem


class Command(BaseCommand):
    help = 'Publish due scheduled ALIB items; safe to run repeatedly from a scheduler.'

    def handle(self, *args, **options):
        now = timezone.now()
        published_count = 0
        with transaction.atomic():
            due_items = list(
                ContentItem.objects.select_for_update()
                .filter(status='scheduled', visibility='public', scheduled_for__lte=now)
                .order_by('scheduled_for', 'id')
            )
            for item in due_items:
                item.status = 'published'
                item.published_at = item.scheduled_for or now
                item.save(update_fields=['status', 'published_at', 'updated_at'])
                AuditEvent.objects.create(
                    actor=None,
                    action='content.scheduled_published',
                    object_type='ContentItem',
                    object_id=str(item.pk),
                    details={'slug': item.slug, 'scheduled_for': item.scheduled_for.isoformat() if item.scheduled_for else None},
                )
                published_count += 1
        self.stdout.write(self.style.SUCCESS(f'Published {published_count} due item(s).'))
