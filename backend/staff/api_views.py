from rest_framework import viewsets, permissions, status, decorators
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.core.exceptions import ObjectDoesNotExist

from .models import (
    StaffProfile, Task, TaskCategory, TaskAction, Approval,
    AuditLog, StaffPermission
)
from marketplace.models import SponsoredListing
from marketplace.serializers import SponsoredListingSerializer
from .serializers import (
    StaffProfileSerializer, TaskSerializer, TaskCategorySerializer,
    TaskActionSerializer, ApprovalSerializer, AuditLogSerializer,
    StaffPermissionSerializer, DepartmentSerializer
)


from uzachuo.permissions import IsSuperUser, IsStaffMember, has_staff_permission

class DepartmentViewSet(viewsets.ReadOnlyModelViewSet):
    from .models import Department
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]


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
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

    @decorators.action(detail=True, methods=['post'])
    def promote(self, request, pk=None):
        """Promote a user to staff."""
        profile = self.get_object()
        profile.is_active = True
        profile.save()
        
        # Ensure the underlying User object is also marked as staff
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

        # Non-admins only see their own tasks AND unassigned tasks (open pool)
        if not user.is_superuser:
            queryset = queryset.filter(models.Q(assigned_to=user) | models.Q(assigned_to__isnull=True))

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
        user = self.request.user
        if not (user.is_superuser or has_staff_permission(user, 'can_manage_tasks')):
             # We could raise a ValidationError or handle it via permissions classes, 
             # but here we'll raise a 403-like error.
             raise permissions.exceptions.PermissionDenied("You do not have permission to assign tasks.")
        
        task = serializer.save(created_by=user)
        log_audit(user, 'task_created', f"Created task: {task.title}", task=task, request=self.request)

    @decorators.action(detail=False, methods=['get'])
    def assignable_users(self, request):
        """Returns a list of users that can be assigned tasks."""
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_tasks')):
            return Response({'error': 'No permission to view assignable users'}, status=403)
        
        users = User.objects.filter(is_staff=True, is_active=True).values('id', 'username', 'first_name', 'last_name')
        return Response(list(users))

    @decorators.action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        task = self.get_object()
        if task.assigned_to != request.user and not request.user.is_superuser:
            return Response({'error': 'Only assigned staff can start this task'}, status=403)
        if task.status != 'pending':
            return Response({'error': f'Task in {task.status} status cannot be started'}, status=400)
        task.status = 'in_progress'
        task.save()
        log_audit(request.user, 'task_updated', f"Started task: {task.title}", task=task, request=request)
        return Response({'status': 'in_progress'})

    @decorators.action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        task = self.get_object()
        if task.assigned_to != request.user and not request.user.is_superuser:
            return Response({'error': 'Only assigned staff can complete this task'}, status=403)
        if task.status != 'in_progress':
            return Response({'error': 'Task must be in progress to complete'}, status=400)
        task.status = 'completed'
        task.completed_at = timezone.now()
        task.save()
        log_audit(request.user, 'task_completed', f"Completed task: {task.title}", task=task, request=request)
        return Response({'status': 'completed'})

    @decorators.action(detail=True, methods=['post'])
    def reassign(self, request, pk=None):
        """Admin action: reassign a task."""
        task = self.get_object()
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_tasks')):
            return Response({'error': 'No permission to reassign tasks'}, status=403)
        
        new_user_id = request.data.get('assigned_to')
        if not new_user_id:
            return Response({'error': 'assigned_to is required'}, status=400)
        
        new_user = get_object_or_404(User, id=new_user_id)
        old_user = task.assigned_to
        task.assigned_to = new_user
        task.save()
        
        log_audit(request.user, 'task_assigned', 
                 f"Reassigned {task.title} from {old_user.username if old_user else 'None'} to {new_user.username}", 
                 task=task, target_user=new_user, request=request)
        return Response({'status': 'reassigned', 'assigned_to': new_user.username})

    @decorators.action(detail=True, methods=['post'])
    def claim(self, request, pk=None):
        """Staff claims an unassigned task."""
        task = self.get_object()
        if task.assigned_to:
            return Response({'error': 'Task already assigned'}, status=400)
        
        task.assigned_to = request.user
        task.status = 'pending'
        task.save()
        log_audit(request.user, 'task_updated', f"Claimed task: {task.title}", task=task, request=request)
        return Response({'status': 'claimed'})

    @decorators.action(detail=True, methods=['post'])
    def hold(self, request, pk=None):
        """Assigned staff puts task on hold."""
        task = self.get_object()
        if task.assigned_to != request.user and not request.user.is_superuser:
            return Response({'error': 'Not your task'}, status=403)
        
        reason = request.data.get('reason', 'No reason provided')
        task.status = 'on_hold'
        task.save()
        log_audit(request.user, 'task_updated', f"Task on hold: {task.title}. Reason: {reason}", task=task, request=request)
        return Response({'status': 'on_hold'})

    @decorators.action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Admin or assigned staff can cancel a task."""
        task = self.get_object()
        can_cancel = request.user.is_superuser or \
                     has_staff_permission(request.user, 'can_manage_tasks') or \
                     task.assigned_to == request.user
        
        if not can_cancel:
            return Response({'error': 'No permission to cancel this task'}, status=403)
        
        reason = request.data.get('reason', 'No reason provided')
        task.status = 'cancelled'
        task.save()
        log_audit(request.user, 'task_cancelled', f"Cancelled task: {task.title}. Reason: {reason}", task=task, request=request)
        return Response({'status': 'cancelled'})


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

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperUser])
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

    @decorators.action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsSuperUser])
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
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related('user', 'target_user', 'task').all()

        action_filter = self.request.query_params.get('action', None)
        user_filter = self.request.query_params.get('user', None)
        search = self.request.query_params.get('search') or self.request.query_params.get('q')

        if action_filter and action_filter != 'all':
            queryset = queryset.filter(action=action_filter)
        if user_filter:
            queryset = queryset.filter(user_id=user_filter)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(description__icontains=search) | Q(action__icontains=search) | Q(ip_address__icontains=search)
            )

        return queryset.order_by('-timestamp')


class StaffPermissionViewSet(viewsets.ModelViewSet):
    serializer_class = StaffPermissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

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
    throttle_classes = []

    def get(self, request):
        user = request.user
        
        from django.core.cache import cache
        cache_key = f"staff_dashboard_summary_{user.id}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        priority_order = models.Case(
            models.When(priority='urgent', then=models.Value(1)),
            models.When(priority='high', then=models.Value(2)),
            models.When(priority='medium', then=models.Value(3)),
            models.When(priority='low', then=models.Value(4)),
            default=models.Value(5),
            output_field=models.IntegerField(),
        )

        # My tasks
        my_tasks = Task.objects.filter(assigned_to=user).select_related('category').annotate(
            priority_rank=priority_order
        ).order_by('priority_rank', '-created_at')[:15]
        
        # Unassigned (Claimable) Pool - tasks in same department or general
        profile = getattr(user, 'staff_profile', None)
        unassigned_q = Q(assigned_to=None)
        if profile and profile.department:
            unassigned_q &= (Q(category__department=profile.department) | Q(category__department=None))
            
        unassigned_tasks = Task.objects.filter(unassigned_q).exclude(status__in=['completed', 'cancelled']).select_related('category').annotate(
            priority_rank=priority_order
        ).order_by('priority_rank', '-created_at')[:10]

        def fmt_task(t):
            return {
                'id': t.id, 'title': t.title, 'status': t.status,
                'priority': t.priority, 'category': t.category.name if t.category else '',
                'due_date': t.due_date.isoformat() if t.due_date else None,
                'is_overdue': t.is_overdue(),
            }

        # Pending promotions (Only if have permission)
        promos_data = []
        if has_staff_permission(user, 'can_review_promotions') or has_staff_permission(user, 'can_approve_content'):
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
            'on_hold': Task.objects.filter(assigned_to=user, status='on_hold').count(),
            'completed': Task.objects.filter(assigned_to=user, status='completed').count(),
            'unassigned': Task.objects.filter(assigned_to=None).exclude(status='completed').count(),
        }

        admin_overview = None
        admin_task_metrics = None
        if user.is_superuser:
            from marketplace.models import PaymentConfirmation, SellerApplication, Product, Review, Order
            from billing.models import CommissionPayment
            from inspections.models import InspectionRequest
            from django.db.models import Count
            
            admin_overview = {
                'subscriptions_pending': PaymentConfirmation.objects.filter(status='pending').count(),
                'seller_upgrades_pending': SellerApplication.objects.filter(status='pending').count(),
                'commissions_pending': CommissionPayment.objects.filter(status='PENDING').count(),
                'products_pending': Product.objects.filter(is_available=False).count(),
                'reviews_pending': Review.objects.filter(approved=False).count(),
                'warehouse_intake_pending': Order.objects.filter(status='SHIPPED_TO_WAREHOUSE').count(),
                'logistics_in_transit': Order.objects.filter(status__in=['IN_TRANSIT', 'SHIPPED', 'OUT_FOR_DELIVERY']).count(),
                'inspections_pending': InspectionRequest.objects.filter(status__in=['pending', 'assigned']).count(),
            }

            # Global Task Counts for Admin Analytics
            global_counts = {
                'pending': Task.objects.filter(status='pending').count(),
                'in_progress': Task.objects.filter(status='in_progress').count(),
                'on_hold': Task.objects.filter(status='on_hold').count(),
                'completed': Task.objects.filter(status='completed').count(),
                'unassigned': Task.objects.filter(assigned_to=None).exclude(status='completed').count(),
            }

            # Worker Performance Aggregation
            worker_stats = Task.objects.exclude(assigned_to=None).values(
                'assigned_to__username', 'status'
            ).annotate(count=Count('id'))

            perf_dict = {}
            for stat in worker_stats:
                username = stat['assigned_to__username']
                status = stat['status']
                count = stat['count']
                
                if username not in perf_dict:
                    perf_dict[username] = {'worker': username, 'completed': 0, 'pending': 0, 'in_progress': 0, 'on_hold': 0}
                
                if status in ['pending', 'in_progress', 'completed', 'on_hold']:
                    perf_dict[username][status] = count

            admin_task_metrics = {
                'global_counts': global_counts,
                'worker_performance': list(perf_dict.values())
            }

        response_data = {
            'user': {
                'username': user.username,
                'is_inspector': hasattr(user, 'inspector_profile'),
                'is_superuser': user.is_superuser,
                'permissions': list(StaffPermission.objects.filter(user=user, is_active=True).values_list('permission', flat=True))
            },
            'tasks': [fmt_task(t) for t in my_tasks],
            'unassigned_tasks': [fmt_task(t) for t in unassigned_tasks],
            'task_counts': task_counts,
            'pending_promotions': promos_data,
            'recent_actions': actions_data,
            'admin_overview': admin_overview,
            'admin_task_metrics': admin_task_metrics,
        }
        
        cache.set(cache_key, response_data, timeout=60)
        return Response(response_data)


class SponsoredListingReviewViewSet(viewsets.ModelViewSet):
    """Staff can review pending sponsored listings."""
    serializer_class = SponsoredListingSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        user = self.request.user
        if not (user.is_superuser or has_staff_permission(user, 'can_review_promotions') or has_staff_permission(user, 'can_approve_content')):
            return SponsoredListing.objects.none()

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
        from datetime import timedelta
        duration = listing.duration_days if listing.duration_days and listing.duration_days > 0 else 7
        listing.expires_at = timezone.now() + timedelta(days=duration)
        listing.admin_notes = request.data.get('notes', '')
        listing.save()
        log_audit(request.user, 'action_approved', f"Approved promotion: {listing.title}", request=request)

        # Send push notification to seller
        try:
            from marketplace.models import push_notification
            product_name = listing.product.name if listing.product else "Product"
            push_notification(
                listing.user,
                'sponsored_approved',
                f'Promotion Approved: {listing.title or product_name}',
                f'Your campaign for "{product_name}" is now live and will run for {duration} days.',
                '/dashboard/promotions'
            )
        except Exception:
            pass

        return Response({'status': 'approved', 'id': listing.id, 'expires_at': listing.expires_at})

    @decorators.action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        listing = self.get_object()
        if listing.status != 'pending':
            return Response({'error': 'Already reviewed'}, status=status.HTTP_400_BAD_REQUEST)
        notes = request.data.get('notes', 'Rejected by staff')
        listing.status = 'rejected'
        listing.admin_notes = notes
        listing.save()
        log_audit(request.user, 'action_rejected', f"Rejected promotion: {listing.title}", request=request)

        # Send push notification to seller
        try:
            from marketplace.models import push_notification
            product_name = listing.product.name if listing.product else "Product"
            push_notification(
                listing.user,
                'order_status',
                f'Promotion Request Update: {listing.title or product_name}',
                f'Your promotion request for "{product_name}" was rejected. Reason: {notes}',
                '/dashboard/promotions'
            )
        except Exception:
            pass

        return Response({'status': 'rejected', 'id': listing.id})


class StaffAdminDashboardView(APIView):
    """Deep analytics and staffing overview for Superusers."""
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

    def get(self, request):
        now = timezone.now()
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Employee counts
        total_staff = User.objects.filter(is_staff=True).count()
        active_staff = StaffProfile.objects.filter(is_active=True).count()
        deactivated_staff = StaffProfile.objects.filter(is_active=False).count()

        # Department breakdown
        from .models import Department
        dept_breakdown = Department.objects.annotate(count=models.Count('staff_members')).values('name', 'count').order_by('-count')

        # Task performance (Month)
        completed_this_month = Task.objects.filter(status='completed', completed_at__gte=start_of_month).count()
        pending_total = Task.objects.filter(status='pending').count()
        overdue_total = Task.objects.filter(due_date__lt=now).exclude(status__in=['completed', 'cancelled']).count()

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

        # Staff list - Optimized with annotation
        staffers = StaffProfile.objects.select_related('user', 'department').annotate(
            tasks_count=models.Count('user__assigned_tasks')
        ).all()

        staff_list_data = [{
            'id': s.user.id,
            'profile_id': s.id,
            'username': s.user.username,
            'email': s.user.email,
            'department': s.department.name if s.department else None,
            'is_active': s.is_active,
            'tasks_count': s.tasks_count,
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


from marketplace.models import FAQ, SupportTicket
from marketplace.serializers import FAQSerializer, SupportTicketSerializer
from django.utils import timezone as tz

class StaffFAQViewSet(viewsets.ModelViewSet):
    """FIX CRIT-04: staff full CRUD on FAQ entries."""
    permission_classes = [IsStaffMember]
    queryset = FAQ.objects.all().order_by('category', 'order')
    serializer_class = FAQSerializer

class StaffSupportTicketViewSet(viewsets.ModelViewSet):
    """FIX CRIT-04: staff manage all support tickets."""
    permission_classes = [IsStaffMember]
    serializer_class = SupportTicketSerializer

    def get_queryset(self):
        qs = SupportTicket.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @decorators.action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        ticket = self.get_object()
        status_val = request.data.get('status')
        priority_val = request.data.get('priority')
        
        if status_val:
            ticket.status = status_val
            if status_val == 'resolved' and not ticket.resolved_at:
                ticket.resolved_at = tz.now()
        if priority_val:
            ticket.priority = priority_val
            
        ticket.assigned_to = request.user
        ticket.save()
        return Response({'status': 'updated'})

    @decorators.action(detail=True, methods=['post'])
    def reply(self, request, pk=None):
        from marketplace.models import push_notification, TicketMessage
        ticket = self.get_object()
        reply_text = request.data.get('reply', '').strip()
        is_internal = request.data.get('is_internal', False)
        
        if not reply_text:
            return Response({'error': 'Reply cannot be empty.'}, status=400)
            
        TicketMessage.objects.create(
            ticket=ticket,
            sender=request.user,
            sender_name=request.user.first_name or request.user.username,
            body=reply_text,
            is_internal=is_internal
        )
        
        ticket.assigned_to = request.user
        if ticket.status == 'open' and not is_internal:
            ticket.status = 'in_progress'
        ticket.save()
        
        if not is_internal and ticket.user:
            push_notification(ticket.user, 'order_status',
                'Support Reply',
                f'Staff replied to your ticket: "{ticket.subject}"',
                '/help')
                
        return Response({'status': 'replied'})


from marketplace.models import PaymentConfirmation, UserProfile, Product
from billing.models import CommissionPayment
from inspections.models import InspectorProfile
from .serializers import (
    PaymentConfirmationSerializer, StaffCommissionPaymentSerializer, UserManagementSerializer
)
from marketplace.serializers import ProductSerializer

class PaymentConfirmationViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentConfirmationSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = PaymentConfirmation.objects.select_related('user', 'tier').all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @decorators.action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        payment = self.get_object()
        if payment.status != 'pending':
            return Response({'error': 'Payment has already been processed'}, status=status.HTTP_400_BAD_REQUEST)
        payment.status = 'approved'
        payment.save()
        log_audit(request.user, 'subscription_approved', f"Approved subscription payment for user {payment.user.username}", target_user=payment.user, request=request)
        return Response({'status': 'approved'})

    @decorators.action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        payment = self.get_object()
        if payment.status != 'pending':
            return Response({'error': 'Payment has already been processed'}, status=status.HTTP_400_BAD_REQUEST)
        payment.status = 'rejected'
        payment.save()
        log_audit(request.user, 'subscription_rejected', f"Rejected subscription payment for user {payment.user.username}", target_user=payment.user, request=request)
        return Response({'status': 'rejected'})

    @decorators.action(detail=False, methods=['get'])
    def overdue(self, request):
        from marketplace.models import Subscription, SubscriptionTier
        from billing.models import MonthlyInvoice
        from django.contrib.auth import get_user_model
        User = get_user_model()
        now = timezone.now()
        today = now.date()
        q = request.query_params.get('q', '').strip().lower()

        # Exclude users who already have a pending PaymentConfirmation (awaiting review)
        pending_user_ids = set(PaymentConfirmation.objects.filter(status='pending').values_list('user_id', flat=True))

        # Exclude users with currently active, unexpired subscriptions
        active_user_ids = set(Subscription.objects.filter(is_active=True, end_date__gt=now).values_list('user_id', flat=True))

        # Find candidate users who should be paying subscription fees
        candidate_user_ids = set()
        expired_sub_users = Subscription.objects.exclude(tier__isnull=True).values_list('user_id', flat=True)
        candidate_user_ids.update(expired_sub_users)

        tier_users = User.objects.filter(profile__tier__in=['seller_pro', 'business']).values_list('id', flat=True)
        candidate_user_ids.update(tier_users)

        inv_sub_users = MonthlyInvoice.objects.filter(
            subscription_fee__gt=0,
            status__in=[MonthlyInvoice.Status.UNPAID, MonthlyInvoice.Status.OVERDUE]
        ).values_list('seller_id', flat=True)
        candidate_user_ids.update(inv_sub_users)

        overdue_user_ids = candidate_user_ids - active_user_ids - pending_user_ids

        users = (
            User.objects
            .filter(id__in=overdue_user_ids)
            .select_related('profile')
            .prefetch_related('subscriptions__tier', 'products')
        )

        results = []
        for u in users:
            name = f"{u.first_name} {u.last_name}".strip()
            phone = getattr(getattr(u, 'profile', None), 'phone_number', '') or ''
            if q and (q not in u.username.lower() and q not in name.lower() and q not in phone.lower()):
                continue

            latest_sub = u.subscriptions.exclude(tier__isnull=True).order_by('-start_date').first()
            tier = latest_sub.tier if latest_sub else None
            tier_name = tier.name if tier else ('Business' if getattr(getattr(u, 'profile', None), 'tier', '') == 'business' else 'Seller Pro')
            tier_price = float(tier.price) if tier and tier.price else (79000.0 if getattr(getattr(u, 'profile', None), 'tier', '') == 'business' else 29000.0)

            end_date = latest_sub.end_date if latest_sub else None
            if end_date:
                days_overdue = (now - end_date).days if now > end_date else 0
                status_label = 'OVERDUE' if days_overdue > 0 else 'DUE_SOON'
            else:
                days_overdue = (today - u.date_joined.date()).days
                status_label = 'OVERDUE'

            active_products_count = u.products.filter(is_available=True).count()
            orders_count = getattr(u, 'seller_orders', None).count() if hasattr(u, 'seller_orders') else 0

            results.append({
                'user_id': u.id,
                'username': u.username,
                'full_name': name or u.username,
                'store_url': f"/{u.username}",
                'phone_number': phone,
                'whatsapp_number': getattr(getattr(u, 'profile', None), 'whatsapp_number', '') or '',
                'email': u.email or '',
                'location': getattr(getattr(u, 'profile', None), 'location', '') or '',
                'tier_name': tier_name,
                'amount_due': tier_price,
                'end_date': end_date.isoformat() if end_date else None,
                'days_overdue': max(days_overdue, 1),
                'status': status_label,
                'active_products_count': active_products_count,
                'orders_count': orders_count,
            })

        results.sort(key=lambda x: x['days_overdue'], reverse=True)

        page = self.paginate_queryset(results)
        if page is not None:
            return self.get_paginated_response(page)
        return Response({'results': results, 'count': len(results)})

    @decorators.action(detail=False, methods=['get'])
    def analytics(self, request):
        from marketplace.models import Subscription, SubscriptionTier
        from django.db.models import Sum, Count
        from django.contrib.auth import get_user_model
        import datetime
        User = get_user_model()
        now = timezone.now()
        today = now.date()

        approved_qs = PaymentConfirmation.objects.filter(status='approved')
        total_revenue = float(approved_qs.aggregate(t=Sum('amount'))['t'] or 0.0)

        first_day_month = today.replace(day=1)
        this_month_revenue = float(approved_qs.filter(created_at__date__gte=first_day_month).aggregate(t=Sum('amount'))['t'] or 0.0)

        active_subscribers = Subscription.objects.filter(is_active=True, end_date__gt=now).count()

        pending_qs = PaymentConfirmation.objects.filter(status='pending')
        pending_count = pending_qs.count()
        pending_amount = float(pending_qs.aggregate(t=Sum('amount'))['t'] or 0.0)

        pending_user_ids = set(pending_qs.values_list('user_id', flat=True))
        active_user_ids = set(Subscription.objects.filter(is_active=True, end_date__gt=now).values_list('user_id', flat=True))
        all_candidate_ids = set(Subscription.objects.exclude(tier__isnull=True).values_list('user_id', flat=True))
        all_candidate_ids.update(User.objects.filter(profile__tier__in=['seller_pro', 'business']).values_list('id', flat=True))
        overdue_ids = all_candidate_ids - active_user_ids - pending_user_ids
        overdue_count = len(overdue_ids)
        overdue_potential_revenue = overdue_count * 29000.0

        total_sub_base = active_subscribers + overdue_count
        compliance_rate = round((active_subscribers / total_sub_base * 100), 1) if total_sub_base > 0 else 100.0

        monthly_trend = []
        for i in range(5, -1, -1):
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            m_start = datetime.date(year, month, 1)
            if month == 12:
                m_end = datetime.date(year + 1, 1, 1)
            else:
                m_end = datetime.date(year, month + 1, 1)

            month_label = m_start.strftime("%b %Y")
            m_approved = approved_qs.filter(created_at__date__gte=m_start, created_at__date__lt=m_end)
            m_rev = float(m_approved.aggregate(t=Sum('amount'))['t'] or 0.0)
            m_cnt = m_approved.count()

            monthly_trend.append({
                'month': month_label,
                'revenue': m_rev,
                'confirmations': m_cnt,
            })

        tier_breakdown = []
        for t in SubscriptionTier.objects.filter(is_active=True):
            sub_count = Subscription.objects.filter(tier=t, is_active=True, end_date__gt=now).count()
            t_rev = float(approved_qs.filter(tier=t).aggregate(t=Sum('amount'))['t'] or 0.0)
            tier_breakdown.append({
                'tier_name': t.name,
                'tier_level': t.tier_level,
                'subscribers': sub_count,
                'total_revenue': t_rev,
                'price': float(t.price or 0.0),
            })

        status_distribution = [
            {'name': 'Active & Paid', 'count': active_subscribers, 'color': '#10b981'},
            {'name': 'Pending Review', 'count': pending_count, 'color': '#3b82f6'},
            {'name': 'Overdue / Expired', 'count': overdue_count, 'color': '#ef4444'},
            {'name': 'Rejected', 'count': PaymentConfirmation.objects.filter(status='rejected').count(), 'color': '#6b7280'},
        ]

        return Response({
            'kpis': {
                'total_revenue': total_revenue,
                'this_month_revenue': this_month_revenue,
                'active_subscribers': active_subscribers,
                'pending_count': pending_count,
                'pending_amount': pending_amount,
                'overdue_count': overdue_count,
                'overdue_potential_revenue': overdue_potential_revenue,
                'compliance_rate': compliance_rate,
            },
            'monthly_trend': monthly_trend,
            'tier_breakdown': tier_breakdown,
            'status_distribution': status_distribution,
        })


class StaffCommissionPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = StaffCommissionPaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        qs = CommissionPayment.objects.select_related('invoice__seller__profile', 'reviewed_by').all().order_by('-submitted_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            # Note: models define STATUS_CHOICES as uppercase strings like 'PENDING'
            qs = qs.filter(status=status_filter.upper())
        return qs

    @decorators.action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        payment = self.get_object()
        if payment.status != 'PENDING':
            return Response({'error': 'Payment has already been processed'}, status=status.HTTP_400_BAD_REQUEST)
        payment.status = 'APPROVED'
        payment.reviewed_by = request.user
        payment.reviewed_at = timezone.now()
        payment.save()

        # Update MonthlyInvoice status to PAID
        invoice = payment.invoice
        invoice.status = 'PAID'
        invoice.save()

        log_audit(request.user, 'commission_approved', f"Approved commission payment of {payment.amount} from seller {invoice.seller.username}", target_user=invoice.seller, request=request)
        return Response({'status': 'APPROVED'})

    @decorators.action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        return self.approve(request, pk)

    @decorators.action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        payment = self.get_object()
        if payment.status != 'PENDING':
            return Response({'error': 'Payment has already been processed'}, status=status.HTTP_400_BAD_REQUEST)
        
        reason = request.data.get('reason') or request.data.get('rejection_reason') or 'No reason provided'
        payment.status = 'REJECTED'
        payment.rejection_reason = reason
        payment.reviewed_by = request.user
        payment.reviewed_at = timezone.now()
        payment.save()

        # Update MonthlyInvoice status to UNPAID
        invoice = payment.invoice
        invoice.status = 'UNPAID'
        invoice.save()

        log_audit(request.user, 'commission_rejected', f"Rejected commission payment of {payment.amount} from seller {payment.invoice.seller.username}. Reason: {reason}", target_user=payment.invoice.seller, request=request)
        return Response({'status': 'REJECTED', 'rejection_reason': reason})

    @decorators.action(detail=False, methods=['get'])
    def overdue(self, request):
        from billing.models import MonthlyInvoice
        from django.db.models import Q
        today = timezone.now().date()
        q = request.query_params.get('q', '').strip().lower()

        # Find invoices that have pending CommissionPayment submissions (they are under review)
        pending_invoice_ids = set(CommissionPayment.objects.filter(status='PENDING').values_list('invoice_id', flat=True))

        # Query overdue or unpaid invoices with commission/amount due > 0
        invoices = (
            MonthlyInvoice.objects
            .filter(
                Q(status=MonthlyInvoice.Status.OVERDUE) |
                Q(status=MonthlyInvoice.Status.UNPAID, due_date__lt=today) |
                (Q(status=MonthlyInvoice.Status.UNPAID) & (Q(total_commission__gt=0) | Q(total_amount_due__gt=0)))
            )
            .exclude(id__in=pending_invoice_ids)
            .select_related('seller__profile')
            .prefetch_related('seller__products')
            .order_by('-due_date')
        )

        results = []
        for inv in invoices:
            seller = inv.seller
            name = f"{seller.first_name} {seller.last_name}".strip()
            phone = getattr(getattr(seller, 'profile', None), 'phone_number', '') or ''
            period = f"{inv.year}/{inv.month:02d}"

            if q and (q not in seller.username.lower() and q not in name.lower() and q not in phone.lower() and q not in period):
                continue

            days_overdue = (today - inv.due_date).days if inv.due_date and today > inv.due_date else 0
            active_products = seller.products.filter(is_available=True).count()

            results.append({
                'id': inv.id,
                'seller_id': seller.id,
                'seller_username': seller.username,
                'seller_full_name': name or seller.username,
                'store_url': f"/{seller.username}",
                'phone_number': phone,
                'whatsapp_number': getattr(getattr(seller, 'profile', None), 'whatsapp_number', '') or '',
                'email': seller.email or '',
                'location': getattr(getattr(seller, 'profile', None), 'location', '') or '',
                'invoice_year': inv.year,
                'invoice_month': inv.month,
                'invoice_period': period,
                'total_order_amount': float(inv.total_order_amount or 0.0),
                'order_count': inv.order_count,
                'total_commission': float(inv.total_commission or 0.0),
                'subscription_fee': float(inv.subscription_fee or 0.0),
                'total_amount_due': float(inv.total_amount_due or 0.0),
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
                'days_overdue': max(days_overdue, 0),
                'status': inv.status,
                'active_products_count': active_products,
            })

        results.sort(key=lambda x: (x['days_overdue'], x['total_amount_due']), reverse=True)

        page = self.paginate_queryset(results)
        if page is not None:
            return self.get_paginated_response(page)
        return Response({'results': results, 'count': len(results)})

    @decorators.action(detail=False, methods=['get'])
    def analytics(self, request):
        from billing.models import MonthlyInvoice, CommissionPayment
        from django.db.models import Sum, Count, Q
        import datetime
        today = timezone.now().date()

        # Total Commission Collected
        paid_invoices = MonthlyInvoice.objects.filter(status=MonthlyInvoice.Status.PAID)
        total_collected = float(paid_invoices.aggregate(t=Sum('total_commission'))['t'] or 0.0)

        # This month collected
        first_day_month = today.replace(day=1)
        this_month_invoices = paid_invoices.filter(created_at__date__gte=first_day_month)
        this_month_collected = float(this_month_invoices.aggregate(t=Sum('total_commission'))['t'] or 0.0)

        # Outstanding / Overdue
        pending_invoice_ids = set(CommissionPayment.objects.filter(status='PENDING').values_list('invoice_id', flat=True))
        overdue_invoices = MonthlyInvoice.objects.filter(
            Q(status=MonthlyInvoice.Status.OVERDUE) |
            Q(status=MonthlyInvoice.Status.UNPAID, due_date__lt=today) |
            (Q(status=MonthlyInvoice.Status.UNPAID) & Q(total_commission__gt=0))
        ).exclude(id__in=pending_invoice_ids)
        total_outstanding = float(overdue_invoices.aggregate(t=Sum('total_amount_due'))['t'] or 0.0)
        overdue_count = overdue_invoices.count()

        # Pending review
        pending_payments = CommissionPayment.objects.filter(status='PENDING')
        pending_review_count = pending_payments.count()
        pending_review_amount = float(pending_payments.aggregate(t=Sum('amount'))['t'] or 0.0)

        # Total invoiced & collection rate
        all_invoices = MonthlyInvoice.objects.all()
        total_invoiced = float(all_invoices.aggregate(t=Sum('total_commission'))['t'] or 0.0)
        collection_rate = round((total_collected / total_invoiced * 100), 1) if total_invoiced > 0 else 100.0

        # Average commission per seller
        active_sellers_count = MonthlyInvoice.objects.values('seller').distinct().count()
        avg_commission = round(total_collected / active_sellers_count, 2) if active_sellers_count > 0 else 0.0

        # Monthly Trend (last 6 months)
        monthly_trend = []
        for i in range(5, -1, -1):
            year = today.year
            month = today.month - i
            while month <= 0:
                month += 12
                year -= 1
            m_start = datetime.date(year, month, 1)
            month_label = m_start.strftime("%b %Y")

            m_invoices = MonthlyInvoice.objects.filter(year=year, month=month)
            m_invoiced = float(m_invoices.aggregate(t=Sum('total_commission'))['t'] or 0.0)
            m_collected = float(m_invoices.filter(status=MonthlyInvoice.Status.PAID).aggregate(t=Sum('total_commission'))['t'] or 0.0)
            m_orders = int(m_invoices.aggregate(t=Sum('order_count'))['t'] or 0)

            monthly_trend.append({
                'month': month_label,
                'invoiced': m_invoiced,
                'collected': m_collected,
                'orders_count': m_orders,
            })

        # Status distribution
        unpaid_count = MonthlyInvoice.objects.filter(status=MonthlyInvoice.Status.UNPAID).count()
        unpaid_amount = float(MonthlyInvoice.objects.filter(status=MonthlyInvoice.Status.UNPAID).aggregate(t=Sum('total_amount_due'))['t'] or 0.0)
        paid_count = paid_invoices.count()
        paid_amount = float(paid_invoices.aggregate(t=Sum('total_amount_due'))['t'] or 0.0)
        overdue_stat_count = MonthlyInvoice.objects.filter(status=MonthlyInvoice.Status.OVERDUE).count()
        overdue_stat_amount = float(MonthlyInvoice.objects.filter(status=MonthlyInvoice.Status.OVERDUE).aggregate(t=Sum('total_amount_due'))['t'] or 0.0)

        status_distribution = [
            {'name': 'Paid / Settled', 'count': paid_count, 'amount': paid_amount, 'color': '#10b981'},
            {'name': 'Pending Review', 'count': pending_review_count, 'amount': pending_review_amount, 'color': '#3b82f6'},
            {'name': 'Overdue', 'count': overdue_stat_count, 'amount': overdue_stat_amount, 'color': '#ef4444'},
            {'name': 'Unpaid', 'count': unpaid_count, 'amount': unpaid_amount, 'color': '#f59e0b'},
        ]

        # Top Debtors
        top_debtors_qs = overdue_invoices.order_by('-total_amount_due')[:5]
        top_debtors = []
        for inv in top_debtors_qs:
            top_debtors.append({
                'seller_username': inv.seller.username,
                'store_url': f"/{inv.seller.username}",
                'phone_number': getattr(getattr(inv.seller, 'profile', None), 'phone_number', '') or '',
                'amount_due': float(inv.total_amount_due or 0.0),
                'commission': float(inv.total_commission or 0.0),
                'period': f"{inv.year}/{inv.month:02d}",
                'days_overdue': (today - inv.due_date).days if inv.due_date and today > inv.due_date else 0,
            })

        return Response({
            'kpis': {
                'total_collected': total_collected,
                'this_month_collected': this_month_collected,
                'total_outstanding': total_outstanding,
                'overdue_count': overdue_count,
                'pending_review_count': pending_review_count,
                'pending_review_amount': pending_review_amount,
                'collection_rate': collection_rate,
                'avg_commission_per_seller': avg_commission,
                'total_invoiced': total_invoiced,
            },
            'monthly_trend': monthly_trend,
            'status_distribution': status_distribution,
            'top_debtors': top_debtors,
        })


class CanManageUsers(permissions.BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and (user.is_superuser or has_staff_permission(user, 'can_manage_users')))


class UserManagementViewSet(viewsets.ModelViewSet):
    serializer_class = UserManagementSerializer
    permission_classes = [permissions.IsAuthenticated, CanManageUsers]

    def get_queryset(self):
        queryset = User.objects.select_related('profile', 'inspector_profile').all()

        is_staff = self.request.query_params.get('is_staff')
        is_superuser = self.request.query_params.get('is_superuser')
        is_inspector = self.request.query_params.get('is_inspector')
        search = self.request.query_params.get('search') or self.request.query_params.get('q')

        if is_staff in ['true', 'True', '1']:
            queryset = queryset.filter(is_staff=True)
        if is_superuser in ['true', 'True', '1']:
            queryset = queryset.filter(is_superuser=True)
        if is_inspector in ['true', 'True', '1']:
            queryset = queryset.filter(inspector_profile__isnull=False)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(email__icontains=search) | Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )

        return queryset.order_by('-date_joined')

    @decorators.action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        user = self.get_object()
        if user == request.user:
            return Response({'error': 'You cannot ban yourself.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if user.is_superuser and not request.user.is_superuser:
            return Response({'error': 'Cannot toggle active status of superusers'}, status=status.HTTP_403_FORBIDDEN)
        
        user.is_active = not user.is_active
        user.save()
        
        action = 'user_banned' if not user.is_active else 'user_unbanned'
        log_audit(request.user, action, f"Toggled active status of {user.username} to {user.is_active}", target_user=user, request=request)
        return Response({'status': 'success', 'is_active': user.is_active})

    @decorators.action(detail=True, methods=['post'])
    def toggle_verified(self, request, pk=None):
        user = self.get_object()
        profile, created = UserProfile.objects.get_or_create(user=user)
        profile.is_verified = not profile.is_verified
        profile.save()
        
        log_audit(request.user, 'user_verification_toggled', f"Toggled verification of {user.username} to {profile.is_verified}", target_user=user, request=request)
        return Response({'status': 'success', 'is_verified': profile.is_verified})

    @decorators.action(detail=True, methods=['post'])
    def promote_inspector(self, request, pk=None):
        user = self.get_object()
        level = request.data.get('level', 'junior')
        if level not in ['junior', 'senior', 'specialist']:
            return Response({'error': 'Invalid inspector level'}, status=status.HTTP_400_BAD_REQUEST)
        
        inspector_profile, created = InspectorProfile.objects.get_or_create(user=user)
        inspector_profile.level = level
        inspector_profile.save()
        
        log_audit(request.user, 'inspector_promoted', f"Promoted/Updated {user.username} as {level} inspector", target_user=user, request=request)
        return Response({'status': 'success', 'level': level})

    @decorators.action(detail=True, methods=['post'])
    def change_role(self, request, pk=None):
        if not request.user.is_superuser:
            return Response({'error': 'Only superusers can change user roles'}, status=status.HTTP_403_FORBIDDEN)
            
        user = self.get_object()
        is_staff = request.data.get('is_staff')
        is_superuser = request.data.get('is_superuser')
        
        if is_staff is not None:
            user.is_staff = bool(is_staff)
        if is_superuser is not None:
            user.is_superuser = bool(is_superuser)
            
        user.save()

        # If user is marked as staff, ensure they have a StaffProfile
        if user.is_staff:
            StaffProfile.objects.get_or_create(user=user)
            
        log_audit(request.user, 'role_changed', f"Changed roles for {user.username}: is_staff={user.is_staff}, is_superuser={user.is_superuser}", target_user=user, request=request)
        return Response({
            'status': 'success',
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser
        })


class ProductModerationViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related('seller', 'category').all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    @decorators.action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        product = self.get_object()
        product.is_available = False
        product.save()
        log_audit(request.user, 'product_suspended', f"Suspended product listing: {product.name}", target_user=product.seller, request=request)
        return Response({'status': 'suspended', 'is_available': product.is_available})

    @decorators.action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        product = self.get_object()
        product.is_available = True
        product.save()
        log_audit(request.user, 'product_approved', f"Approved product listing: {product.name}", target_user=product.seller, request=request)
        return Response({'status': 'approved', 'is_available': product.is_available})

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        log_audit(request.user, 'product_deleted', f"Deleted product listing: {product.name}", target_user=product.seller, request=request)
        return super().destroy(request, *args, **kwargs)


class StaffSellerApplicationViewSet(viewsets.ModelViewSet):
    from marketplace.models import SellerApplication
    from marketplace.serializers import SellerApplicationSerializer
    serializer_class = SellerApplicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        from marketplace.models import SellerApplication
        queryset = SellerApplication.objects.select_related('user', 'requested_tier').all()
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.lower())
        return queryset

    @decorators.action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        application = self.get_object()
        if application.status != 'pending':
            return Response({'error': 'Application has already been processed'}, status=status.HTTP_400_BAD_REQUEST)
        application.status = 'approved'
        application.reviewed_by = request.user
        application.save()
        log_audit(request.user, 'seller_upgrade_approved', f"Approved seller upgrade application for user {application.user.username} to tier {application.requested_tier.name}", target_user=application.user, request=request)
        return Response({'status': 'approved'})

    @decorators.action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        application = self.get_object()
        if application.status != 'pending':
            return Response({'error': 'Application has already been processed'}, status=status.HTTP_400_BAD_REQUEST)
        rejection_reason = request.data.get('reason', '')
        application.status = 'rejected'
        application.reviewed_by = request.user
        application.rejection_reason = rejection_reason
        application.save()
        log_audit(request.user, 'seller_upgrade_rejected', f"Rejected seller upgrade application for user {application.user.username}. Reason: {rejection_reason}", target_user=application.user, request=request)
        return Response({'status': 'rejected'})


class StaffSellerSiteVisitViewSet(viewsets.ModelViewSet):
    from marketplace.models import SellerSiteVisit
    from marketplace.serializers import SellerSiteVisitSerializer
    serializer_class = SellerSiteVisitSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        from marketplace.models import SellerSiteVisit
        queryset = SellerSiteVisit.objects.select_related('user', 'visited_by', 'reviewed_by').all()
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param.lower())
        search = self.request.query_params.get('search')
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(business_name__icontains=search) |
                Q(user__username__icontains=search) |
                Q(contact_phone__icontains=search) |
                Q(address__icontains=search)
            )
        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        user_id = self.request.data.get('user_id') or self.request.data.get('user')
        username = self.request.data.get('username')
        target_user = None
        if user_id:
            target_user = User.objects.filter(id=user_id).first()
        elif username:
            target_user = User.objects.filter(username__iexact=username).first()

        if not target_user:
            raise serializers.ValidationError({'user': 'A valid customer user must be specified for this site visit.'})

        site_visit = serializer.save(
            user=target_user,
            visited_by=self.request.user,
            status='pending_review'
        )
        log_audit(
            self.request.user,
            'site_visit_submitted',
            f"Staff {self.request.user.username} submitted physical site visit for {target_user.username} ({site_visit.business_name})",
            target_user=target_user,
            request=self.request
        )

    @decorators.action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        if not (request.user.is_superuser or request.user.has_perm('marketplace.can_verify_requests') or request.user.is_staff):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        visit = self.get_object()
        if visit.status != 'pending_review':
            return Response({'error': 'Site visit has already been processed'}, status=status.HTTP_400_BAD_REQUEST)

        visit.status = 'approved'
        visit.reviewed_by = request.user
        visit.reviewed_at = timezone.now()
        visit.save()

        log_audit(
            request.user,
            'site_visit_approved',
            f"Approved physical site verification for user {visit.user.username} ({visit.business_name})",
            target_user=visit.user,
            request=request
        )
        return Response({'status': 'approved'})

    @decorators.action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        if not (request.user.is_superuser or request.user.has_perm('marketplace.can_verify_requests') or request.user.is_staff):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        visit = self.get_object()
        if visit.status != 'pending_review':
            return Response({'error': 'Site visit has already been processed'}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = request.data.get('reason', '')
        visit.status = 'rejected'
        visit.reviewed_by = request.user
        visit.reviewed_at = timezone.now()
        visit.rejection_reason = rejection_reason
        visit.save()

        log_audit(
            request.user,
            'site_visit_rejected',
            f"Rejected physical site verification for user {visit.user.username}. Reason: {rejection_reason}",
            target_user=visit.user,
            request=request
        )
        return Response({'status': 'rejected'})

    @decorators.action(detail=False, methods=['get'], url_path='candidate-users')
    def candidate_users(self, request):
        q = request.query_params.get('q', '').strip()
        users_qs = User.objects.filter(is_active=True)
        if q:
            from django.db.models import Q
            users_qs = users_qs.filter(
                Q(username__icontains=q) |
                Q(email__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(profile__phone_number__icontains=q)
            )
        else:
            users_qs = users_qs.order_by('-date_joined')[:20]

        data = []
        for u in users_qs[:30]:
            phone = getattr(u.profile, 'phone_number', '') if hasattr(u, 'profile') else ''
            tier = getattr(u.profile, 'tier', 'customer') if hasattr(u, 'profile') else 'customer'
            is_loc_ver = getattr(u.profile, 'is_location_verified', False) if hasattr(u, 'profile') else False
            data.append({
                'id': u.id,
                'username': u.username,
                'email': u.email,
                'phone': phone,
                'tier': tier,
                'is_location_verified': is_loc_ver,
            })
        return Response(data)



