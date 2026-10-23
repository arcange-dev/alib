from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AdminMediaViewSet, AdminProfileAPIView, AdminStatsAPIView, CategoryViewSet, CollectionViewSet,
    ContactAPIView, ContentItemViewSet, CsrfAPIView, CurrentUserAPIView, HomeAPIView, LoginAPIView,
    LogoutAPIView, MediaSignedUrlAPIView, MediaUploadAPIView, ProfileAPIView, TagViewSet,
    VisitorSuggestionViewSet,
)

router = DefaultRouter()
router.register('content', ContentItemViewSet, basename='content')
router.register('categories', CategoryViewSet, basename='categories')
router.register('tags', TagViewSet, basename='tags')
router.register('collections', CollectionViewSet, basename='collections')
router.register('suggestions', VisitorSuggestionViewSet, basename='suggestions')
router.register('admin/media', AdminMediaViewSet, basename='admin-media')

urlpatterns = [
    path('admin/media/upload/', MediaUploadAPIView.as_view(), name='media-upload'),
    path('admin/profile/', AdminProfileAPIView.as_view(), name='admin-profile'),
    path('admin/stats/', AdminStatsAPIView.as_view(), name='admin-stats'),
    path('home/', HomeAPIView.as_view(), name='home'),
    path('profile/', ProfileAPIView.as_view(), name='profile'),
    path('media/<int:asset_id>/signed-url/', MediaSignedUrlAPIView.as_view(), name='media-signed-url'),
    path('contact/', ContactAPIView.as_view(), name='contact'),
    path('auth/csrf/', CsrfAPIView.as_view(), name='csrf'),
    path('auth/login/', LoginAPIView.as_view(), name='login'),
    path('auth/logout/', LogoutAPIView.as_view(), name='logout'),
    path('auth/me/', CurrentUserAPIView.as_view(), name='current-user'),
    path('', include(router.urls)),
]
