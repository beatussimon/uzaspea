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

def get_effective_sellers(user, required_permission=None):
    """
    Returns a list of user IDs that this user can act as seller for.
    Includes the user's own ID, plus any team owners they belong to —
    but only owners who have granted `required_permission` to this user,
    if a required_permission is specified. Owner-status itself (no permission
    check) is used only when required_permission is None, for backward-compat
    call sites that are being phased out — new call sites should always pass
    a required_permission.
    """
    if not user or not user.is_authenticated:
        return []
    from marketplace.models import TeamMember
    qs = TeamMember.objects.filter(user=user, invitation_status='accepted', is_active=True)
    if required_permission:
        owners = [
            tm.owner_id for tm in qs
            if isinstance(tm.permissions, dict) and tm.permissions.get(required_permission, False)
        ]
    else:
        owners = list(qs.values_list('owner_id', flat=True))
    return [user.id] + owners


def check_team_permission(user, owner_id, permission_name):
    """
    Checks if a user has a specific permission in the owner's team.
    If the user is the owner themselves, they always have permission.
    If the user is a team member, they must have the permission set to True.
    """
    if not user or not user.is_authenticated:
        return False
    if user.id == owner_id:
        return True
    from marketplace.models import TeamMember
    try:
        member = TeamMember.objects.get(owner_id=owner_id, user=user)
        return bool(member.permissions.get(permission_name, False))
    except TeamMember.DoesNotExist:
        return False


class IsOwnerOrStaff(permissions.BasePermission):
    """
    Allows access to superusers, staff, or the owner of the object.
    Assumes object has a 'user' or 'seller' or 'client' attribute.
    Also supports team members representing the owner.
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
                return TeamMember.objects.filter(owner=owner, user=user, permissions__manage_products=True).exists()
            # If the object is an Order
            elif hasattr(obj, 'status') and hasattr(obj, 'total_amount'):
                return TeamMember.objects.filter(owner=owner, user=user, permissions__manage_orders=True).exists()
            # General fallback check: is the user a team member
            return TeamMember.objects.filter(owner=owner, user=user).exists()

        return False


class IsSellerOrAbove(permissions.BasePermission):
    """Requires an active Seller Pro or Business tier subscription or being a team member with manage_products permission."""
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
        ).exists()
        if has_sub:
            return True
        # Or the user is a team member of a Business owner with manage_products permission:
        from marketplace.models import TeamMember
        return TeamMember.objects.filter(
            user=request.user,
            owner__subscriptions__is_active=True,
            owner__subscriptions__tier__tier_level='business',
            permissions__manage_products=True
        ).exists()

