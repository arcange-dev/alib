from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    StaffTwoFactorAPIView, TwoFactorLoginVerifyAPIView,
    AdminAnalyticsAPIView, AdminAuditEventAPIView, AdminNewsletterAPIView, AdminTeamAPIView, AdminTeamMemberAPIView, ContentReactionAPIView, AdminMediaViewSet, AdminProfileAPIView, AdminSiteSettingsAPIView, AdminStatsAPIView, AnalyticsEventAPIView, CategoryViewSet, CollectionViewSet,
    ContactAPIView, ContactInboxAPIView, ContentCommentViewSet, ContentItemViewSet, CsrfAPIView, CurrentUserAPIView, HomeAPIView, LoginAPIView,
    LogoutAPIView, MediaSignedUrlAPIView, MediaUploadAPIView, NewsletterConfirmAPIView, NewsletterSubscribeAPIView, NewsletterUnsubscribeAPIView, PasswordResetConfirmAPIView, PasswordResetRequestAPIView, ScheduledPublishTriggerAPIView, ProfileAPIView, PublicSiteSettingsAPIView, StaffTwoFactorAPIView, TwoFactorLoginVerifyAPIView, TagViewSet,
    VisitorSuggestionViewSet,
)

router = DefaultRouter()
router.register('content', ContentItemViewSet, basename='content')
router.register('categories', CategoryViewSet, basename='categories')
router.register('tags', TagViewSet, basename='tags')
router.register('collections', CollectionViewSet, basename='collections')
router.register('suggestions', VisitorSuggestionViewSet, basename='suggestions')
router.register('comments', ContentCommentViewSet, basename='comments')
router.register('admin/media', AdminMediaViewSet, basename='admin-media')

urlpatterns = [
    path('admin/media/upload/', MediaUploadAPIView.as_view(), name='media-upload'),
    path('admin/profile/', AdminProfileAPIView.as_view(), name='admin-profile'),
    path('admin/stats/', AdminStatsAPIView.as_view(), name='admin-stats'),
    path('admin/analytics/', AdminAnalyticsAPIView.as_view(), name='admin-analytics'),
    path('admin/audit/', AdminAuditEventAPIView.as_view(), name='admin-audit'),
    path('admin/newsletter/', AdminNewsletterAPIView.as_view(), name='admin-newsletter'),
    path('admin/team/', AdminTeamAPIView.as_view(), name='admin-team'),
    path('admin/maintenance/publish-scheduled/', ScheduledPublishTriggerAPIView.as_view(), name='trigger-publish-scheduled'),
    path('admin/team/<int:user_id>/', AdminTeamMemberAPIView.as_view(), name='admin-team-member'),
    path('admin/settings/', AdminSiteSettingsAPIView.as_view(), name='admin-site-settings'),
    path('admin/contact/', ContactInboxAPIView.as_view(), name='admin-contact-inbox'),
    path('analytics/event/', AnalyticsEventAPIView.as_view(), name='analytics-event'),
    path('newsletter/subscribe/', NewsletterSubscribeAPIView.as_view(), name='newsletter-subscribe'),
    path('newsletter/confirm/<str:token>/', NewsletterConfirmAPIView.as_view(), name='newsletter-confirm'),
    path('newsletter/unsubscribe/', NewsletterUnsubscribeAPIView.as_view(), name='newsletter-unsubscribe'),
    path('home/', HomeAPIView.as_view(), name='home'),
    path('profile/', ProfileAPIView.as_view(), name='profile'),
    path('settings/', PublicSiteSettingsAPIView.as_view(), name='public-site-settings'),
    path('media/<int:asset_id>/signed-url/', MediaSignedUrlAPIView.as_view(), name='media-signed-url'),
    path('contact/', ContactAPIView.as_view(), name='contact'),
    path('auth/csrf/', CsrfAPIView.as_view(), name='csrf'),
    path('auth/login/', LoginAPIView.as_view(), name='login'),
    path('auth/2fa/', StaffTwoFactorAPIView.as_view(), name='staff-two-factor'),
    path('auth/2fa/verify-login/', TwoFactorLoginVerifyAPIView.as_view(), name='verify-two-factor-login'),
    path('auth/logout/', LogoutAPIView.as_view(), name='logout'),
    path('auth/me/', CurrentUserAPIView.as_view(), name='current-user'),
    path('auth/password-reset/', PasswordResetRequestAPIView.as_view(), name='password-reset-request'),
    path('auth/password-reset/confirm/', PasswordResetConfirmAPIView.as_view(), name='password-reset-confirm'),
    path('content/<int:item_id>/reactions/', ContentReactionAPIView.as_view(), name='content-reactions'),
    path('', include(router.urls)),
]
