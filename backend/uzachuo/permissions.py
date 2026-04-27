from rest_framework import permissions
from staff.models import StaffPermission

def has_staff_permission(user, permission_codename):
    """Check if a user has a specific staff permission."""
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return StaffPermission.objects.filter(user=user, permission=permission_codename, is_active=True).exists()

class IsSuperUser(permissions.BasePermission):
    """Only superusers can access."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)

class IsStaffMember(permissions.BasePermission):
    """Active staff members or superusers."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        try:
            return request.user.staff_profile.is_active
        except:
            return False

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

class IsOwnerOrStaff(permissions.BasePermission):
    """
    Allows access to superusers, staff, or the owner of the object.
    Assumes object has a 'user' or 'seller' or 'client' attribute.
    """
    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.is_superuser or user.is_staff:
            return True
            
        owner = getattr(obj, 'user', getattr(obj, 'seller', getattr(obj, 'client', None)))
        return owner == user
