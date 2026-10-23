from uuid import uuid4
from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        abstract = True

class CreatorProfile(TimestampedModel):
    display_name = models.CharField(max_length=120, default='Your name')
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
    def __str__(self): return self.site_title

class Category(TimestampedModel):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.CharField(max_length=300, blank=True)
    display_order = models.PositiveIntegerField(default=0)
    class Meta:
        ordering = ['display_order', 'name']
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.name)
        super().save(*args, **kwargs)
    def __str__(self): return self.name

class Tag(TimestampedModel):
    name = models.CharField(max_length=70, unique=True)
    slug = models.SlugField(max_length=80, unique=True)
    def save(self, *args, **kwargs):
        if not self.slug: self.slug = slugify(self.name)
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
        if not self.slug: self.slug = slugify(self.title)
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
    allow_download = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True, db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, db_index=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='alib_content')
    metadata = models.JSONField(default=dict, blank=True)
    class Meta:
        ordering = ['-published_at', '-created_at']
        indexes = [models.Index(fields=['status', 'visibility', '-published_at']), models.Index(fields=['content_type', 'status'])]
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
    def __str__(self): return f'{self.name} — {self.created_at:%Y-%m-%d}'

class AuditEvent(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=120)
    object_type = models.CharField(max_length=100, blank=True)
    object_id = models.CharField(max_length=100, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    class Meta: ordering = ['-created_at']
    def __str__(self): return f'{self.action} ({self.created_at:%Y-%m-%d %H:%M})'
