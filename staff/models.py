from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class StaffProfile(models.Model):
    """
    Extends the default User model with staff-specific information.
    One-to-One relationship with User.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff_profile')
    is_active = models.BooleanField(default=True, help_text="Designates whether the staff account is active.")
    department = models.CharField(max_length=100, blank=True, help_text="Department or team name")
    phone_number = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True, help_text="Internal notes about this staff member")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Staff Profile"
        verbose_name_plural = "Staff Profiles"

    def __str__(self):
        return f"{self.user.username} (Staff)"


class TaskCategory(models.Model):
    """
    Categories for tasks to organize and filter them.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    requires_approval = models.BooleanField(default=True, help_text="Does this category require admin approval?")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Task Category"
        verbose_name_plural = "Task Categories"

    def __str__(self):
        return self.name


class Task(models.Model):
    """
    Tasks that can be assigned to staff members.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    category = models.ForeignKey(TaskCategory, on_delete=models.SET_NULL, null=True, related_name='tasks')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tasks')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    due_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Task"
        verbose_name_plural = "Tasks"

    def __str__(self):
        return self.title

    def is_overdue(self):
        if self.due_date and self.status not in ['completed', 'cancelled']:
            return timezone.now() > self.due_date
        return False


class TaskAction(models.Model):
    """
    Actions performed by staff on tasks.
    These actions require admin approval before taking effect.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    ACTION_TYPES = [
        ('status_change', 'Status Change'),
        ('content_update', 'Content Update'),
        ('deletion', 'Deletion Request'),
        ('approval', 'Approval Request'),
        ('verification', 'Verification'),
        ('custom', 'Custom Action'),
    ]

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='actions')
    performed_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='task_actions')
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES)
    description = models.TextField(help_text="Description of the action taken")
    previous_value = models.TextField(blank=True, help_text="Previous value before the change")
    new_value = models.TextField(help_text="New value after the change")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, help_text="Admin notes about this action")
    performed_at = models.DateTimeField(auto_now_add=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_actions')
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-performed_at']
        verbose_name = "Task Action"
        verbose_name_plural = "Task Actions"

    def __str__(self):
        return f"{self.action_type} on {self.task.title} by {self.performed_by.username}"


class Approval(models.Model):
    """
    Approval records for task actions.
    Tracks the approval workflow from submission to final decision.
    """
    APPROVAL_TYPES = [
        ('task_completion', 'Task Completion'),
        ('action_execution', 'Action Execution'),
        ('content_publishing', 'Content Publishing'),
        ('user_upgrade', 'User Upgrade Verification'),
        ('custom', 'Custom Approval'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    action = models.OneToOneField(TaskAction, on_delete=models.CASCADE, related_name='approval', null=True, blank=True)
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='approvals', null=True, blank=True)
    approval_type = models.CharField(max_length=50, choices=APPROVAL_TYPES)
    title = models.CharField(max_length=255)
    description = models.TextField()
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='submitted_approvals')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reviewer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_approvals')
    comments = models.TextField(blank=True, help_text="Reviewer's comments")
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_at']
        verbose_name = "Approval"
        verbose_name_plural = "Approvals"

    def __str__(self):
        return f"{self.title} - {self.status}"


class AuditLog(models.Model):
    """
    Comprehensive audit log for tracking all staff actions.
    """
    ACTION_CHOICES = [
        ('task_created', 'Task Created'),
        ('task_assigned', 'Task Assigned'),
        ('task_updated', 'Task Updated'),
        ('task_completed', 'Task Completed'),
        ('task_cancelled', 'Task Cancelled'),
        ('action_performed', 'Action Performed'),
        ('action_approved', 'Action Approved'),
        ('action_rejected', 'Action Rejected'),
        ('staff_promoted', 'Staff Promoted'),
        ('staff_demoted', 'Staff Demoted'),
        ('permission_changed', 'Permission Changed'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('other', 'Other'),
    ]

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='staff_audit_logs')
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    description = models.TextField()
    target_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs_as_target')
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    extra_data = models.JSONField(default=dict, blank=True, help_text="Additional context data")
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        return f"{self.user.username} - {self.action} - {self.timestamp}"


class StaffPermission(models.Model):
    """
    Custom permissions that can be assigned to staff members.
    Extends Django's built-in permission system.
    """
    PERMISSION_TYPES = [
        ('can_confirm_upgrades', 'Confirm User Upgrades'),
        ('can_verify_requests', 'Verify Requests'),
        ('can_approve_content', 'Approve Content'),
        ('can_moderate', 'Moderate Content'),
        ('can_manage_users', 'Manage Users'),
        ('can_view_reports', 'View Reports'),
        ('can_manage_tasks', 'Manage Tasks'),
        ('can_approve_actions', 'Approve Staff Actions'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='staff_permissions')
    permission = models.CharField(max_length=50, choices=PERMISSION_TYPES)
    granted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='granted_permissions')
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Optional expiration date")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ['user', 'permission']
        verbose_name = "Staff Permission"
        verbose_name_plural = "Staff Permissions"

    def __str__(self):
        return f"{self.user.username} - {self.permission}"
