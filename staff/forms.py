from django import forms
from django.contrib.auth.models import User, Group
from .models import (
    StaffProfile, Task, TaskAction, Approval, AuditLog, 
    StaffPermission, TaskCategory
)


class StaffProfileForm(forms.ModelForm):
    """
    Form for creating and updating staff profiles.
    """
    class Meta:
        model = StaffProfile
        fields = ['is_active', 'department', 'phone_number', 'notes']
        widgets = {
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'department': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Department'}),
            'phone_number': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Phone Number'}),
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Internal notes'}),
        }


class PromoteToStaffForm(forms.Form):
    """
    Form for promoting a regular user to staff status.
    """
    user = forms.ModelChoiceField(
        queryset=User.objects.filter(is_staff=False, is_superuser=False),
        widget=forms.Select(attrs={'class': 'form-select'}),
        help_text="Select a user to promote to staff"
    )
    department = forms.CharField(max_length=100, required=False, widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Department (optional)'}))
    permissions = forms.ModelMultipleChoiceField(
        queryset=Group.objects.all(),
        required=False,
        widget=forms.SelectMultiple(attrs={'class': 'form-select'}),
        help_text="Assign groups for additional permissions"
    )
    custom_permissions = forms.MultipleChoiceField(
        choices=StaffPermission.PERMISSION_TYPES,
        required=False,
        widget=forms.CheckboxSelectMultiple(attrs={'class': 'form-check-inline'}),
        help_text="Assign custom permissions"
    )


class TaskForm(forms.ModelForm):
    """
    Form for creating and updating tasks.
    """
    assigned_to = forms.ModelChoiceField(
        queryset=User.objects.filter(staff_profile__is_active=True),
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        help_text="Assign to a staff member (leave empty for unassigned)"
    )
    
    class Meta:
        model = Task
        fields = ['title', 'description', 'category', 'assigned_to', 'priority', 'due_date']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Task Title'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 4, 'placeholder': 'Task Description'}),
            'category': forms.Select(attrs={'class': 'form-select'}),
            'priority': forms.Select(attrs={'class': 'form-select'}),
            'due_date': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
        }


class TaskActionForm(forms.ModelForm):
    """
    Form for submitting task actions that require approval.
    """
    class Meta:
        model = TaskAction
        fields = ['action_type', 'description', 'previous_value', 'new_value']
        widgets = {
            'action_type': forms.Select(attrs={'class': 'form-select'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Describe the action taken'}),
            'previous_value': forms.Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'Previous value'}),
            'new_value': forms.Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'New value'}),
        }


class ApprovalReviewForm(forms.ModelForm):
    """
    Form for admins to review and approve/reject actions.
    """
    STATUS_CHOICES = [
        ('approved', 'Approve'),
        ('rejected', 'Reject'),
    ]
    
    status = forms.ChoiceField(
        choices=STATUS_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'})
    )
    
    class Meta:
        model = Approval
        fields = ['status', 'comments']
        widgets = {
            'comments': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Review comments (required for rejection)'}),
        }


class TaskActionReviewForm(forms.ModelForm):
    """
    Form for reviewing task actions directly.
    """
    STATUS_CHOICES = [
        ('approved', 'Approve'),
        ('rejected', 'Reject'),
    ]
    
    decision = forms.ChoiceField(
        choices=STATUS_CHOICES,
        widget=forms.RadioSelect(attrs={'class': 'form-check-input'}),
        label="Decision"
    )
    
    class Meta:
        model = TaskAction
        fields = ['notes']
        widgets = {
            'notes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3, 'placeholder': 'Review notes'}),
        }


class StaffPermissionForm(forms.ModelForm):
    """
    Form for managing custom staff permissions.
    """
    class Meta:
        model = StaffPermission
        fields = ['permission', 'expires_at', 'is_active']
        widgets = {
            'permission': forms.Select(attrs={'class': 'form-select'}),
            'expires_at': forms.DateTimeInput(attrs={'class': 'form-control', 'type': 'datetime-local'}),
            'is_active': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class TaskCategoryForm(forms.ModelForm):
    """
    Form for creating and updating task categories.
    """
    class Meta:
        model = TaskCategory
        fields = ['name', 'description', 'requires_approval']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Category Name'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'Description'}),
            'requires_approval': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class TaskFilterForm(forms.Form):
    """
    Form for filtering tasks in the dashboard.
    """
    STATUS_CHOICES = [('', 'All Statuses')] + Task.STATUS_CHOICES
    PRIORITY_CHOICES = [('', 'All Priorities')] + Task.PRIORITY_CHOICES
    
    status = forms.ChoiceField(choices=STATUS_CHOICES, required=False, widget=forms.Select(attrs={'class': 'form-select'}))
    priority = forms.ChoiceField(choices=PRIORITY_CHOICES, required=False, widget=forms.Select(attrs={'class': 'form-select'}))
    assigned_to = forms.ModelChoiceField(
        queryset=User.objects.filter(staff_profile__is_active=True),
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label="Assigned Staff"
    )
    category = forms.ModelChoiceField(
        queryset=TaskCategory.objects.all(),
        required=False,
        widget=forms.Select(attrs={'class': 'form-select'}),
        label="Category"
    )
