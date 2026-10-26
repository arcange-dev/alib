from uuid import uuid4
from django.conf import settings
from django.db import models
from django.utils import timezone
from datetime import timedelta
from django.utils import timezone
from django.utils.text import slugify

# --- Creator studio login hardening -----------------------------------------

LOGIN_FAILURE_LIMIT = 5
LOGIN_LOCKOUT_MINUTES = 15


def _lockout_deadline(attempt):
    return attempt.locked_until + timedelta(seconds=1) if attempt.locked_until else None


def login_lockout(username):
    """Return (locked, seconds_remaining) for the account's failed-login state."""
    key = str(username).strip().lower()[:150]
    attempt = LoginAttempt.objects.filter(username=key).first()
    if attempt is None or attempt.locked_until is None:
        return False, 0
    remaining = (attempt.locked_until - timezone.now()).total_seconds()
    if remaining <= 0:
        attempt.locked_until = None
        attempt.failed_count = 0
        attempt.save(update_fields=['locked_until', 'failed_count'])
        return False, 0
    return True, max(remaining, 1)


def record_login_failure(username):
    key = str(username).strip().lower()[:150]
    attempt, _ = LoginAttempt.objects.get_or_create(username=key)
    attempt.failed_count += 1
    attempt.last_attempt_at = timezone.now()
    if attempt.failed_count >= LOGIN_FAILURE_LIMIT:
        attempt.locked_until = timezone.now() + timedelta(minutes=LOGIN_LOCKOUT_MINUTES)
        attempt.failed_count = 0
        locked = True
    else:
        locked = False
    attempt.save(update_fields=['failed_count', 'locked_until', 'last_attempt_at'])
    return locked


def record_login_success(username):
    key = str(username).strip().lower()[:150]
    LoginAttempt.objects.filter(username=key).delete()


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True

class CreatorProfile(TimestampedModel):
    display_name = models.CharField(max_length=120, default='Mukamyi Izere Arcange')
    headline = models.CharField(max_length=240, default='A home for ideas worth keeping.')
    biography = models.TextField(blank=True, default='A personal space for work in progress, useful links, thoughtful notes, and the things worth returning to.')
    avatar_url = models.URLField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    social_links = models.JSONField(default=dict, blank=True)
    def __str__(self): return self.display_name

class SiteSettings(TimestampedModel):
    site_title = models.CharField(max_length=140, default='ALIB — Digital Home')
    logo_url = models.URLField(blank=True)
    favicon_url = models.URLField(blank=True)
    seo_description = models.CharField(max_length=300, blank=True)
    homepage_sections = models.JSONField(default=list, blank=True)
    theme_preferences = models.JSONField(default=dict, blank=True)
    owner_name = models.CharField(max_length=160, default='Mukamyi Izere Arcange')
    copyright_text = models.CharField(max_length=240, default='© {year} {owner_name}. All rights reserved.')
    youtube_url = models.URLField(blank=True)
    site_copy = models.JSONField(default=dict, blank=True)
    def __str__(self): return self.site_title

def _unique_generated_slug(instance, value, max_length):
    """Generate a collision-free slug when a model derives it from a title/name."""
    base = slugify(value)[:max_length]
    if not base:
        base = f"{instance._meta.model_name}-{uuid4().hex[:8]}"[:max_length]
    queryset = instance.__class__.objects.all()
    if instance.pk:
        queryset = queryset.exclude(pk=instance.pk)
    candidate = base
    suffix = 2
    while queryset.filter(slug=candidate).exists():
        ending = f"-{suffix}"
        candidate = f"{base[:max_length - len(ending)]}{ending}"
        suffix += 1
    return candidate


class Category(TimestampedModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.CharField(max_length=300, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    class Meta:
        ordering = ['display_order', 'name']
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = _unique_generated_slug(self, self.name, 120)
        super().save(*args, **kwargs)
    def __str__(self): return self.name

class Tag(TimestampedModel):
    name = models.CharField(max_length=70, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = _unique_generated_slug(self, self.name, 80)
        super().save(*args, **kwargs)
    def __str__(self): return self.name

class Collection(TimestampedModel):
    title = models.CharField(max_length=180)
    slug = models.SlugField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    cover_image_url = models.URLField(blank=True)
    visibility = models.CharField(max_length=12, choices=[('public', 'Public'), ('unlisted', 'Unlisted'), ('private', 'Private')], default='public')
    display_order = models.PositiveIntegerField(default=0)
    items = models.ManyToManyField('ContentItem', through='CollectionItem', related_name='collections', blank=True)
    class Meta:
        ordering = ['display_order', '-updated_at']
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = _unique_generated_slug(self, self.title, 200)
        super().save(*args, **kwargs)
    def __str__(self): return self.title

class ContentItem(TimestampedModel):
    CONTENT_TYPES = [
        ('article', 'Article'), ('note', 'Note'), ('link', 'Website / Link'), ('project', 'Project'),
        ('video', 'Video'), ('book', 'Book'), ('resource', 'Resource'), ('file', 'File'),
        ('gallery', 'Gallery'), ('podcast', 'Podcast'),
    ]
    STATUSES = [('draft', 'Draft'), ('published', 'Published'), ('scheduled', 'Scheduled'), ('archived', 'Archived')]
    VISIBILITY = [('public', 'Public'), ('unlisted', 'Unlisted'), ('private', 'Private')]
    title = models.CharField(max_length=240)
    slug = models.SlugField(max_length=260, unique=True, blank=True)
    summary = models.CharField(max_length=500, blank=True)
    body = models.TextField(blank=True)
    content_type = models.CharField(max_length=16, choices=CONTENT_TYPES, default='article', db_index=True)
    source_url = models.URLField(max_length=2000, blank=True)
    cover_image_url = models.URLField(max_length=2000, blank=True)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name='content_items')
    tags = models.ManyToManyField(Tag, blank=True, related_name='content_items')
    visibility = models.CharField(max_length=12, choices=VISIBILITY, default='public', db_index=True)
    status = models.CharField(max_length=12, choices=STATUSES, default='draft', db_index=True)
    featured = models.BooleanField(default=False, db_index=True)
    view_count = models.PositiveIntegerField(default=0, db_index=True)
    allow_download = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='alib_content')
    metadata = models.JSONField(default=dict, blank=True)
    class Meta:
        ordering = ['-published_at', '-created_at']
        indexes = [models.Index(fields=['status', 'visibility', '-published_at'], name='alib_pub_state_idx'), models.Index(fields=['content_type', 'status'], name='alib_type_state_idx')]
    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.title)[:230] or f'item-{uuid4().hex[:8]}'
            candidate, suffix = base, 2
            qs = ContentItem.objects.all()
            if self.pk: qs = qs.exclude(pk=self.pk)
            while qs.filter(slug=candidate).exists():
                candidate = f'{base[:245]}-{suffix}'
                suffix += 1
            self.slug = candidate
        if self.status == 'published' and self.published_at is None:
            self.published_at = timezone.now()
        super().save(*args, **kwargs)
    def __str__(self): return self.title

class CollectionItem(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE)
    item = models.ForeignKey(ContentItem, on_delete=models.CASCADE)
    display_order = models.PositiveIntegerField(default=0)
    added_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['display_order', '-added_at']
        constraints = [models.UniqueConstraint(fields=['collection', 'item'], name='unique_collection_item')]

class MediaAsset(TimestampedModel):
    VISIBILITY = [('public', 'Public'), ('unlisted', 'Unlisted'), ('private', 'Private')]
    title = models.CharField(max_length=200, blank=True)
    description = models.CharField(max_length=500, blank=True)
    alt_text = models.CharField(max_length=300, blank=True)
    original_filename = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=700, unique=True)
    mime_type = models.CharField(max_length=120)
    file_size = models.PositiveBigIntegerField(default=0)
    visibility = models.CharField(max_length=12, choices=VISIBILITY, default='private', db_index=True)
    downloadable = models.BooleanField(default=False)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    def __str__(self): return self.title or self.original_filename

class VisitorSuggestion(TimestampedModel):
    title = models.CharField(max_length=240)
    url = models.URLField(max_length=2000)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')], default='pending', db_index=True)
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    def __str__(self): return self.title

class ContactMessage(TimestampedModel):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    message = models.TextField(max_length=5000)
    reviewed = models.BooleanField(default=False, db_index=True)
    archived = models.BooleanField(default=False, db_index=True)
    def __str__(self): return f'{self.name} — {self.created_at:%Y-%m-%d}'

class ContentRevision(models.Model):
    item = models.ForeignKey(ContentItem, on_delete=models.CASCADE, related_name='revisions')
    revision_number = models.PositiveIntegerField()
    snapshot = models.JSONField(default=dict)
    editor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        ordering = ['-revision_number']
        constraints = [models.UniqueConstraint(fields=['item', 'revision_number'], name='unique_content_revision_number')]
    def __str__(self):
        return f'{self.item_id} revision {self.revision_number}'


class AnalyticsEvent(models.Model):
    EVENT_TYPES = [('page_view', 'Page view'), ('outbound_click', 'Outbound click'), ('search', 'Search')]
    event_type = models.CharField(max_length=24, choices=EVENT_TYPES, db_index=True)
    path = models.CharField(max_length=512, blank=True)
    referrer = models.URLField(max_length=1000, blank=True)
    visitor_hash = models.CharField(max_length=64, blank=True, db_index=True)
    item = models.ForeignKey(ContentItem, null=True, blank=True, on_delete=models.SET_NULL, related_name='analytics_events')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['event_type', 'created_at'], name='content_ana_event_t_6b18c1_idx'), models.Index(fields=['path', 'created_at'], name='content_ana_path_72f48a_idx')]


class NewsletterSubscriber(models.Model):
    email = models.EmailField(unique=True)
    token_hash = models.CharField(max_length=64, blank=True, null=True, unique=True)
    confirmed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    def __str__(self):
        return self.email


class ContentReaction(models.Model):
    REACTION_TYPES = [('like', 'Like'), ('love', 'Love'), ('useful', 'Useful')]
    item = models.ForeignKey(ContentItem, on_delete=models.CASCADE, related_name='reactions')
    reaction = models.CharField(max_length=12, choices=REACTION_TYPES)
    visitor_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['item', 'reaction', 'visitor_hash'], name='unique_item_visitor_reaction')]


class ContentComment(models.Model):
    STATUSES = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')]
    item = models.ForeignKey(ContentItem, on_delete=models.CASCADE, related_name='comments')
    name = models.CharField(max_length=120)
    email = models.EmailField()
    body = models.TextField(max_length=3000)
    status = models.CharField(max_length=12, choices=STATUSES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    moderated_at = models.DateTimeField(null=True, blank=True)
    moderated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    class Meta:
        ordering = ['-created_at']


class StaffTwoFactor(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alib_two_factor')
    secret_encrypted = models.TextField(blank=True)
    enabled = models.BooleanField(default=False, db_index=True)
    last_verified_step = models.BigIntegerField(default=-1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Two-factor for user {self.user_id}'


class LoginAttempt(models.Model):
    """Tracks failed creator-studio sign-ins so accounts can be temporarily locked."""
    username = models.CharField(max_length=150, unique=True, db_index=True)
    failed_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    class Meta: ordering = ['-last_attempt_at']
    def __str__(self): return f'{self.username} (failed {self.failed_count})'


class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=120)
    object_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta: ordering = ['-created_at']
    def __str__(self): return f'{self.action} ({self.created_at:%Y-%m-%d %H:%M})'
