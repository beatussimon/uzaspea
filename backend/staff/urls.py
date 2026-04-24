from django.urls import path
from . import views

app_name = 'staff'

urlpatterns = [
    # Admin URLs
    path('admin/', views.admin_dashboard, name='admin_dashboard'),
    path('admin/staff/', views.manage_staff, name='manage_staff'),
    path('admin/staff/<int:profile_id>/edit/', views.edit_staff, name='edit_staff'),
    path('admin/staff/<int:profile_id>/demote/', views.demote_staff, name='demote_staff'),
    path('admin/staff/<int:user_id>/activity/', views.staff_activity, name='staff_activity'),
    
    path('admin/tasks/', views.manage_tasks, name='manage_tasks'),
    path('admin/tasks/create/', views.create_task, name='create_task'),
    path('admin/tasks/<int:task_id>/edit/', views.edit_task, name='edit_task'),
    path('admin/tasks/<int:task_id>/view/', views.view_task, name='view_task'),
    
    path('admin/approvals/', views.pending_approvals, name='pending_approvals'),
    path('admin/approvals/<int:action_id>/review/', views.review_action, name='review_action'),
    
    path('admin/audit/', views.audit_log, name='audit_log'),
    
    path('admin/categories/', views.manage_categories, name='manage_categories'),
    path('admin/categories/<int:category_id>/edit/', views.edit_category, name='edit_category'),
    path('admin/categories/<int:category_id>/delete/', views.delete_category, name='delete_category'),
    
    # API URLs
    path('api/user/<int:user_id>/permissions/', views.get_user_permissions, name='get_user_permissions'),
    path('api/user/<int:user_id>/permissions/update/', views.update_user_permissions, name='update_user_permissions'),
    
    # Staff URLs
    path('dashboard/', views.staff_dashboard, name='staff_dashboard'),
    path('tasks/', views.my_tasks, name='my_tasks'),
    path('tasks/<int:task_id>/', views.task_detail, name='task_detail'),
    path('tasks/<int:task_id>/update-status/', views.update_task_status, name='update_task_status'),
    path('permissions/', views.my_permissions, name='my_permissions'),
]
