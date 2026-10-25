from rest_framework.permissions import SAFE_METHODS, BasePermission

ADMIN_GROUP = 'ALIB Administrators'
EDITOR_GROUP = 'ALIB Editors'
MODERATOR_GROUP = 'ALIB Moderators'
SUPPORT_GROUP = 'ALIB Support'
KNOWN_ROLES = {ADMIN_GROUP, EDITOR_GROUP, MODERATOR_GROUP, SUPPORT_GROUP}


def role_names(user):
    if not user or not user.is_authenticated or not getattr(user, 'is_staff', False):
        return set()
    if user.is_superuser:
        return {ADMIN_GROUP, EDITOR_GROUP, MODERATOR_GROUP, SUPPORT_GROUP}
    return set(user.groups.filter(name__in=KNOWN_ROLES).values_list('name', flat=True))


def can_moderate(user):
    if not user or not user.is_authenticated or not getattr(user, 'is_staff', False):
        return False
    if user.is_superuser:
        return True
    roles = role_names(user)
    if roles:
        return bool(roles.intersection({ADMIN_GROUP, MODERATOR_GROUP}))
    return True


def can_manage_content(user):
    if not user or not user.is_authenticated or not getattr(user, 'is_staff', False):
        return False
    if user.is_superuser:
        return True
    roles = role_names(user)
    if roles:
        return bool(roles.intersection({ADMIN_GROUP, EDITOR_GROUP}))
    # Existing staff accounts without assigned roles retain the historical editor
    # access until an administrator assigns a least-privilege role.
    return True


class IsALIBAdministrator(BasePermission):
    def has_permission(self, request, view):
        return ADMIN_GROUP in role_names(request.user)


class IsALIBEditor(BasePermission):
    def has_permission(self, request, view):
        return can_manage_content(request.user)


class IsALIBModerator(BasePermission):
    def has_permission(self, request, view):
        return can_moderate(request.user)


class IsALIBStaff(BasePermission):
    def has_permission(self, request, view):
        return bool(role_names(request.user)) or bool(
            request.user and request.user.is_authenticated and request.user.is_staff
            and not request.user.groups.filter(name__in=KNOWN_ROLES).exists()
        )


class PublicReadAdminWrite(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return can_manage_content(request.user)
