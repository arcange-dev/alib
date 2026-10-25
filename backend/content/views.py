import csv
import hashlib
import re
import secrets
from pathlib import PurePath
from uuid import uuid4
from django.conf import settings
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.db.models import Count, Max
from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from urllib.parse import urlencode
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status, viewsets
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from .models import AnalyticsEvent, AuditEvent, Category, Collection, ContactMessage, ContentComment, ContentItem, ContentRevision, ContentReaction, CreatorProfile, MediaAsset, NewsletterSubscriber, SiteSettings, Tag, VisitorSuggestion
from .permissions import ADMIN_GROUP, EDITOR_GROUP, MODERATOR_GROUP, SUPPORT_GROUP, IsALIBAdministrator, IsALIBEditor, IsALIBModerator, IsALIBStaff, PublicReadAdminWrite, can_manage_content, can_moderate
from .serializers import CategorySerializer, CollectionSerializer, ContentCommentSerializer, ContentItemSerializer, ContentRevisionSerializer, CreatorProfileSerializer, MediaAssetSerializer, SiteSettingsSerializer, TagSerializer, VisitorSuggestionSerializer
from .storage import signed_object_url, upload_object



def _revision_snapshot(item):
    return {
        'title': item.title, 'slug': item.slug, 'summary': item.summary,
        'body': item.body, 'content_type': item.content_type,
        'source_url': item.source_url, 'cover_image_url': item.cover_image_url,
        'category_id': item.category_id, 'tag_ids': list(item.tags.values_list('id', flat=True)),
        'visibility': item.visibility, 'status': item.status, 'featured': item.featured,
        'allow_download': item.allow_download,
        'published_at': item.published_at.isoformat() if item.published_at else None,
        'scheduled_for': item.scheduled_for.isoformat() if item.scheduled_for else None,
        'metadata': item.metadata,
    }


def _record_revision(item, editor):
    number = (item.revisions.aggregate(latest=Max('revision_number'))['latest'] or 0) + 1
    return ContentRevision.objects.create(item=item, revision_number=number, snapshot=_revision_snapshot(item), editor=editor)

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
        if not can_manage_content(user):
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
        featured = self.request.query_params.get('featured')
        if featured in {'true', 'false'}:
            queryset = queryset.filter(featured=(featured == 'true'))
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            parsed = __import__('django.utils.dateparse', fromlist=['parse_date']).parse_date(from_date)
            if parsed is None:
                raise ValidationError({'from_date': 'Use YYYY-MM-DD.'})
            queryset = queryset.filter(published_at__date__gte=parsed)
        if to_date:
            parsed = __import__('django.utils.dateparse', fromlist=['parse_date']).parse_date(to_date)
            if parsed is None:
                raise ValidationError({'to_date': 'Use YYYY-MM-DD.'})
            queryset = queryset.filter(published_at__date__lte=parsed)
        return queryset.distinct()

    def perform_create(self, serializer):
        item = serializer.save(created_by=self.request.user)
        _record_revision(item, self.request.user)
        AuditEvent.objects.create(actor=self.request.user, action='content.created', object_type='ContentItem', object_id=str(item.pk), details={'title': item.title, 'status': item.status})

    def perform_update(self, serializer):
        item = serializer.save()
        _record_revision(item, self.request.user)
        AuditEvent.objects.create(actor=self.request.user, action='content.updated', object_type='ContentItem', object_id=str(item.pk), details={'title': item.title, 'status': item.status})

    @action(detail=True, methods=['get'], permission_classes=[IsALIBEditor], url_path='revisions')
    def revisions(self, request, pk=None):
        item = self.get_object()
        return Response(ContentRevisionSerializer(item.revisions.select_related('editor'), many=True).data)

    @action(detail=True, methods=['post'], permission_classes=[IsALIBEditor], url_path='restore-revision')
    def restore_revision(self, request, pk=None):
        item = self.get_object()
        revision = item.revisions.filter(pk=request.data.get('revision_id')).first()
        if revision is None:
            return Response({'detail': 'Revision not found for this item.'}, status=status.HTTP_404_NOT_FOUND)
        snapshot = revision.snapshot
        for field in ['title', 'slug', 'summary', 'body', 'content_type', 'source_url', 'cover_image_url', 'visibility', 'status', 'featured', 'allow_download', 'metadata']:
            if field in snapshot:
                setattr(item, field, snapshot[field])
        item.category_id = snapshot.get('category_id')
        item.published_at = parse_datetime(snapshot['published_at']) if snapshot.get('published_at') else None
        item.scheduled_for = parse_datetime(snapshot['scheduled_for']) if snapshot.get('scheduled_for') else None
        item.save()
        item.tags.set(snapshot.get('tag_ids', []))
        _record_revision(item, request.user)
        AuditEvent.objects.create(actor=request.user, action='content.revision_restored', object_type='ContentItem', object_id=str(item.pk), details={'revision_id': revision.pk})
        return Response(ContentItemSerializer(item).data)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], authentication_classes=[], url_path='related')
    def related(self, request, pk=None):
        item = self.get_object()
        candidates = self.get_queryset().exclude(pk=item.pk)
        tag_ids = list(item.tags.values_list('id', flat=True))
        if tag_ids:
            candidates = candidates.filter(tags__in=tag_ids).annotate(shared_tags=Count('tags')).order_by('-shared_tags', '-published_at')
        elif item.category_id:
            candidates = candidates.filter(category_id=item.category_id).order_by('-published_at')
        else:
            candidates = candidates.order_by('-published_at')
        return Response(ContentItemSerializer(candidates.distinct()[:4], many=True).data)

    def perform_destroy(self, instance):
        AuditEvent.objects.create(actor=self.request.user, action='content.deleted', object_type='ContentItem', object_id=str(instance.pk), details={'title': instance.title})
        instance.delete()

    @action(detail=False, methods=['get'], url_path=r'by-slug/(?P<slug>[^/.]+)', permission_classes=[AllowAny])
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
        if not can_manage_content(self.request.user):
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
    permission_classes = [IsALIBEditor]
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
        return Response({'detail': 'Signed in.', 'user': {'id': user.pk, 'username': user.get_username(), 'email': user.email, 'is_staff': user.is_staff, 'is_superuser': user.is_superuser, 'role': _team_member_payload(user)['role']}})

class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        logout(request)
        return Response({'detail': 'Signed out.'})

class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        return Response({'id': user.pk, 'username': user.get_username(), 'email': user.email, 'is_staff': user.is_staff, 'role': _team_member_payload(user)['role']})

class AdminStatsAPIView(APIView):
    permission_classes = [IsALIBStaff]
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
        recipient = settings.ALIB_CONTACT_NOTIFICATION_EMAIL
        notification_sent = False
        if recipient:
            try:
                notification_sent = bool(send_mail(
                    'New message received on ALIB',
                    f'From: {name} <{email}>\n\n{message}',
                    settings.DEFAULT_FROM_EMAIL,
                    [recipient],
                    fail_silently=False,
                ))
            except Exception:
                notification_sent = False
        detail = 'Your message was saved for the creator.'
        if notification_sent:
            detail += ' The creator was notified by email.'
        elif recipient:
            detail += ' The message is saved, but the email notification could not be sent.'
        return Response({'detail': detail, 'notification_sent': notification_sent}, status=status.HTTP_201_CREATED)

class VisitorSuggestionViewSet(viewsets.ModelViewSet):
    serializer_class = VisitorSuggestionSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'suggestions'
    def get_queryset(self):
        if not can_moderate(self.request.user):
            return VisitorSuggestion.objects.none()
        return VisitorSuggestion.objects.all()
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsALIBModerator()]
    def perform_create(self, serializer):
        serializer.save(status='pending')

    @action(detail=True, methods=['post'], permission_classes=[IsALIBModerator], url_path='review')
    def review(self, request, pk=None):
        suggestion = self.get_object()
        decision = request.data.get('status')
        if decision not in {'approved', 'rejected', 'pending'}:
            raise ValidationError({'status': 'Choose pending, approved, or rejected.'})
        suggestion.status = decision
        suggestion.reviewed_by = request.user
        suggestion.save(update_fields=['status', 'reviewed_by', 'updated_at'])
        AuditEvent.objects.create(actor=request.user, action='suggestion.reviewed', object_type='VisitorSuggestion', object_id=str(suggestion.pk), details={'status': decision})
        return Response(VisitorSuggestionSerializer(suggestion).data)


class AdminMediaViewSet(viewsets.ModelViewSet):
    serializer_class = MediaAssetSerializer
    permission_classes = [IsALIBEditor]
    queryset = MediaAsset.objects.all()

class MediaUploadAPIView(APIView):
    permission_classes = [IsALIBEditor]
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
            alt_text=str(request.data.get('alt_text', ''))[:300],
            original_filename=PurePath(uploaded.name).name[:255], storage_path=object_key,
            mime_type=mime_type, file_size=uploaded.size,
            visibility='private', downloadable=False, uploaded_by=request.user,
        )
        AuditEvent.objects.create(actor=request.user, action='media.uploaded', object_type='MediaAsset', object_id=str(asset.pk), details={'mime_type': mime_type, 'file_size': asset.file_size})
        return Response(MediaAssetSerializer(asset).data, status=status.HTTP_201_CREATED)






class ContentReactionAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'comments'
    def get(self, request, item_id):
        item = ContentItem.objects.filter(pk=item_id, status='published', visibility='public', published_at__lte=timezone.now()).first()
        if not item:
            return Response({'detail': 'Content not found.'}, status=status.HTTP_404_NOT_FOUND)
        counts = {key: item.reactions.filter(reaction=key).count() for key in ('like', 'love', 'useful')}
        return Response({'counts': counts})

    def post(self, request, item_id):
        item = ContentItem.objects.filter(pk=item_id, status='published', visibility='public', published_at__lte=timezone.now()).first()
        if not item:
            return Response({'detail': 'Content not found.'}, status=status.HTTP_404_NOT_FOUND)
        reaction = str(request.data.get('reaction', '')).strip()
        if reaction not in {'like', 'love', 'useful'}:
            raise ValidationError({'reaction': 'Choose like, love, or useful.'})
        ip = request.META.get('REMOTE_ADDR', '')
        visitor_hash = hashlib.sha256(f'{ip}:{settings.SECRET_KEY}'.encode()).hexdigest() if ip else secrets.token_hex(32)
        _, created = ContentReaction.objects.get_or_create(item=item, reaction=reaction, visitor_hash=visitor_hash)
        counts = {key: item.reactions.filter(reaction=key).count() for key in ('like', 'love', 'useful')}
        return Response({'counts': counts, 'recorded': created}, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class PasswordResetRequestAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        if not email:
            raise ValidationError({'email': 'Enter the email address used by your staff account.'})
        User = get_user_model()
        users = User.objects.filter(email__iexact=email, is_active=True, is_staff=True).exclude(email='')
        for user in users:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = request.build_absolute_uri(f'/reset-password?uid={uid}&token={token}')
            try:
                sent = send_mail('Reset your ALIB Creator Studio password', f'Reset your password using this link: {reset_url}\n\nIf you did not request a reset, ignore this email.', settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            except Exception:
                sent = 0
            if not sent:
                return Response({'detail': 'Password reset email could not be sent. Configure the server email provider, then try again.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'detail': 'If an active staff account uses that address, a password reset link has been sent.'}, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'
    def post(self, request):
        uid = str(request.data.get('uid', '')).strip()
        token = str(request.data.get('token', '')).strip()
        password = request.data.get('password', '')
        if not uid or not token or not isinstance(password, str):
            raise ValidationError({'detail': 'The reset link or password is missing.'})
        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = get_user_model().objects.get(pk=user_id, is_active=True, is_staff=True)
        except (ValueError, TypeError, OverflowError, get_user_model().DoesNotExist):
            return Response({'detail': 'This password reset link is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        if not default_token_generator.check_token(user, token):
            return Response({'detail': 'This password reset link is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_password(password, user=user)
        except DjangoValidationError as exc:
            raise ValidationError({'password': list(exc.messages)})
        user.set_password(password)
        user.save(update_fields=['password'])
        AuditEvent.objects.create(actor=user, action='auth.password_reset', object_type='User', object_id=str(user.pk))
        return Response({'detail': 'Password updated. Return to Creator Studio and sign in.'})


class PublicSiteSettingsAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        obj = SiteSettings.objects.order_by('id').first()
        if obj:
            return Response(SiteSettingsSerializer(obj).data)
        return Response({'site_title': 'ALIB — Digital Home', 'logo_url': '', 'favicon_url': '', 'seo_description': 'A considered home for ideas, work, and curiosity.', 'homepage_sections': ['featured', 'latest', 'categories', 'collections'], 'theme_preferences': {'primary': '#2563eb', 'secondary': '#facc15'}})




ROLE_GROUPS = {
    'administrator': ADMIN_GROUP,
    'editor': EDITOR_GROUP,
    'moderator': MODERATOR_GROUP,
    'support': SUPPORT_GROUP,
}


def _team_member_payload(user):
    groups = set(user.groups.filter(name__in=ROLE_GROUPS.values()).values_list('name', flat=True))
    if user.is_superuser or ADMIN_GROUP in groups:
        role = 'administrator'
    elif EDITOR_GROUP in groups:
        role = 'editor'
    elif MODERATOR_GROUP in groups:
        role = 'moderator'
    elif SUPPORT_GROUP in groups:
        role = 'support'
    else:
        role = 'editor' if user.is_staff else 'none'
    return {
        'id': user.pk, 'username': user.get_username(), 'email': user.email,
        'is_active': user.is_active, 'is_superuser': user.is_superuser,
        'role': role, 'last_login': user.last_login,
    }


class AdminTeamAPIView(APIView):
    permission_classes = [IsALIBAdministrator]

    def get(self, request):
        users = get_user_model().objects.filter(is_staff=True).prefetch_related('groups').order_by('username')
        return Response([_team_member_payload(user) for user in users])

    def post(self, request):
        username = str(request.data.get('username', '')).strip()
        email = str(request.data.get('email', '')).strip().lower()
        role = str(request.data.get('role', 'editor')).strip().lower()
        if not username or len(username) > 150:
            raise ValidationError({'username': 'Enter a username up to 150 characters.'})
        if not email:
            raise ValidationError({'email': 'A work email is required to send the setup link.'})
        if role not in ROLE_GROUPS:
            raise ValidationError({'role': 'Choose administrator, editor, moderator, or support.'})
        if role == 'administrator' and not request.user.is_superuser:
            raise PermissionDenied('Only the owner superuser can assign the administrator role.')
        User = get_user_model()
        if User.objects.filter(username=username).exists() or User.objects.filter(email__iexact=email).exists():
            raise ValidationError({'detail': 'That username or email is already in use.'})
        group, _ = Group.objects.get_or_create(name=ROLE_GROUPS[role])
        with transaction.atomic():
            user = User(username=username, email=email, is_staff=True, is_active=True)
            user.set_unusable_password()
            user.save()
            user.groups.add(group)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            setup_url = request.build_absolute_uri(f'/reset-password?uid={uid}&token={token}')
            try:
                sent = send_mail(
                    'You have been invited to ALIB Creator Studio',
                    f'An administrator invited you to ALIB Creator Studio as {role}. Set your password here: {setup_url}\n\nIf you were not expecting this invitation, ignore this email.',
                    settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False,
                )
            except Exception:
                sent = 0
            if not sent:
                user.delete()
                return Response({'detail': 'Invitation email could not be sent. Configure SMTP, then try again. No staff account was retained.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            AuditEvent.objects.create(actor=request.user, action='team.invited', object_type='User', object_id=str(user.pk), details={'role': role, 'email': email})
        return Response({'detail': 'Invitation sent. The new team member must set a password before signing in.', 'member': _team_member_payload(user)}, status=status.HTTP_201_CREATED)


class AdminTeamMemberAPIView(APIView):
    permission_classes = [IsALIBAdministrator]

    def patch(self, request, user_id):
        User = get_user_model()
        member = User.objects.filter(pk=user_id, is_staff=True).first()
        if member is None:
            return Response({'detail': 'Staff member not found.'}, status=status.HTTP_404_NOT_FOUND)
        if member.is_superuser and not request.user.is_superuser:
            raise PermissionDenied('Only the owner superuser can change the owner account.')
        if member.pk == request.user.pk and request.data.get('is_active') is False:
            raise ValidationError({'is_active': 'You cannot deactivate your own account.'})
        if 'role' in request.data:
            role = str(request.data.get('role', '')).strip().lower()
            if role not in ROLE_GROUPS:
                raise ValidationError({'role': 'Choose administrator, editor, moderator, or support.'})
            if role == 'administrator' and not request.user.is_superuser:
                raise PermissionDenied('Only the owner superuser can assign the administrator role.')
            if member.is_superuser and role != 'administrator':
                raise ValidationError({'role': 'The owner superuser cannot be demoted here.'})
            if not member.is_superuser:
                group, _ = Group.objects.get_or_create(name=ROLE_GROUPS[role])
                member.groups.set([group])
        if 'is_active' in request.data:
            next_active = bool(request.data.get('is_active'))
            if member.is_superuser and not next_active:
                raise ValidationError({'is_active': 'Use a recovery procedure to disable the owner account.'})
            member.is_active = next_active
            member.save(update_fields=['is_active'])
        AuditEvent.objects.create(actor=request.user, action='team.member_updated', object_type='User', object_id=str(member.pk), details={'role': _team_member_payload(member)['role'], 'is_active': member.is_active})
        return Response(_team_member_payload(member))


class AdminSiteSettingsAPIView(APIView):
    permission_classes = [IsALIBAdministrator]
    def put(self, request):
        obj = SiteSettings.objects.order_by('id').first()
        serializer = SiteSettingsSerializer(obj, data=request.data, partial=True) if obj else SiteSettingsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        AuditEvent.objects.create(actor=request.user, action='site_settings.updated', object_type='SiteSettings', object_id=str(obj.pk))
        return Response(serializer.data)
    def patch(self, request):
        return self.put(request)


class AnalyticsEventAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'analytics'
    def post(self, request):
        event_type = str(request.data.get('event_type', 'page_view')).strip()
        if event_type not in {'page_view', 'outbound_click', 'search'}:
            raise ValidationError({'event_type': 'Unsupported analytics event.'})
        path = str(request.data.get('path', '')).strip()[:512]
        if not path.startswith('/') or path.startswith('//') or path.startswith('/api/'):
            raise ValidationError({'path': 'Provide a local website path.'})
        referrer = str(request.data.get('referrer', '')).strip()[:1000]
        item = None
        item_id = request.data.get('item_id')
        if item_id:
            item = ContentItem.objects.filter(pk=item_id, status='published', visibility='public', published_at__lte=timezone.now()).first()
        ip = request.META.get('REMOTE_ADDR', '')
        visitor_hash = hashlib.sha256(f'{ip}:{timezone.localdate().isoformat()}:{settings.SECRET_KEY}'.encode()).hexdigest() if ip else ''
        AnalyticsEvent.objects.create(event_type=event_type, path=path, referrer=referrer, visitor_hash=visitor_hash, item=item)
        return Response({'detail': 'Event recorded.'}, status=status.HTTP_202_ACCEPTED)


class AdminAuditEventAPIView(APIView):
    permission_classes = [IsALIBAdministrator]

    def get(self, request):
        queryset = AuditEvent.objects.select_related('actor').order_by('-created_at')
        action_filter = str(request.query_params.get('action', '')).strip()[:120]
        object_type = str(request.query_params.get('object_type', '')).strip()[:100]
        if action_filter:
            queryset = queryset.filter(action__icontains=action_filter)
        if object_type:
            queryset = queryset.filter(object_type__iexact=object_type)
        return Response([
            {'id': event.pk, 'actor': event.actor.get_username() if event.actor else 'System', 'action': event.action,
             'object_type': event.object_type, 'object_id': event.object_id, 'details': event.details, 'created_at': event.created_at}
            for event in queryset[:250]
        ])


class AdminNewsletterAPIView(APIView):
    permission_classes = [IsALIBAdministrator]

    def get(self, request):
        queryset = NewsletterSubscriber.objects.order_by('-created_at')
        active = request.query_params.get('active')
        if active in {'true', 'false'}:
            queryset = queryset.filter(is_active=(active == 'true'))
        if request.query_params.get('format') == 'csv':
            response = HttpResponse(content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = 'attachment; filename=alib-newsletter-subscribers.csv'
            writer = csv.writer(response)
            writer.writerow(['email', 'active', 'confirmed_at', 'created_at'])
            for row in queryset.iterator():
                writer.writerow([row.email, 'yes' if row.is_active else 'no', row.confirmed_at.isoformat() if row.confirmed_at else '', row.created_at.isoformat()])
            return response
        return Response([
            {'id': row.pk, 'email': row.email, 'is_active': row.is_active, 'confirmed_at': row.confirmed_at, 'created_at': row.created_at}
            for row in queryset[:500]
        ])

class AdminAnalyticsAPIView(APIView):
    permission_classes = [IsALIBStaff]
    def get(self, request):
        since = timezone.now() - timezone.timedelta(days=30)
        events = AnalyticsEvent.objects.filter(created_at__gte=since)
        popular = list(events.filter(event_type='page_view').values('path').annotate(views=Count('id')).order_by('-views')[:10])
        daily = list(events.filter(event_type='page_view').extra(select={'day': "DATE(created_at)"}).values('day').annotate(views=Count('id')).order_by('day'))
        return Response({'period_days': 30, 'page_views': events.filter(event_type='page_view').count(), 'outbound_clicks': events.filter(event_type='outbound_click').count(), 'searches': events.filter(event_type='search').count(), 'unique_daily_visitors_approx': events.filter(event_type='page_view').values('visitor_hash', 'created_at__date').distinct().count(), 'popular_paths': popular, 'daily_page_views': daily})


class ContactInboxAPIView(APIView):
    permission_classes = [IsALIBModerator]
    def get(self, request):
        queryset = ContactMessage.objects.order_by('reviewed', '-created_at')
        reviewed = request.query_params.get('reviewed')
        if reviewed in ('true', 'false'):
            queryset = queryset.filter(reviewed=(reviewed == 'true'))
        return Response([{'id': x.pk, 'name': x.name, 'email': x.email, 'message': x.message, 'reviewed': x.reviewed, 'created_at': x.created_at} for x in queryset[:200]])
    def patch(self, request, message_id=None):
        message_id = message_id or request.data.get('id')
        message = ContactMessage.objects.filter(pk=message_id).first()
        if message is None:
            return Response({'detail': 'Message not found.'}, status=status.HTTP_404_NOT_FOUND)
        if 'reviewed' in request.data:
            message.reviewed = bool(request.data['reviewed'])
            message.save(update_fields=['reviewed'])
        return Response({'id': message.pk, 'reviewed': message.reviewed})


class ContentCommentViewSet(viewsets.ModelViewSet):
    serializer_class = ContentCommentSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'comments'
    http_method_names = ['get', 'post', 'head', 'options']
    def get_queryset(self):
        queryset = ContentComment.objects.select_related('item')
        item_id = self.request.query_params.get('item_id')
        if item_id and item_id.isdigit():
            queryset = queryset.filter(item_id=int(item_id))
        if can_moderate(self.request.user):
            return queryset
        return queryset.filter(status='approved', item__status='published', item__visibility='public', item__published_at__lte=timezone.now())
    def get_permissions(self):
        if self.action in ['create', 'list']:
            return [AllowAny()]
        return [IsALIBModerator()]
    def perform_create(self, serializer):
        item = serializer.validated_data.get('item')
        if not item or item.status != 'published' or item.visibility != 'public' or not item.published_at or item.published_at > timezone.now():
            raise ValidationError({'item_id': 'Comments are only open on published public items.'})
        serializer.save(status='pending')
    @action(detail=True, methods=['post'], permission_classes=[IsALIBModerator], url_path='moderate')
    def moderate(self, request, pk=None):
        comment = self.get_object()
        new_status = request.data.get('status')
        if new_status not in {'approved', 'rejected', 'pending'}:
            raise ValidationError({'status': 'Choose pending, approved, or rejected.'})
        comment.status = new_status
        comment.moderated_at = timezone.now()
        comment.moderated_by = request.user
        comment.save(update_fields=['status', 'moderated_at', 'moderated_by'])
        AuditEvent.objects.create(actor=request.user, action='comment.moderated', object_type='ContentComment', object_id=str(comment.pk), details={'status': new_status})
        return Response(ContentCommentSerializer(comment).data)


class ScheduledPublishTriggerAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        expected = settings.ALIB_SCHEDULER_TOKEN
        supplied = request.headers.get('X-ALIB-Scheduler-Token', '')
        if not expected or len(expected) < 32 or not secrets.compare_digest(expected, supplied):
            return Response({'detail': 'Invalid scheduler credentials.'}, status=status.HTTP_403_FORBIDDEN)
        from django.core.management import call_command
        from io import StringIO
        output = StringIO()
        call_command('publish_scheduled', stdout=output)
        AuditEvent.objects.create(actor=None, action='scheduler.publish_scheduled', object_type='ContentItem', details={'output': output.getvalue().strip()})
        return Response({'detail': 'Scheduled publishing completed.', 'result': output.getvalue().strip()})


class NewsletterSubscribeAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'newsletter'
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            validate_email(email)
        except DjangoValidationError:
            raise ValidationError({'email': 'Enter a valid email address.'})
        token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        subscriber, _ = NewsletterSubscriber.objects.get_or_create(email=email, defaults={'is_active': False})
        subscriber.token_hash = token_hash
        subscriber.is_active = False
        subscriber.confirmed_at = None
        subscriber.save(update_fields=['token_hash', 'is_active', 'confirmed_at', 'updated_at'])
        confirm_url = request.build_absolute_uri(f'/api/v1/newsletter/confirm/{token}/')
        unsubscribe_url = request.build_absolute_uri('/api/v1/newsletter/unsubscribe/?' + urlencode({'email': email, 'token': token}))
        message = (
            f'Confirm your ALIB subscription by opening this link: {confirm_url}\n\n'
            f'After confirmation, you can unsubscribe at any time using this link: {unsubscribe_url}\n\n'
            'If you did not request this, ignore this message.'
        )
        try:
            sent = send_mail('Confirm your ALIB newsletter subscription', message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        except Exception:
            sent = 0
        if not sent:
            return Response({'detail': 'Subscription is saved as pending, but email delivery is not configured. Configure SMTP or a transactional email provider to send confirmation messages.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'detail': 'Check your email to confirm the subscription.'}, status=status.HTTP_202_ACCEPTED)


class NewsletterConfirmAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request, token):
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        subscriber = NewsletterSubscriber.objects.filter(token_hash=token_hash).first()
        if subscriber is None:
            return Response({'detail': 'Confirmation link is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        subscriber.is_active = True
        subscriber.confirmed_at = timezone.now()
        subscriber.save(update_fields=['is_active', 'confirmed_at', 'updated_at'])
        return Response({'detail': 'Your subscription is confirmed. You can close this page.'})


class NewsletterUnsubscribeAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'newsletter'

    def _unsubscribe(self, email, token):
        email = str(email or '').strip().lower()
        token = str(token or '').strip()
        if not email or not token:
            raise ValidationError({'detail': 'Email and unsubscribe token are required.'})
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        subscriber = NewsletterSubscriber.objects.filter(email=email, token_hash=token_hash, is_active=True).first()
        if subscriber is None:
            return Response({'detail': 'An active subscription matching this link was not found.'}, status=status.HTTP_404_NOT_FOUND)
        subscriber.is_active = False
        subscriber.save(update_fields=['is_active', 'updated_at'])
        return Response({'detail': 'You have been unsubscribed.'})

    def post(self, request):
        return self._unsubscribe(request.data.get('email'), request.data.get('token'))

    def get(self, request):
        return self._unsubscribe(request.query_params.get('email'), request.query_params.get('token'))


class MediaSignedUrlAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    def get(self, request, asset_id):
        asset = MediaAsset.objects.filter(pk=asset_id).first()
        if asset is None:
            return Response({'detail': 'File not found.'}, status=status.HTTP_404_NOT_FOUND)
        is_admin = can_manage_content(request.user)
        if not is_admin and asset.visibility != 'public':
            raise PermissionDenied('This file is not public.')
        download = request.query_params.get('download', '').lower() in ('1', 'true', 'yes')
        if download and not (is_admin or (asset.visibility == 'public' and asset.downloadable)):
            raise PermissionDenied('Downloads are disabled for this file.')
        return Response({'url': signed_object_url(asset.storage_path, 120), 'expires_in': 120})
