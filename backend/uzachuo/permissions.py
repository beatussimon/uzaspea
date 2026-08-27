from rest_framework import permissions
from django.db import models
from staff.models import StaffPermission

def has_staff_permission(user, permission_codename):
    """Check if a user has a specific staff permission."""
    from django.utils import timezone
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
    """Active staff members or superusers, or warehouse staff/managers."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        try:
            if request.user.staff_profile.is_active:
                return True
        except AttributeError:
            pass
            
        from warehouses.models import WarehouseStaffAssignment
        return WarehouseStaffAssignment.objects.filter(user=request.user).exists()

class IsAssignedInspectorOrStaff(permissions.BasePermission):
    """
    Allows access to superusers, managers (can_manage_inspections), 
    or the inspector currently assigned to the request.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser:
            return True
        
        # Check if user is staff with management perm
        if has_staff_permission(user, 'can_manage_inspections'):
            return True
            
        # Check if user is the assigned inspector
        # This assumes the object has an assignment or a 'request' field leading to an assignment
        from inspections.models import InspectionRequest, InspectionAssignment
        
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
    from django.db.models import Q

    # Query active, accepted team memberships where the owner has active business subscription or tier
    qs = TeamMember.objects.filter(
        user=user, 
        invitation_status='accepted', 
        is_active=True
    ).select_related('owner', 'owner__profile')

    valid_owners = []
    for tm in qs:
        owner = tm.owner
        is_owner_business = (
            getattr(getattr(owner, 'profile', None), 'tier', None) == 'business' or
            owner.subscriptions.filter(is_active=True, tier__tier_level='business').exists() or
            owner.is_superuser
        )
        if not is_owner_business:
            continue
        if required_permission:
            if isinstance(tm.permissions, dict) and tm.permissions.get(required_permission, False):
                valid_owners.append(tm.owner_id)
        else:
            valid_owners.append(tm.owner_id)

    if include_self:
        # If user is a worker without independent seller status, we still include user.id if not strictly team-scoped
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
        member = TeamMember.objects.get(
            owner_id=owner_id, 
            user=user, 
            invitation_status='accepted', 
            is_active=True
        )
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
        if user.is_superuser:
            return True
        profile = getattr(user, 'profile', None)
        if profile and profile.tier == 'business':
            return True
        return user.subscriptions.filter(is_active=True, tier__tier_level='business').exists()


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
                # Owner themselves
                profile = getattr(user, 'profile', None)
                if profile and profile.tier in ['seller_pro', 'business']:
                    return True
                if user.subscriptions.filter(is_active=True, tier__tier_level__in=['seller_pro', 'business']).exists():
                    return True
                # Team member check
                from marketplace.models import TeamMember
                return TeamMember.objects.filter(
                    user=user,
                    invitation_status='accepted',
                    is_active=True,
                    permissions__contains={perm_name: True}
                ).exists()
        return _DynamicPermission


class IsOwnerOrStaff(permissions.BasePermission):
    """
    Allows access to superusers, staff, or the owner of the object.
    Assumes object has a 'user' or 'seller' or 'client' attribute.
    Also supports active team members representing the owner.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        is_staff_active = False
        try:
            is_staff_active = user.is_staff and user.staff_profile.is_active
        except AttributeError:
            is_staff_active = False

        if user.is_superuser or is_staff_active:
            return True
            
        owner = getattr(obj, 'user', getattr(obj, 'seller', getattr(obj, 'client', None)))
        if owner == user:
            return True

        if owner:
            # Check team memberships
            from marketplace.models import TeamMember
            # If the object is a Product
            if hasattr(obj, 'seller') and hasattr(obj, 'price'):
                return TeamMember.objects.filter(owner=owner, user=user, invitation_status='accepted', is_active=True, permissions__manage_products=True).exists()
            # If the object is an Order
            elif hasattr(obj, 'status') and hasattr(obj, 'total_amount'):
                return TeamMember.objects.filter(owner=owner, user=user, invitation_status='accepted', is_active=True, permissions__manage_orders=True).exists()
            # General fallback check: is the user an active accepted team member
            return TeamMember.objects.filter(owner=owner, user=user, invitation_status='accepted', is_active=True).exists()

        return False


class IsSellerOrAbove(permissions.BasePermission):
    """Requires an active Seller Pro or Business tier subscription or being an active team member with manage_products permission."""
    message = 'A Seller Pro or Business subscription is required to perform this action.'

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_staff or request.user.is_superuser:
            return True
        # Either the user has active subscription themselves:
        has_sub = request.user.subscriptions.filter(
            is_active=True,
            tier__tier_level__in=['seller_pro', 'business']
        ).exists() or (getattr(request.user, 'profile', None) and request.user.profile.tier in ['seller_pro', 'business'])
        if has_sub:
            return True
        # Or the user is an active team member of a Business owner with manage_products permission:
        from marketplace.models import TeamMember
        return TeamMember.objects.filter(
            user=request.user,
            invitation_status='accepted',
            is_active=True,
            owner__subscriptions__is_active=True,
            owner__subscriptions__tier__tier_level='business',
            permissions__manage_products=True
        ).exists()


