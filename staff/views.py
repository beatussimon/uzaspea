from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.models import User
from django.contrib import messages
from django.http import HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.db.models import Q
from django.views.decorators.http import require_POST

from .models import (
    StaffProfile, Task, TaskAction, Approval, AuditLog, 
    StaffPermission, TaskCategory
)
from .forms import (
    StaffProfileForm, PromoteToStaffForm, TaskForm, TaskActionForm,
    TaskActionReviewForm, StaffPermissionForm, TaskCategoryForm, TaskFilterForm
)


# ============ Decorators and Helpers ============

def is_admin(user):
    """Check if user is a superuser (owner/admin)."""
    return user.is_superuser


def is_staff_member(user):
    """Check if user is an active staff member."""
    return user.is_authenticated and (
        user.is_superuser or 
        getattr(user, 'staff_profile', None) and user.staff_profile.is_active
    )


def has_permission(user, permission_code):
    """Check if user has a specific custom permission."""
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return StaffPermission.objects.filter(
        user=user,
        permission=permission_code,
        is_active=True
    ).exists()


def log_audit(user, action, description, target_user=None, task=None, request=None):
    """Helper function to create audit log entries."""
    ip_address = None
    user_agent = ''
    if request:
        ip_address = get_client_ip(request)
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


def get_client_ip(request):
    """Extract client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# ============ Admin Views ============

@login_required
@user_passes_test(is_admin)
def admin_dashboard(request):
    """Admin dashboard with overview of all staff activities."""
    total_staff = StaffProfile.objects.count()
    active_staff = StaffProfile.objects.filter(is_active=True).count()
    pending_tasks = Task.objects.filter(status='pending').count()
    pending_actions = TaskAction.objects.filter(status='pending').count()
    pending_approvals = Approval.objects.filter(status='pending').count()
    
    recent_tasks = Task.objects.all()[:10]
    recent_actions = TaskAction.objects.filter(status='pending')[:10]
    recent_audit_logs = AuditLog.objects.all()[:20]
    
    context = {
        'total_staff': total_staff,
        'active_staff': active_staff,
        'pending_tasks': pending_tasks,
        'pending_actions': pending_actions,
        'pending_approvals': pending_approvals,
        'recent_tasks': recent_tasks,
        'recent_actions': recent_actions,
        'recent_audit_logs': recent_audit_logs,
    }
    return render(request, 'staff/admin_dashboard.html', context)


@login_required
@user_passes_test(is_admin)
def manage_staff(request):
    """Manage all staff members."""
    staff_members = StaffProfile.objects.select_related('user').all()
    
    if request.method == 'POST':
        form = PromoteToStaffForm(request.POST)
        if form.is_valid():
            user = form.cleaned_data['user']
            department = form.cleaned_data['department']
            
            # Create or get staff profile
            profile, created = StaffProfile.objects.get_or_create(user=user)
            profile.department = department
            profile.save()
            
            # Add staff status to user
            user.is_staff = True
            user.save()
            
            # Assign groups
            groups = form.cleaned_data['permissions']
            user.groups.set(groups)
            
            # Assign custom permissions
            custom_perms = form.cleaned_data['custom_permissions']
            for perm_code in custom_perms:
                StaffPermission.objects.get_or_create(
                    user=user,
                    permission=perm_code,
                    granted_by=request.user
                )
            
            messages.success(request, f"{user.username} has been promoted to staff.")
            log_audit(request.user, 'staff_promoted', f"Promoted {user.username} to staff", target_user=user)
            return redirect('staff:manage_staff')
    else:
        form = PromoteToStaffForm()
    
    context = {
        'staff_members': staff_members,
        'form': form,
    }
    return render(request, 'staff/manage_staff.html', context)


@login_required
@user_passes_test(is_admin)
def edit_staff(request, profile_id):
    """Edit a staff member's profile."""
    profile = get_object_or_404(StaffProfile, id=profile_id)
    
    if request.method == 'POST':
        form = StaffProfileForm(request.POST, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, f"Staff profile for {profile.user.username} updated.")
            return redirect('staff:manage_staff')
    else:
        form = StaffProfileForm(instance=profile)
    
    context = {
        'form': form,
        'profile': profile,
    }
    return render(request, 'staff/edit_staff.html', context)


@login_required
@user_passes_test(is_admin)
def demote_staff(request, profile_id):
    """Demote a staff member to regular user."""
    profile = get_object_or_404(StaffProfile, id=profile_id)
    user = profile.user
    
    if user.is_superuser:
        messages.error(request, "Cannot demote superusers.")
        return redirect('staff:manage_staff')
    
    # Remove staff status
    user.is_staff = False
    user.save()
    
    # Deactivate profile
    profile.is_active = False
    profile.save()
    
    messages.success(request, f"{user.username} has been demoted to regular user.")
    log_audit(request.user, 'staff_demoted', f"Demoted {user.username} from staff", target_user=user)
    return redirect('staff:manage_staff')


@login_required
@user_passes_test(is_admin)
def manage_tasks(request):
    """Manage all tasks (admin view)."""
    filter_form = TaskFilterForm(request.GET)
    tasks = Task.objects.select_related('assigned_to', 'category', 'created_by').all()
    
    if filter_form.is_valid():
        status = filter_form.cleaned_data.get('status')
        priority = filter_form.cleaned_data.get('priority')
        assigned_to = filter_form.cleaned_data.get('assigned_to')
        category = filter_form.cleaned_data.get('category')
        
        if status:
            tasks = tasks.filter(status=status)
        if priority:
            tasks = tasks.filter(priority=priority)
        if assigned_to:
            tasks = tasks.filter(assigned_to=assigned_to)
        if category:
            tasks = tasks.filter(category=category)
    
    context = {
        'tasks': tasks,
        'filter_form': filter_form,
    }
    return render(request, 'staff/manage_tasks.html', context)


@login_required
@user_passes_test(is_admin)
def create_task(request):
    """Create a new task."""
    if request.method == 'POST':
        form = TaskForm(request.POST)
        if form.is_valid():
            task = form.save(commit=False)
            task.created_by = request.user
            task.save()
            messages.success(request, f"Task '{task.title}' created.")
            log_audit(request.user, 'task_created', f"Created task: {task.title}", task=task)
            return redirect('staff:manage_tasks')
    else:
        form = TaskForm()
    
    context = {
        'form': form,
    }
    return render(request, 'staff/create_task.html', context)


@login_required
@user_passes_test(is_admin)
def edit_task(request, task_id):
    """Edit an existing task."""
    task = get_object_or_404(Task, id=task_id)
    
    if request.method == 'POST':
        form = TaskForm(request.POST, instance=task)
        if form.is_valid():
            form.save()
            messages.success(request, f"Task '{task.title}' updated.")
            log_audit(request.user, 'task_updated', f"Updated task: {task.title}", task=task)
            return redirect('staff:manage_tasks')
    else:
        form = TaskForm(instance=task)
    
    context = {
        'form': form,
        'task': task,
    }
    return render(request, 'staff/edit_task.html', context)


@login_required
@user_passes_test(is_admin)
def view_task(request, task_id):
    """View task details."""
    task = get_object_or_404(Task.objects.select_related('assigned_to', 'category', 'created_by'), id=task_id)
    actions = task.actions.all()
    
    context = {
        'task': task,
        'actions': actions,
    }
    return render(request, 'staff/view_task.html', context)


@login_required
@user_passes_test(is_admin)
def pending_approvals(request):
    """View and manage pending approvals."""
    pending_actions = TaskAction.objects.filter(status='pending').select_related(
        'task', 'performed_by'
    ).order_by('-performed_at')
    
    pending_approvals = Approval.objects.filter(status='pending').select_related(
        'submitted_by', 'task'
    ).order_by('-submitted_at')
    
    context = {
        'pending_actions': pending_actions,
        'pending_approvals': pending_approvals,
    }
    return render(request, 'staff/pending_approvals.html', context)


@login_required
@user_passes_test(is_admin)
def review_action(request, action_id):
    """Review and approve/reject a task action."""
    action = get_object_or_404(TaskAction, id=action_id)
    
    if action.status != 'pending':
        messages.warning(request, "This action has already been reviewed.")
        return redirect('staff:pending_approvals')
    
    if request.method == 'POST':
        form = TaskActionReviewForm(request.POST, instance=action)
        if form.is_valid():
            decision = form.cleaned_data['decision']
            notes = form.cleaned_data['notes']
            
            action.notes = notes
            action.reviewed_by = request.user
            action.reviewed_at = timezone.now()
            
            if decision == 'approved':
                action.status = 'approved'
                messages.success(request, "Action approved.")
                log_audit(
                    request.user, 'action_approved', 
                    f"Approved action: {action.action_type} on {action.task.title}",
                    task=action.task
                )
            else:
                action.status = 'rejected'
                messages.warning(request, "Action rejected.")
                log_audit(
                    request.user, 'action_rejected', 
                    f"Rejected action: {action.action_type} on {action.task.title}",
                    task=action.task
                )
            
            action.save()
            return redirect('staff:pending_approvals')
    else:
        form = TaskActionReviewForm(instance=action)
    
    context = {
        'form': form,
        'action': action,
    }
    return render(request, 'staff/review_action.html', context)


@login_required
@user_passes_test(is_admin)
def audit_log(request):
    """View the audit log."""
    logs = AuditLog.objects.select_related('user', 'target_user', 'task').all()
    
    # Filter by action type
    action_filter = request.GET.get('action')
    if action_filter:
        logs = logs.filter(action=action_filter)
    
    # Filter by user
    user_filter = request.GET.get('user')
    if user_filter:
        logs = logs.filter(user__id=user_filter)
    
    logs = logs[:100]  # Limit to 100 recent entries
    
    context = {
        'logs': logs,
        'action_choices': AuditLog.ACTION_CHOICES,
    }
    return render(request, 'staff/audit_log.html', context)


@login_required
@user_passes_test(is_admin)
def staff_activity(request, user_id):
    """View activity log for a specific staff member."""
    staff_user = get_object_or_404(User, id=user_id)
    logs = AuditLog.objects.filter(user=staff_user).select_related('task').order_by('-timestamp')[:50]
    
    context = {
        'staff_user': staff_user,
        'logs': logs,
    }
    return render(request, 'staff/staff_activity.html', context)


@login_required
@user_passes_test(is_admin)
def manage_categories(request):
    """Manage task categories."""
    categories = TaskCategory.objects.all()
    
    if request.method == 'POST':
        form = TaskCategoryForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Category created.")
            return redirect('staff:manage_categories')
    else:
        form = TaskCategoryForm()
    
    context = {
        'categories': categories,
        'form': form,
    }
    return render(request, 'staff/manage_categories.html', context)


@login_required
@user_passes_test(is_admin)
def edit_category(request, category_id):
    """Edit a task category."""
    category = get_object_or_404(TaskCategory, id=category_id)
    
    if request.method == 'POST':
        form = TaskCategoryForm(request.POST, instance=category)
        if form.is_valid():
            form.save()
            messages.success(request, "Category updated.")
            return redirect('staff:manage_categories')
    else:
        form = TaskCategoryForm(instance=category)
    
    context = {
        'form': form,
        'category': category,
    }
    return render(request, 'staff/edit_category.html', context)


@login_required
@user_passes_test(is_admin)
def delete_category(request, category_id):
    """Delete a task category."""
    category = get_object_or_404(TaskCategory, id=category_id)
    category.delete()
    messages.success(request, "Category deleted.")
    return redirect('staff:manage_categories')


# ============ Staff Views ============

@login_required
@user_passes_test(is_staff_member)
def staff_dashboard(request):
    """Staff dashboard with their tasks and pending actions."""
    user = request.user
    
    # Tasks assigned to this staff member
    my_tasks = Task.objects.filter(assigned_to=user).select_related('category', 'created_by')
    
    # Pending actions that need approval (submitted by this staff)
    my_pending_actions = TaskAction.objects.filter(
        performed_by=user, 
        status='pending'
    ).select_related('task')
    
    # My completed actions awaiting admin review
    my_reviewed_actions = TaskAction.objects.filter(
        performed_by=user
    ).exclude(status='pending').order_by('-performed_at')[:10]
    
    # All pending actions (for awareness)
    all_pending_actions = TaskAction.objects.filter(status='pending').exclude(
        performed_by=user
    ).select_related('task', 'performed_by')[:10]
    
    # Tasks that need attention (overdue or high priority)
    urgent_tasks = my_tasks.filter(
        Q(status='pending') | Q(status='in_progress')
    ).filter(
        Q(priority='urgent') | Q(priority='high') | Q(due_date__lt=timezone.now())
    )[:5]
    
    context = {
        'my_tasks': my_tasks,
        'my_pending_actions': my_pending_actions,
        'my_reviewed_actions': my_reviewed_actions,
        'all_pending_actions': all_pending_actions,
        'urgent_tasks': urgent_tasks,
    }
    return render(request, 'staff/staff_dashboard.html', context)


@login_required
@user_passes_test(is_staff_member)
def my_tasks(request):
    """View all tasks assigned to the current staff member."""
    tasks = Task.objects.filter(assigned_to=request.user).select_related(
        'category', 'created_by'
    ).order_by('-created_at')
    
    # Filter by status
    status_filter = request.GET.get('status')
    if status_filter:
        tasks = tasks.filter(status=status_filter)
    
    context = {
        'tasks': tasks,
    }
    return render(request, 'staff/my_tasks.html', context)


@login_required
@user_passes_test(is_staff_member)
def task_detail(request, task_id):
    """View task details and submit actions."""
    task = get_object_or_404(Task, id=task_id)
    
    # Check if user can access this task
    if task.assigned_to != request.user and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have access to this task.")
    
    if request.method == 'POST':
        form = TaskActionForm(request.POST)
        if form.is_valid():
            action = form.save(commit=False)
            action.task = task
            action.performed_by = request.user
            action.save()
            
            # Create approval record
            Approval.objects.create(
                action=action,
                approval_type='action_execution',
                title=f"Action: {action.get_action_type_display()}",
                description=action.description,
                submitted_by=request.user
            )
            
            messages.success(request, "Action submitted for admin approval.")
            log_audit(
                request.user, 'action_performed', 
                f"Performed {action.action_type} on task: {task.title}",
                task=task
            )
            return redirect('staff:task_detail', task_id=task.id)
    else:
        form = TaskActionForm()
    
    actions = task.actions.all().order_by('-performed_at')
    
    context = {
        'task': task,
        'form': form,
        'actions': actions,
    }
    return render(request, 'staff/task_detail.html', context)


@login_required
@user_passes_test(is_staff_member)
def update_task_status(request, task_id):
    """Update task status (creates a pending action)."""
    task = get_object_or_404(Task, id=task_id)
    
    if task.assigned_to != request.user and not request.user.is_superuser:
        return HttpResponseForbidden("You don't have access to this task.")
    
    if request.method == 'POST':
        new_status = request.POST.get('status')
        notes = request.POST.get('notes', '')
        
        if new_status and new_status in dict(Task.STATUS_CHOICES):
            # Create pending action for status change
            TaskAction.objects.create(
                task=task,
                performed_by=request.user,
                action_type='status_change',
                description=f"Status change request: {task.status} → {new_status}",
                previous_value=task.status,
                new_value=new_status,
                notes=notes
            )
            
            messages.info(request, "Status change submitted for admin approval.")
            log_audit(
                request.user, 'action_performed', 
                f"Requested status change for: {task.title} ({task.status} → {new_status})",
                task=task
            )
    
    return redirect('staff:task_detail', task_id=task.id)


@login_required
@user_passes_test(is_staff_member)
def my_permissions(request):
    """View current permissions."""
    try:
        profile = request.user.staff_profile
    except StaffProfile.DoesNotExist:
        profile = None
    
    permissions = StaffPermission.objects.filter(
        user=request.user,
        is_active=True
    )
    
    # Get group permissions
    group_permissions = request.user.get_group_permissions()
    
    context = {
        'profile': profile,
        'custom_permissions': permissions,
        'group_permissions': group_permissions,
    }
    return render(request, 'staff/my_permissions.html', context)


# ============ API Views ============

@login_required
@user_passes_test(is_admin)
def get_user_permissions(request, user_id):
    """API endpoint to get user permissions."""
    user = get_object_or_404(User, id=user_id)
    
    custom_perms = list(StaffPermission.objects.filter(
        user=user,
        is_active=True
    ).values_list('permission', flat=True))
    
    group_perms = list(user.get_group_permissions())
    
    return JsonResponse({
        'custom_permissions': custom_perms,
        'group_permissions': group_perms,
    })


@login_required
@user_passes_test(is_admin)
@require_POST
def update_user_permissions(request, user_id):
    """API endpoint to update user permissions."""
    user = get_object_or_404(User, id=user_id)
    data = request.POST
    
    # Update custom permissions
    StaffPermission.objects.filter(user=user).update(is_active=False)
    
    for perm_code in data.getlist('permissions', []):
        StaffPermission.objects.update_or_create(
            user=user,
            permission=perm_code,
            defaults={
                'granted_by': request.user,
                'is_active': True
            }
        )
    
    messages.success(request, f"Permissions updated for {user.username}.")
    log_audit(
        request.user, 'permission_changed', 
        f"Updated permissions for {user.username}",
        target_user=user
    )
    
    return JsonResponse({'status': 'success'})
