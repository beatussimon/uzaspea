from rest_framework import viewsets, permissions, status, decorators
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.contrib.auth.models import User
from django.db import models

from .models import (
    StaffProfile, Task, TaskCategory, TaskAction, Approval,
    AuditLog, StaffPermission
)
from marketplace.models import SponsoredListing
from marketplace.serializers import SponsoredListingSerializer
from .serializers import (
    StaffProfileSerializer, TaskSerializer, TaskCategorySerializer,
    TaskActionSerializer, ApprovalSerializer, AuditLogSerializer,
    StaffPermissionSerializer
)


# ============ Custom Permissions ============

class IsAdminUser(permissions.BasePermission):
    """Only superusers can access."""
    def has_permission(self, request, view):
        return request.user and request.user.is_superuser


class IsStaffMember(permissions.BasePermission):
    """Active staff members or superusers."""
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        try:
            return request.user.staff_profile.is_active
        except StaffProfile.DoesNotExist:
            return False


def log_audit(user, action, description, target_user=None, task=None, request=None):
    """Helper to create audit log entries."""
    ip_address = None
    user_agent = ''
    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        ip_address = x_forwarded_for.split(',')[0] if x_forwarded_for else request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')

    AuditLog.objects.create(
        user=user,
        action=action,
        description=description,
        target_user=target_user,
        task=task,
        ip_address=ip_address,
        user_agent=user_agent
    )


# ============ ViewSets ============

class StaffProfileViewSet(viewsets.ModelViewSet):
    queryset = StaffProfile.objects.select_related('user').all()
    serializer_class = StaffProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    @decorators.action(detail=True, methods=['post'])
    def promote(self, request, pk=None):
        """Promote a user to staff."""
        profile = self.get_object()
        profile.is_active = True
        profile.save()
        profile.user.is_staff = True
        profile.user.save()
        log_audit(request.user, 'staff_promoted', f"Promoted {profile.user.username}", target_user=profile.user, request=request)
        return Response({'status': 'promoted'})

    @decorators.action(detail=True, methods=['post'])
    def demote(self, request, pk=None):
        """Demote a staff member."""
        profile = self.get_object()
        if profile.user.is_superuser:
            return Response({'error': 'Cannot demote superusers'}, status=status.HTTP_400_BAD_REQUEST)
        profile.is_active = False
        profile.save()
        profile.user.is_staff = False
        profile.user.save()
        log_audit(request.user, 'staff_demoted', f"Demoted {profile.user.username}", target_user=profile.user, request=request)
        return Response({'status': 'demoted'})


class TaskCategoryViewSet(viewsets.ModelViewSet):
    queryset = TaskCategory.objects.all()
    serializer_class = TaskCategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]


class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        queryset = Task.objects.select_related('assigned_to', 'category', 'created_by').all()
        user = self.request.user

        # Non-admins only see their own tasks
        if not user.is_superuser:
            queryset = queryset.filter(assigned_to=user)

        # Filters
        task_status = self.request.query_params.get('status', None)
        priority = self.request.query_params.get('priority', None)
        assigned_to = self.request.query_params.get('assigned_to', None)
        category = self.request.query_params.get('category', None)

        if task_status:
            queryset = queryset.filter(status=task_status)
        if priority:
            queryset = queryset.filter(priority=priority)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if category:
            queryset = queryset.filter(category_id=category)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        log_audit(self.request.user, 'task_created', f"Created task: {task.title}", task=task, request=self.request)


class TaskActionViewSet(viewsets.ModelViewSet):
    serializer_class = TaskActionSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        queryset = TaskAction.objects.select_related('task', 'performed_by', 'reviewed_by').all()
        user = self.request.user

        if not user.is_superuser:
            queryset = queryset.filter(performed_by=user)

        task_filter = self.request.query_params.get('task', None)
        status_filter = self.request.query_params.get('status', None)

        if task_filter:
            queryset = queryset.filter(task_id=task_filter)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by('-performed_at')

    def perform_create(self, serializer):
        action = serializer.save(performed_by=self.request.user)
        # Auto-create approval record
        Approval.objects.create(
            action=action,
            task=action.task,
            approval_type='action_execution',
            title=f"Action: {action.get_action_type_display()}",
            description=action.description,
            submitted_by=self.request.user
        )
        log_audit(
            self.request.user, 'action_performed',
            f"Performed {action.action_type} on task: {action.task.title}",
            task=action.task, request=self.request
        )

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdminUser])
    def approve(self, request, pk=None):
        """Admin approves a pending action."""
        action = self.get_object()
        if action.status != 'pending':
            return Response({'error': 'Action already reviewed'}, status=status.HTTP_400_BAD_REQUEST)

        action.status = 'approved'
        action.reviewed_by = request.user
        action.reviewed_at = timezone.now()
        action.notes = request.data.get('notes', '')
        action.save()

        log_audit(request.user, 'action_approved', f"Approved: {action.action_type} on {action.task.title}", task=action.task, request=request)
        return Response(TaskActionSerializer(action).data)

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsAdminUser])
    def reject(self, request, pk=None):
        """Admin rejects a pending action."""
        action = self.get_object()
        if action.status != 'pending':
            return Response({'error': 'Action already reviewed'}, status=status.HTTP_400_BAD_REQUEST)

        action.status = 'rejected'
        action.reviewed_by = request.user
        action.reviewed_at = timezone.now()
        action.notes = request.data.get('notes', '')
        action.save()

        log_audit(request.user, 'action_rejected', f"Rejected: {action.action_type} on {action.task.title}", task=action.task, request=request)
        return Response(TaskActionSerializer(action).data)


class ApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ApprovalSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        queryset = Approval.objects.select_related('submitted_by', 'reviewer', 'task', 'action').all()
        user = self.request.user

        if not user.is_superuser:
            queryset = queryset.filter(submitted_by=user)

        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by('-submitted_at')


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related('user', 'target_user', 'task').all()

        action_filter = self.request.query_params.get('action', None)
        user_filter = self.request.query_params.get('user', None)

        if action_filter:
            queryset = queryset.filter(action=action_filter)
        if user_filter:
            queryset = queryset.filter(user_id=user_filter)

        return queryset[:100]


class StaffPermissionViewSet(viewsets.ModelViewSet):
    serializer_class = StaffPermissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        queryset = StaffPermission.objects.select_related('user', 'granted_by').all()
        user_filter = self.request.query_params.get('user', None)
        if user_filter:
            queryset = queryset.filter(user_id=user_filter)
        return queryset

    def perform_create(self, serializer):
        perm = serializer.save(granted_by=self.request.user)
        log_audit(
            self.request.user, 'permission_changed',
            f"Granted {perm.permission} to {perm.user.username}",
            target_user=perm.user, request=self.request
        )


# ============ Staff (Non-Admin) Dashboard & Promotion Review ============

class StaffDashboardView(APIView):
    """Summary payload for non-admin staff: their tasks, pending promos, recent actions."""
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get(self, request):
        user = request.user
        # My tasks
        my_tasks = Task.objects.filter(assigned_to=user).select_related('category').order_by('-created_at')[:10]
        tasks_data = [{
            'id': t.id, 'title': t.title, 'status': t.status,
            'priority': t.priority, 'category': t.category.name if t.category else '',
            'due_date': t.due_date.isoformat() if t.due_date else None,
            'is_overdue': t.is_overdue(),
        } for t in my_tasks]

        # Pending promotions
        pending_promos = SponsoredListing.objects.filter(status='pending').select_related('product', 'user').order_by('-created_at')[:20]
        promos_data = [{
            'id': p.id, 'title': p.title, 'description': p.description,
            'product_name': p.product.name, 'product_slug': p.product.slug,
            'seller': p.user.username, 'status': p.status,
            'created_at': p.created_at.isoformat(),
        } for p in pending_promos]

        # My recent actions
        my_actions = TaskAction.objects.filter(performed_by=user).select_related('task').order_by('-performed_at')[:10]
        actions_data = [{
            'id': a.id, 'task_title': a.task.title, 'action_type': a.action_type,
            'status': a.status, 'performed_at': a.performed_at.isoformat(),
        } for a in my_actions]

        # Stats
        task_counts = {
            'pending': Task.objects.filter(assigned_to=user, status='pending').count(),
            'in_progress': Task.objects.filter(assigned_to=user, status='in_progress').count(),
            'completed': Task.objects.filter(assigned_to=user, status='completed').count(),
        }

        return Response({
            'tasks': tasks_data,
            'task_counts': task_counts,
            'pending_promotions': promos_data,
            'recent_actions': actions_data,
        })


class SponsoredListingReviewViewSet(viewsets.ModelViewSet):
    """Staff can review pending sponsored listings."""
    serializer_class = SponsoredListingSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = SponsoredListing.objects.select_related('product', 'user').order_by('-created_at')
        status_filter = self.request.query_params.get('status', None)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @decorators.action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        listing = self.get_object()
        if listing.status != 'pending':
            return Response({'error': 'Already reviewed'}, status=status.HTTP_400_BAD_REQUEST)
        listing.status = 'approved'
        listing.approved_at = timezone.now()
        listing.admin_notes = request.data.get('notes', '')
        listing.save()
        log_audit(request.user, 'action_approved', f"Approved promotion: {listing.title}", request=request)
        return Response({'status': 'approved', 'id': listing.id})

    @decorators.action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        listing = self.get_object()
        if listing.status != 'pending':
            return Response({'error': 'Already reviewed'}, status=status.HTTP_400_BAD_REQUEST)
        listing.status = 'rejected'
        listing.admin_notes = request.data.get('notes', 'Rejected by staff')
        listing.save()
        log_audit(request.user, 'action_rejected', f"Rejected promotion: {listing.title}", request=request)
        return Response({'status': 'rejected', 'id': listing.id})


class StaffAdminDashboardView(APIView):
    """Deep analytics and staffing overview for Superusers."""
    permission_classes = [permissions.IsAuthenticated, IsAdminUser]

    def get(self, request):
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Employee counts
        total_staff = User.objects.filter(is_staff=True).count()
        active_staff = StaffProfile.objects.filter(is_active=True).count()
        deactivated_staff = StaffProfile.objects.filter(is_active=False).count()

        # Department breakdown
        dept_breakdown = StaffProfile.objects.values('department').annotate(count=models.Count('id')).order_by('-count')

        # Task performance (Month)
        completed_this_month = Task.objects.filter(status='completed', completed_at__gte=start_of_month).count()
        pending_total = Task.objects.filter(status='pending').count()
        overdue_total = sum(1 for t in Task.objects.all() if t.is_overdue())

        # Recent activities (Global)
        recent_logs = AuditLog.objects.select_related('user', 'target_user').order_by('-timestamp')[:15]
        logs_data = [{
            'id': l.id,
            'username': l.user.username if l.user else 'System',
            'action': l.action,
            'description': l.description,
            'target_username': l.target_user.username if l.target_user else None,
            'ip_address': l.ip_address,
            'timestamp': l.timestamp.isoformat()
        } for l in recent_logs]

        # Staff list
        staffers = StaffProfile.objects.select_related('user').all()
        staff_list_data = [{
            'id': s.user.id,
            'profile_id': s.id,
            'username': s.user.username,
            'email': s.user.email,
            'department': s.department,
            'is_active': s.is_active,
            'tasks_count': s.user.assigned_tasks.count(),
        } for s in staffers]

        return Response({
            'counts': {
                'total_staff': total_staff,
                'active_staff': active_staff,
                'deactivated_staff': deactivated_staff,
                'dept_count': dept_breakdown.count(),
            },
            'task_stats': {
                'completed_month': completed_this_month,
                'pending_total': pending_total,
                'overdue_total': overdue_total,
            },
            'departments': list(dept_breakdown),
            'recent_logs': logs_data,
            'staffers': staff_list_data,
        })
