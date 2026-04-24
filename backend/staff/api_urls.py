from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import (
    StaffProfileViewSet, TaskCategoryViewSet, TaskViewSet,
    TaskActionViewSet, ApprovalViewSet, AuditLogViewSet,
    StaffPermissionViewSet, StaffDashboardView, SponsoredListingReviewViewSet,
    StaffAdminDashboardView
)

router = DefaultRouter()
router.register(r'profiles', StaffProfileViewSet, basename='staff-profile')
router.register(r'task-categories', TaskCategoryViewSet, basename='task-category')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'task-actions', TaskActionViewSet, basename='task-action')
router.register(r'approvals', ApprovalViewSet, basename='approval')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'permissions', StaffPermissionViewSet, basename='staff-permission')
router.register(r'sponsored-review', SponsoredListingReviewViewSet, basename='sponsored-review')

api_urlpatterns = [
    path('dashboard-summary/', StaffDashboardView.as_view(), name='staff-dashboard-summary'),
    path('admin-dashboard/', StaffAdminDashboardView.as_view(), name='staff-admin-dashboard'),
    path('', include(router.urls)),
]
