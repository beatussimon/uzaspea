from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .api_views import (
    InspectionCategoryViewSet, ChecklistTemplateViewSet,
    InspectorProfileViewSet, InspectionRequestViewSet,
    InspectionPaymentViewSet, InspectionCheckInViewSet,
    InspectionEvidenceViewSet, InspectionReportViewSet,
    ChecklistResponseViewSet, ReInspectionViewSet,
    InspectionNotificationViewSet, FraudFlagViewSet,
    PublicVerifyView, InspectorPerformanceView,
)

router = DefaultRouter()
router.register(r'categories', InspectionCategoryViewSet, basename='inspection-category')
router.register(r'templates', ChecklistTemplateViewSet, basename='checklist-template')
router.register(r'inspectors', InspectorProfileViewSet, basename='inspector-profile')
router.register(r'requests', InspectionRequestViewSet, basename='inspection-request')
router.register(r'payments', InspectionPaymentViewSet, basename='inspection-payment')
router.register(r'checkins', InspectionCheckInViewSet, basename='inspection-checkin')
router.register(r'evidence', InspectionEvidenceViewSet, basename='inspection-evidence')
router.register(r'reports', InspectionReportViewSet, basename='inspection-report')
router.register(r'responses', ChecklistResponseViewSet, basename='checklist-response')
router.register(r'reinspections', ReInspectionViewSet, basename='reinspection')
router.register(r'notifications', InspectionNotificationViewSet, basename='inspection-notification')
router.register(r'fraud-flags', FraudFlagViewSet, basename='fraud-flag')

urlpatterns = [
    path('', include(router.urls)),
    path('verify/<str:inspection_id>/', PublicVerifyView.as_view(), name='public-verify'),
    path('inspector-performance/', InspectorPerformanceView.as_view(), name='inspector-performance'),
]
