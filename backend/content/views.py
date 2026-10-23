import re
from pathlib import PurePath
from uuid import uuid4
from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.db.models import Count
from django.http import JsonResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from .models import AuditEvent, Category, Collection, ContactMessage, ContentItem, CreatorProfile, MediaAsset, SiteSettings, Tag, VisitorSuggestion
from .permissions import PublicReadAdminWrite
from .serializers import CategorySerializer, CollectionSerializer, ContentItemSerializer, CreatorProfileSerializer, MediaAssetSerializer, TagSerializer, VisitorSuggestionSerializer
from .storage import signed_object_url, upload_object

class ContentItemViewSet(viewsets.ModelViewSet):
    serializer_class = ContentItemSerializer
    permission_classes = [PublicReadAdminWrite]
    search_fields = ['title', 'summary', 'body', 'source_url', 'category__name', 'tags__name']
    ordering_fields = ['published_at', 'created_at', 'updated_at', 'title']
    ordering = ['-published_at', '-created_at']
    lookup_field = 'pk'

    def get_queryset(self):
        queryset = ContentItem.objects.select_related('category').prefetch_related('tags', 'collections')
        user = self.request.user
        if not (user.is_authenticated and user.is_staff):
            queryset = queryset.filter(status='published', visibility='public', published_at__lte=timezone.now())
        content_type = self.request.query_params.get('content_type') or self.request.query_params.get('type')
        if content_type:
            queryset = queryset.filter(content_type=content_type)
        category = self.request.query_params.get('category')
        if category and category.isdigit():
            queryset = queryset.filter(category_id=int(category))
        tag = self.request.query_params.get('tag')
        if tag:
            queryset = queryset.filter(tags__slug=tag)
        return queryset.distinct()

    def perform_create(self, serializer):
        item = serializer.save(created_by=self.request.user)
        AuditEvent.objects.create(actor=self.request.user, action='content.created', object_type='ContentItem', object_id=str(item.pk), details={'title': item.title, 'status': item.status})

    def perform_update(self, serializer):
        item = serializer.save()
        AuditEvent.objects.create(actor=self.request.user, action='content.updated', object_type='ContentItem', object_id=str(item.pk), details={'title': item.title, 'status': item.status})

    def perform_destroy(self, instance):
        AuditEvent.objects.create(actor=self.request.user, action='content.deleted', object_type='ContentItem', object_id=str(instance.pk), details={'title': instance.title})
        instance.delete()

    @action(detail=False, methods=['get'], url_path=r'by-slug/(?P<slug>[^/.]+)', permission_classes=[AllowAny], authentication_classes=[])
    def by_slug(self, request, slug=None):
        item = self.get_queryset().filter(slug=slug).first()
        if not item:
            return Response({'detail': 'Content not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.get_serializer(item).data)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [PublicReadAdminWrite]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'display_order', 'created_at']

class TagViewSet(viewsets.ModelViewSet):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [PublicReadAdminWrite]
    search_fields = ['name']
    ordering_fields = ['name', 'created_at']

class CollectionViewSet(viewsets.ModelViewSet):
    serializer_class = CollectionSerializer
    permission_classes = [PublicReadAdminWrite]
    search_fields = ['title', 'description']
    ordering_fields = ['display_order', 'created_at', 'updated_at', 'title']
    def get_queryset(self):
        queryset = Collection.objects.prefetch_related('items')
        if not (self.request.user.is_authenticated and self.request.user.is_staff):
            queryset = queryset.filter(visibility='public')
        return queryset

class HomeAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        profile = CreatorProfile.objects.order_by('id').first()
        if profile is None:
            profile_data = {
                'display_name': 'Your name', 'headline': 'A home for ideas worth keeping.',
                'biography': 'A personal space for work in progress, useful links, thoughtful notes, and the things worth returning to.',
                'avatar_url': '', 'location': '', 'social_links': {},
            }
        else:
            profile_data = CreatorProfileSerializer(profile).data
        now = timezone.now()
        public = ContentItem.objects.filter(status='published', visibility='public', published_at__lte=now).select_related('category').prefetch_related('tags', 'collections')
        featured = public.filter(featured=True).order_by('-published_at')[:3]
        latest = public.order_by('-published_at', '-created_at')[:6]
        categories = Category.objects.filter(content_items__in=public).distinct()
        collections = Collection.objects.filter(visibility='public').annotate(item_count=Count('items')).order_by('display_order', '-updated_at')[:6]
        return Response({
            'profile': profile_data,
            'featured': ContentItemSerializer(featured, many=True).data,
            'latest': ContentItemSerializer(latest, many=True).data,
            'categories': CategorySerializer(categories, many=True).data,
            'collections': CollectionSerializer(collections, many=True).data,
            'counts': {'published': public.count(), 'projects': public.filter(content_type='project').count(), 'collections': Collection.objects.filter(visibility='public').count()},
        })

class ProfileAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        profile = CreatorProfile.objects.order_by('id').first()
        if profile:
            return Response(CreatorProfileSerializer(profile).data)
        return Response({'display_name': 'Your name', 'headline': 'A home for ideas worth keeping.', 'biography': '', 'avatar_url': '', 'location': '', 'social_links': {}})

class AdminProfileAPIView(APIView):
    permission_classes = [IsAdminUser]
    def put(self, request):
        profile = CreatorProfile.objects.order_by('id').first()
        serializer = CreatorProfileSerializer(profile, data=request.data, partial=True) if profile else CreatorProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

@method_decorator(ensure_csrf_cookie, name='dispatch')
class CsrfAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        from django.middleware.csrf import get_token
        return Response({'csrfToken': get_token(request)})

@method_decorator(csrf_protect, name='dispatch')
class LoginAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = 'login'
    def post(self, request):
        username = str(request.data.get('username', '')).strip()
        password = request.data.get('password', '')
        if not username or not isinstance(password, str) or not password:
            return Response({'detail': 'Enter your username and password.'}, status=status.HTTP_400_BAD_REQUEST)
        user = authenticate(request, username=username, password=password)
        if user is None or not user.is_active or not user.is_staff:
            return Response({'detail': 'The sign-in details were not accepted.'}, status=status.HTTP_400_BAD_REQUEST)
        login(request, user)
        return Response({'detail': 'Signed in.', 'user': {'id': user.pk, 'username': user.get_username(), 'email': user.email, 'is_staff': user.is_staff}})

class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        logout(request)
        return Response({'detail': 'Signed out.'})

class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        return Response({'id': user.pk, 'username': user.get_username(), 'email': user.email, 'is_staff': user.is_staff})

class AdminStatsAPIView(APIView):
    permission_classes = [IsAdminUser]
    def get(self, request):
        return Response({
            'published': ContentItem.objects.filter(status='published').count(),
            'drafts': ContentItem.objects.filter(status='draft').count(),
            'scheduled': ContentItem.objects.filter(status='scheduled').count(),
            'assets': MediaAsset.objects.count(),
            'suggestions_pending': VisitorSuggestion.objects.filter(status='pending').count(),
        })

class ContactAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'contact'
    def post(self, request):
        name = str(request.data.get('name', '')).strip()
        email = str(request.data.get('email', '')).strip()
        message = str(request.data.get('message', '')).strip()
        if not name or len(name) > 120:
            raise ValidationError({'name': 'Enter a name up to 120 characters.'})
        if len(message) < 10 or len(message) > 5000:
            raise ValidationError({'message': 'Message must be between 10 and 5,000 characters.'})
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        try: validate_email(email)
        except DjangoValidationError: raise ValidationError({'email': 'Enter a valid email address.'})
        ContactMessage.objects.create(name=name, email=email, message=message)
        return Response({'detail': 'Your message was saved for the creator.'}, status=status.HTTP_201_CREATED)

class VisitorSuggestionViewSet(viewsets.ModelViewSet):
    serializer_class = VisitorSuggestionSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'suggestions'
    def get_queryset(self):
        if not (self.request.user.is_authenticated and self.request.user.is_staff):
            return VisitorSuggestion.objects.none()
        return VisitorSuggestion.objects.all()
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAdminUser()]
    def perform_create(self, serializer):
        serializer.save(status='pending')

class AdminMediaViewSet(viewsets.ModelViewSet):
    serializer_class = MediaAssetSerializer
    permission_classes = [IsAdminUser]
    queryset = MediaAsset.objects.all()

class MediaUploadAPIView(APIView):
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]
    def post(self, request):
        uploaded = request.FILES.get('file')
        if not uploaded:
            raise ValidationError({'file': 'Choose a file to upload.'})
        if uploaded.size < 1 or uploaded.size > settings.MAX_UPLOAD_BYTES:
            raise ValidationError({'file': f'File must be between 1 byte and {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} MB.'})
        allowed = {'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'audio/mpeg', 'audio/mp4', 'video/mp4', 'video/webm'}
        mime_type = (getattr(uploaded, 'content_type', '') or '').lower()
        if mime_type not in allowed:
            raise ValidationError({'file': 'Allowed formats are JPG, PNG, WebP, GIF, PDF, MP3, MP4, and WebM.'})
        safe_name = re.sub(r'[^a-zA-Z0-9._-]+', '-', PurePath(uploaded.name).name).strip('.-')[:120] or 'upload.bin'
        object_key = f'{uuid4().hex}/{safe_name}'
        upload_object(object_key, mime_type, uploaded.read())
        asset = MediaAsset.objects.create(
            title=str(request.data.get('title', ''))[:200] or uploaded.name[:200],
            description=str(request.data.get('description', ''))[:500],
            original_filename=PurePath(uploaded.name).name[:255], storage_path=object_key,
            mime_type=mime_type, file_size=uploaded.size,
            visibility='private', downloadable=False, uploaded_by=request.user,
        )
        AuditEvent.objects.create(actor=request.user, action='media.uploaded', object_type='MediaAsset', object_id=str(asset.pk), details={'mime_type': mime_type, 'file_size': asset.file_size})
        return Response(MediaAssetSerializer(asset).data, status=status.HTTP_201_CREATED)

class MediaSignedUrlAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    def get(self, request, asset_id):
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return Response({'detail': 'File not found.'}, status=status.HTTP_404_NOT_FOUND)
        is_admin = bool(request.user.is_authenticated and request.user.is_staff)
        if not is_admin and asset.visibility != 'public':
            raise PermissionDenied('This file is not public.')
        download = request.query_params.get('download', '').lower() in ('1', 'true', 'yes')
        if download and not (is_admin or (asset.visibility == 'public' and asset.downloadable)):
            raise PermissionDenied('Downloads are disabled for this file.')
        return Response({'url': signed_object_url(asset.storage_path, 120), 'expires_in': 120})
