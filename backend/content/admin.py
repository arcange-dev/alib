from django.contrib import admin
from .models import AuditEvent, Category, Collection, CollectionItem, ContactMessage, ContentItem, CreatorProfile, MediaAsset, SiteSettings, Tag, VisitorSuggestion

@admin.register(ContentItem)
class ContentItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'content_type', 'status', 'visibility', 'featured', 'updated_at')
    list_filter = ('content_type', 'status', 'visibility', 'featured')
    search_fields = ('title', 'summary', 'body', 'slug')
    prepopulated_fields = {'slug': ('title',)}
    filter_horizontal = ('tags',)

@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'visibility', 'display_order', 'updated_at')
    list_filter = ('visibility',)
    search_fields = ('title', 'description', 'slug')

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'display_order')
    search_fields = ('name', 'description')

@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    search_fields = ('name', 'slug')

@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = ('title', 'original_filename', 'mime_type', 'file_size', 'visibility', 'downloadable')
    list_filter = ('mime_type', 'visibility', 'downloadable')
    search_fields = ('title', 'original_filename')

@admin.register(VisitorSuggestion)
class VisitorSuggestionAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('title', 'url', 'reason')

@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'reviewed', 'created_at')
    list_filter = ('reviewed',)
    search_fields = ('name', 'email', 'message')

admin.site.register(CreatorProfile)
admin.site.register(SiteSettings)
admin.site.register(AuditEvent)
admin.site.register(CollectionItem)
