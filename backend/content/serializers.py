from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from .models import Category, Collection, CollectionItem, ContentComment, ContentItem, ContentRevision, CreatorProfile, MediaAsset, SiteSettings, Tag, VisitorSuggestion

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'display_order']
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'slug']
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}

class ContentItemSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(source='category', queryset=Category.objects.all(), write_only=True, required=False, allow_null=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.PrimaryKeyRelatedField(source='tags', queryset=Tag.objects.all(), many=True, write_only=True, required=False)
    collection_slugs = serializers.SerializerMethodField()

    class Meta:
        model = ContentItem
        fields = [
            'id', 'title', 'slug', 'summary', 'body', 'content_type', 'source_url', 'cover_image_url',
            'category', 'category_id', 'tags', 'tag_ids', 'collection_slugs', 'visibility', 'status',
            'featured', 'allow_download', 'published_at', 'scheduled_for', 'metadata', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'published_at', 'created_at', 'updated_at', 'collection_slugs']

    def get_collection_slugs(self, obj):
        return list(obj.collections.filter(visibility='public').values_list('slug', flat=True))

    def create(self, validated_data):
        tags = validated_data.pop('tags', [])
        item = super().create(validated_data)
        if tags:
            item.tags.set(tags)
        return item

    def update(self, instance, validated_data):
        tags = validated_data.pop('tags', None)
        item = super().update(instance, validated_data)
        if tags is not None:
            item.tags.set(tags)
        return item

class CollectionSerializer(serializers.ModelSerializer):
    item_count = serializers.SerializerMethodField()
    current_item_ids = serializers.SerializerMethodField()
    item_ids = serializers.PrimaryKeyRelatedField(source='items', queryset=ContentItem.objects.all(), many=True, write_only=True, required=False)
    class Meta:
        model = Collection
        fields = ['id', 'title', 'slug', 'description', 'cover_image_url', 'visibility', 'display_order', 'item_count', 'current_item_ids', 'item_ids', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at', 'item_count']
        extra_kwargs = {'slug': {'required': False, 'allow_blank': True}}
    def get_item_count(self, obj):
        return obj.items.filter(status='published', visibility='public', published_at__lte=timezone.now()).count()
    def get_current_item_ids(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated and request.user.is_staff:
            return list(CollectionItem.objects.filter(collection=obj).order_by('display_order', 'id').values_list('item_id', flat=True))
        return []
    @transaction.atomic
    def create(self, validated_data):
        items = validated_data.pop('items', [])
        collection = super().create(validated_data)
        for order, item in enumerate(items):
            CollectionItem.objects.get_or_create(collection=collection, item=item, defaults={'display_order': order})
        return collection
    @transaction.atomic
    def update(self, instance, validated_data):
        items = validated_data.pop('items', None)
        collection = super().update(instance, validated_data)
        if items is not None:
            CollectionItem.objects.filter(collection=collection).delete()
            for order, item in enumerate(items):
                CollectionItem.objects.create(collection=collection, item=item, display_order=order)
        return collection

class CreatorProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreatorProfile
        fields = ['display_name', 'headline', 'biography', 'avatar_url', 'location', 'social_links', 'updated_at']

class MediaAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaAsset
        fields = ['id', 'title', 'description', 'alt_text', 'original_filename', 'mime_type', 'file_size', 'visibility', 'downloadable', 'created_at', 'updated_at']
        read_only_fields = ['id', 'original_filename', 'mime_type', 'file_size', 'created_at', 'updated_at']

class VisitorSuggestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisitorSuggestion
        fields = ['id', 'title', 'url', 'reason', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'created_at', 'updated_at']


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = ['site_title', 'logo_url', 'favicon_url', 'seo_description', 'homepage_sections', 'theme_preferences', 'owner_name', 'copyright_text', 'site_copy', 'updated_at']
        read_only_fields = ['updated_at']


class ContentRevisionSerializer(serializers.ModelSerializer):
    editor_username = serializers.CharField(source='editor.username', read_only=True, default='')
    class Meta:
        model = ContentRevision
        fields = ['id', 'revision_number', 'snapshot', 'editor_username', 'created_at']
        read_only_fields = fields


class ContentCommentSerializer(serializers.ModelSerializer):
    item_id = serializers.PrimaryKeyRelatedField(source='item', queryset=ContentItem.objects.all(), write_only=True)
    email = serializers.EmailField(write_only=True)
    class Meta:
        model = ContentComment
        fields = ['id', 'item_id', 'name', 'email', 'body', 'status', 'created_at']
        read_only_fields = ['id', 'status', 'created_at']
