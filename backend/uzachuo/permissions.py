from rest_framework import permissions
from django.db import models
from django.utils import timezone
from staff.models import StaffPermission


def _active_sub_q():
    return models.Q(end_date__isnull=True) | models.Q(end_date__gt=timezone.now())


def _safe_int(val):
    if val is None or val == '':
        return None
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def has_staff_permission(user, permission_codename):
    """Check if a user has a specific staff permission."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    # FIX: S-09 — enforce expiry date on time-limited permissions
    return StaffPermission.objects.filter(
        user=user,
        permission=permission_codename,
        is_active=True,
    ).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
    ).exists()


class IsSuperUser(permissions.BasePermission):
    """Only superusers can access."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class IsStaffMember(permissions.BasePermission):
    """Active platform staff members or superusers."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        try:
            if request.user.staff_profile.is_active:
                return True
        except AttributeError:
            pass
        return False


class IsWarehouseStaff(permissions.BasePermission):
    """Active staff, superusers, or users assigned to a warehouse."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser or request.user.is_staff:
            return True
        try:
            if request.user.staff_profile.is_active:
                return True
        except AttributeError:
            pass

        from warehouses.models import WarehouseStaffAssignment
        return WarehouseStaffAssignment.objects.filter(user=request.user).exists()


class CanManageUsers(permissions.BasePermission):
    """Allows superusers or staff with can_manage_users permission."""
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or has_staff_permission(user, 'can_manage_users')))


class HasInspectionManagerPermission(permissions.BasePermission):
    """Allows access to superusers or staff with can_manage_inspections."""
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or has_staff_permission(user, 'can_manage_inspections')))


class IsAssignedInspectorOrStaff(permissions.BasePermission):
    """
    Allows access to superusers, managers (can_manage_inspections),
    or the inspector currently assigned to the request.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True

        # Check if user is staff with management perm
        if has_staff_permission(user, 'can_manage_inspections'):
            return True

        # Check if user is the assigned inspector
        from inspections.models import InspectionRequest

        inspection_request = None
        if isinstance(obj, InspectionRequest):
            inspection_request = obj
        elif hasattr(obj, 'request'):
            inspection_request = obj.request

        if inspection_request:
            return inspection_request.assignments.filter(
                inspector__user=user,
                is_active=True
            ).exists()

        return False


def _user_is_active_business_owner(owner) -> bool:
    if not owner:
        return False
    if owner.is_superuser:
        return True
    if owner.subscriptions.filter(_active_sub_q(), is_active=True, tier__tier_level='business').exists():
        return True
    if getattr(getattr(owner, 'profile', None), 'tier', None) == 'business':
        # Only honor profile.tier == 'business' when there is no expired subscription overriding it,
        # or if owner has an active business subscription
        has_any_sub = owner.subscriptions.filter(tier__tier_level='business').exists()
        if not has_any_sub:
            return True
    return False


def get_effective_sellers(user, required_permission=None, include_self=True):
    """
    Returns a list of user IDs that this user can act as seller for.
    Includes the user's own ID (if include_self=True and user is an independent seller/user),
    plus any team owners they belong to —
    but only owners who have an active Business tier subscription and have granted
    `required_permission` to this user (if specified).
    """
    if not user or not user.is_authenticated:
        return []
    from marketplace.models import TeamMember

    qs = TeamMember.objects.filter(
        user=user,
        invitation_status='accepted',
        is_active=True
    ).select_related('owner', 'owner__profile')

    valid_owners = []
    for tm in qs:
        owner = tm.owner
        if not _user_is_active_business_owner(owner):
            continue
        if required_permission:
            if isinstance(tm.permissions, dict):
                has_perm = tm.permissions.get(required_permission, False)
                if not has_perm and required_permission in ('access_pos', 'pos_access'):
                    has_perm = bool(tm.permissions.get('access_pos') or tm.permissions.get('pos_access'))
                if has_perm:
                    valid_owners.append(tm.owner_id)
        else:
            valid_owners.append(tm.owner_id)

    if include_self:
        return [user.id] + valid_owners
    return valid_owners


def check_team_permission(user, owner_id, permission_name):
    """
    Checks if a user has a specific permission in the owner's team.
    If the user is the owner themselves, they always have permission.
    If the user is a team member, they must be active and have the permission set to True.
    """
    if not user or not user.is_authenticated:
        return False
    if user.id == owner_id or user.is_superuser:
        return True
    from marketplace.models import TeamMember
    try:
        member = TeamMember.objects.select_related('owner', 'owner__profile').get(
            owner_id=owner_id,
            user=user,
            invitation_status='accepted',
            is_active=True
        )
        if not _user_is_active_business_owner(member.owner):
            return False
        if not isinstance(member.permissions, dict):
            return False
        if permission_name in ('access_pos', 'pos_access'):
            return bool(member.permissions.get('access_pos') or member.permissions.get('pos_access'))
        return bool(member.permissions.get(permission_name, False))
    except TeamMember.DoesNotExist:
        return False


class IsActiveBusinessOwner(permissions.BasePermission):
    """Only active Business tier owners or superusers can access."""
    message = 'Only users with an active Business tier subscription can manage teams.'

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return _user_is_active_business_owner(user)


class HasTeamPermission:
    """Helper generator to enforce specific team permission flags."""
    def __init__(self, permission_name):
        self.permission_name = permission_name

    def __call__(self):
        perm_name = self.permission_name

        class _DynamicPermission(permissions.BasePermission):
            def has_permission(self, request, view):
                user = request.user
                if not user or not user.is_authenticated:
                    return False
                if user.is_superuser or user.is_staff:
                    return True
                if user.subscriptions.filter(
                    _active_sub_q(),
                    is_active=True,
                    tier__tier_level__in=['seller_lite', 'seller_pro', 'business'],
                ).exists():
                    return True
                from marketplace.models import TeamMember
                qs = TeamMember.objects.filter(
                    user=user,
                    invitation_status='accepted',
                    is_active=True,
                ).select_related('owner', 'owner__profile')
                for tm in qs:
                    if not _user_is_active_business_owner(tm.owner):
                        continue
                    perms = tm.permissions if isinstance(tm.permissions, dict) else {}
                    if perm_name in ('access_pos', 'pos_access'):
                        if perms.get('access_pos') or perms.get('pos_access'):
                            return True
                    elif perms.get(perm_name):
                        return True
                return False

        return _DynamicPermission


class IsOwnerOrStaff(permissions.BasePermission):
    """
    Allows access to superusers, staff, or the owner of the object.
    Assumes object has a 'user' or 'seller' or 'client' attribute.
    Also supports active team members representing the owner.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        is_staff_active = False
        try:
            is_staff_active = user.is_staff and user.staff_profile.is_active
        except AttributeError:
            is_staff_active = False

        if user.is_superuser or is_staff_active:
            return True

        owner = getattr(obj, 'user', getattr(obj, 'seller', getattr(obj, 'client', None)))
        if not owner and hasattr(obj, 'product'):
            owner = getattr(obj.product, 'seller', None)
        if owner == user:
            return True

        if owner and _user_is_active_business_owner(owner):
            from marketplace.models import TeamMember
            if hasattr(obj, 'seller') and hasattr(obj, 'price'):
                return TeamMember.objects.filter(owner=owner, user=user, invitation_status='accepted', is_active=True, permissions__manage_products=True).exists()
            elif hasattr(obj, 'status') and hasattr(obj, 'total_amount'):
                return TeamMember.objects.filter(owner=owner, user=user, invitation_status='accepted', is_active=True, permissions__manage_orders=True).exists()
            return TeamMember.objects.filter(owner=owner, user=user, invitation_status='accepted', is_active=True).exists()

        return False


class IsSellerOrAbove(permissions.BasePermission):
    """Requires an active Seller Lite/Pro/Business tier subscription or being an active team member with manage_products permission."""
    message = 'Your seller subscription has expired. Please renew your subscription to perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        has_sub = request.user.subscriptions.filter(
            _active_sub_q(),
            is_active=True,
            tier__tier_level__in=['seller_lite', 'seller_pro', 'business'],
        ).exists()
        if has_sub:
            return True
        from marketplace.models import TeamMember
        return TeamMember.objects.filter(
            models.Q(owner__subscriptions__end_date__isnull=True) | models.Q(owner__subscriptions__end_date__gt=timezone.now()),
            user=request.user,
            invitation_status='accepted',
            is_active=True,
            owner__subscriptions__is_active=True,
            owner__subscriptions__tier__tier_level='business',
            permissions__manage_products=True,
        ).exists()


class IsPOSOperatorOrSeller(permissions.BasePermission):
    """
    Allows active sellers (Seller Lite / Seller Pro / Business) OR active accepted
    TeamMembers of an active Business owner granted `access_pos` / `pos_access`.
    """
    message = 'You do not have active POS operator or seller permissions.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if IsSellerOrAbove().has_permission(request, view):
            return True
        from marketplace.models import TeamMember
        memberships = TeamMember.objects.filter(
            user=request.user,
            invitation_status='accepted',
            is_active=True,
        ).select_related('owner', 'owner__profile')
        for tm in memberships:
            if not _user_is_active_business_owner(tm.owner):
                continue
            perms = tm.permissions if isinstance(tm.permissions, dict) else {}
            if perms.get('access_pos') or perms.get('pos_access'):
                return True
        return False


def get_user_location_scope(user, requested_location_id=None):
    """
    Returns (allowed_location_ids, active_location) for the given user.
    Safely parses `requested_location_id` so malformed query/body values never raise ValueError (500).
    """
    if not user or not user.is_authenticated:
        return ([], None)

    from marketplace.models import StoreLocation, TeamMember
    req_loc_id = _safe_int(requested_location_id)

    if user.is_superuser:
        all_ids = list(StoreLocation.objects.filter(is_active=True).values_list('id', flat=True))
        active = None
        if req_loc_id is not None:
            active = StoreLocation.objects.filter(id=req_loc_id, is_active=True).first()
        if not active and all_ids:
            active = StoreLocation.objects.filter(id=all_ids[0]).first()
        return (all_ids, active)

    owned_locs = list(StoreLocation.objects.filter(owner=user, is_active=True).values_list('id', flat=True))
    if owned_locs:
        active = None
        if req_loc_id is not None and req_loc_id in owned_locs:
            active = StoreLocation.objects.filter(owner=user, id=req_loc_id, is_active=True).first()
        if not active:
            active = (
                StoreLocation.objects.filter(owner=user, is_main=True, is_active=True).first()
                or StoreLocation.objects.filter(owner=user, id=owned_locs[0]).first()
            )
        return (owned_locs, active)

    memberships = TeamMember.objects.filter(
        user=user, invitation_status='accepted', is_active=True
    ).select_related('owner', 'owner__profile').prefetch_related('assigned_locations')

    allowed_ids = set()
    for tm in memberships:
        if not _user_is_active_business_owner(tm.owner):
            continue
        if tm.all_locations_access:
            owner_locs = StoreLocation.objects.filter(owner=tm.owner, is_active=True).values_list('id', flat=True)
            allowed_ids.update(owner_locs)
        else:
            assigned = tm.assigned_locations.filter(is_active=True).values_list('id', flat=True)
            allowed_ids.update(assigned)

    allowed_list = list(allowed_ids)
    active = None
    if req_loc_id is not None and req_loc_id in allowed_list:
        active = StoreLocation.objects.filter(id=req_loc_id, is_active=True).first()
    elif allowed_list:
        active = (
            StoreLocation.objects.filter(id__in=allowed_list, is_main=True, is_active=True).first()
            or StoreLocation.objects.filter(id=allowed_list[0]).first()
        )

    return (allowed_list, active)
