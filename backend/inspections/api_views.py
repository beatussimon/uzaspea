from rest_framework import viewsets, permissions, status, decorators
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Q, Avg
from django.shortcuts import get_object_or_404

from .models import (
    InspectionCategory, ChecklistTemplate, ChecklistItem,
    InspectorProfile, InspectionRequest, InspectionBill,
    InspectionPayment, InspectionAssignment, InspectionCheckIn,
    InspectionEvidence, InspectionReport, ChecklistResponse,
    ReInspection, InspectionNotification, FraudFlag, SLABreach,
)
from staff.models import StaffPermission
from .serializers import (
    InspectionCategorySerializer, ChecklistTemplateSerializer,
    InspectorProfileSerializer, InspectionRequestSerializer,
    InspectionRequestListSerializer, InspectionBillSerializer,
    InspectionPaymentSerializer, InspectionAssignmentSerializer,
    InspectionCheckInSerializer, InspectionEvidenceSerializer,
    InspectionReportSerializer, ChecklistResponseSerializer,
    ReInspectionSerializer, InspectionNotificationSerializer,
    FraudFlagSerializer, SLABreachSerializer,
)
from .pricing import calculate_bill


from uzachuo.permissions import IsSuperUser, IsStaffMember, has_staff_permission, IsAssignedInspectorOrStaff


def notify(user, notification_type, message, request_obj=None):
    """Helper to create a notification."""
    InspectionNotification.objects.create(
        user=user,
        notification_type=notification_type,
        message=message,
        related_request=request_obj,
    )


def auto_fraud_check(inspection_request):
    """Run anomaly detection on report submission."""
    flags = []

    # Speed anomaly: report submitted suspiciously fast
    if hasattr(inspection_request, 'checkin'):
        checkin = inspection_request.checkin
        if checkin.checkout_at and checkin.checkin_at:
            duration = (checkin.checkout_at - checkin.checkin_at).total_seconds() / 60
            if duration < 5:
                flags.append(FraudFlag(
                    request=inspection_request,
                    flag_type='speed_anomaly',
                    details=f'Inspection completed in {duration:.1f} minutes',
                ))

    # No check-in
    if not hasattr(inspection_request, 'checkin'):
        flags.append(FraudFlag(
            request=inspection_request,
            flag_type='no_checkin',
            details='Inspector never submitted a check-in photo',
        ))

    # No evidence at all
    if not inspection_request.evidence.exists():
        flags.append(FraudFlag(
            request=inspection_request,
            flag_type='no_media',
            details='No evidence photos submitted',
        ))

    FraudFlag.objects.bulk_create(flags)
    return len(flags) > 0


# ──────────────────────────────────────────────
# CATEGORY
# ──────────────────────────────────────────────

class InspectionCategoryViewSet(viewsets.ModelViewSet):
    queryset = InspectionCategory.objects.filter(is_active=True, parent=None)
    serializer_class = InspectionCategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        if self.request.query_params.get('all'):
            return InspectionCategory.objects.filter(is_active=True)
        return super().get_queryset()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsSuperUser()]
        return [permissions.IsAuthenticated()]


# ──────────────────────────────────────────────
# CHECKLIST TEMPLATE
# ──────────────────────────────────────────────

class ChecklistTemplateViewSet(viewsets.ModelViewSet):
    queryset = ChecklistTemplate.objects.filter(is_active=True).prefetch_related('items')
    serializer_class = ChecklistTemplateSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'for_category']:
            return [permissions.IsAuthenticated()]
        return [IsSuperUser()]

    @decorators.action(detail=False, methods=['get'], url_path='for-category/(?P<category_id>[^/.]+)')
    def for_category(self, request, category_id=None):
        try:
            category = InspectionCategory.objects.get(id=category_id)
        except InspectionCategory.DoesNotExist:
            return Response({'detail': 'Category not found.'}, status=404)

        # Search up the tree for a template
        current = category
        while current:
            template = ChecklistTemplate.objects.filter(
                category=current, is_active=True
            ).order_by('-version').first()
            if template:
                return Response(ChecklistTemplateSerializer(template).data)
            current = current.parent

        return Response({'detail': 'No template found for this category or its ancestors.'}, status=404)


# ──────────────────────────────────────────────
# INSPECTOR PROFILE
# ──────────────────────────────────────────────

class InspectorProfileViewSet(viewsets.ModelViewSet):
    queryset = InspectorProfile.objects.select_related('user').prefetch_related('certified_categories')
    serializer_class = InspectorProfileSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'me', 'available', 'performance']:
            return [permissions.IsAuthenticated()]
        return [IsSuperUser()]

    @decorators.action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        category_id = request.query_params.get('category_id')
        qs = InspectorProfile.objects.filter(is_available=True)
        if category_id:
            from .models import InspectionCategory
            category = get_object_or_404(InspectionCategory, id=category_id)
            # Match inspectors certified for this category OR any parent/ancestor
            target_ids = [a.id for a in category.get_ancestors()] + [category.id]
            qs = qs.filter(certified_categories__id__in=target_ids).distinct()
            
        qs = qs.order_by('-performance_score')
        return Response(InspectorProfileSerializer(qs, many=True).data)

    @decorators.action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        profile = get_object_or_404(InspectorProfile, user=request.user)
        return Response(InspectorProfileSerializer(profile).data)


# ──────────────────────────────────────────────
# INSPECTION REQUEST
# ──────────────────────────────────────────────

class InspectionRequestViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return InspectionRequestListSerializer
        return InspectionRequestSerializer

    def get_queryset(self):
        user = self.request.user
        qs = InspectionRequest.objects.select_related(
            'client', 'category', 'bill', 'report'
        ).prefetch_related('assignments', 'payments', 'notifications')

        # Staff see all in admin/list views ONLY if explicitly requested or on detail actions
        # Staff isolation logic
        is_superuser = user.is_superuser
        can_manage = has_staff_permission(user, 'can_manage_inspections')
        explicit_all = self.request.query_params.get('all') == 'true'

        if is_superuser or (can_manage and explicit_all) or (can_manage and self.action != 'list'):
            return qs.all()
        
        # Default: Personal view (Client or Assigned Inspector)
        filter_q = Q(client=user)
        if hasattr(user, 'inspector_profile'):
            filter_q |= Q(assignments__inspector__user=user, assignments__is_active=True)
        
        return qs.filter(filter_q).distinct()

    def perform_create(self, serializer):
        serializer.save(client=self.request.user)

    @decorators.action(detail=True, methods=['post'], url_path='generate-bill')
    def generate_bill(self, request, pk=None):
        """Staff action: generate the inspection bill."""
        obj = self.get_object()
        
        # PERMISSION CHECK
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'No permission to generate inspection bills.'}, status=403)

        if obj.status != 'requested' and not request.user.is_superuser:
            return Response({'detail': f'Cannot generate bill for request in {obj.status} status.'}, status=400)
        
        if hasattr(obj, 'bill'):
            return Response({'detail': 'Bill already generated.'}, status=400)

        travel_surcharge = request.data.get('travel_surcharge', 0)
        data = calculate_bill(
            category=obj.category,
            scope=obj.scope,
            turnaround=obj.turnaround,
            is_complex=obj.is_complex,
            item_age_years=obj.item_age_years,
            add_reinspection_coverage=obj.reinspection_coverage,
        )
        from decimal import Decimal
        travel = Decimal(str(travel_surcharge))
        total = data['total_amount'] + travel
        deposit = data['deposit_amount']
        remaining = total - deposit

        bill = InspectionBill.objects.create(
            request=obj,
            base_rate=data['base_rate'],
            scope_multiplier=data['scope_multiplier'],
            turnaround_surcharge=data['turnaround_surcharge'],
            complexity_surcharge=data['complexity_surcharge'],
            travel_surcharge=travel,
            inspector_level_surcharge=data['inspector_level_surcharge'],
            reinspection_coverage_fee=data['reinspection_coverage_fee'],
            total_amount=total,
            deposit_amount=deposit,
            remaining_balance=remaining,
            currency=data['currency'],
        )
        obj.status = 'bill_sent'
        obj.save()
        notify(obj.client, 'bill_ready',
               f'Your inspection bill for {obj.item_name} is ready. Total: {bill.total_amount} {bill.currency}.',
               obj)
        return Response(InspectionBillSerializer(bill).data)

    @decorators.action(detail=True, methods=['post'], url_path='acknowledge-bill')
    def acknowledge_bill(self, request, pk=None):
        """Client action: acknowledge and accept the bill."""
        obj = self.get_object()
        
        # PERMISSION CHECK: Must be the client
        if obj.client != request.user and not request.user.is_superuser:
            return Response({'detail': 'Only the client can acknowledge the bill.'}, status=403)

        if obj.status != 'bill_sent' and not request.user.is_superuser:
            return Response({'detail': f'Cannot acknowledge bill for request in {obj.status} status.'}, status=400)
        
        obj.status = 'awaiting_payment'
        obj.save()
        
        notify(request.user, 'status_update',
               f'You have accepted the bill for {obj.inspection_id}. Please proceed to payment.', obj)
        return Response({'status': obj.status})

    @decorators.action(detail=True, methods=['post'], url_path='assign')
    def assign(self, request, pk=None):
        """Dispatcher action: assign an inspector."""
        obj = self.get_object()
        
        # PERMISSION CHECK
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'No permission to assign inspectors.'}, status=403)

        if obj.status not in ['deposit_paid', 'pre_inspection'] and not request.user.is_superuser:
            return Response({'detail': f'Payment must be confirmed before assignment (Current: {obj.status}).'}, status=400)
        
        inspector_id = request.data.get('inspector_id')
        override_reason = request.data.get('override_reason', '')
        inspector = get_object_or_404(InspectorProfile, id=inspector_id)

        # Deactivate previous active assignments
        obj.assignments.filter(is_active=True).update(is_active=False)

        # Compute SLA deadline
        from datetime import timedelta
        sla_hours = {'standard': 48, 'express': 12, 'instant': 4}
        deadline = timezone.now() + timedelta(hours=sla_hours.get(obj.turnaround, 48))

        assignment = InspectionAssignment.objects.create(
            request=obj,
            inspector=inspector,
            assigned_by=request.user,
            is_manual_override=bool(override_reason),
            override_reason=override_reason,
            sla_deadline=deadline,
            is_active=True
        )
        obj.status = 'assigned'
        obj.save()
        notify(inspector.user, 'assigned',
               f'You have been assigned inspection {obj.inspection_id} for {obj.item_name}.', obj)
        notify(obj.client, 'assigned',
               f'An inspector has been assigned to your inspection {obj.inspection_id}.', obj)
        return Response(InspectionAssignmentSerializer(assignment).data)

    @decorators.action(detail=True, methods=['post'], url_path='update-status')
    def update_status(self, request, pk=None):
        obj = self.get_object()
        
        # PERMISSION CHECK
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'No permission to update inspection status.'}, status=403)
            
        new_status = request.data.get('status')
        valid = [s[0] for s in InspectionRequest.STATUS_CHOICES]
        if new_status not in valid:
            return Response({'detail': 'Invalid status.'}, status=400)
        obj.status = new_status
        obj.save()
        return Response({'status': obj.status})

    @decorators.action(detail=True, methods=['get'], url_path='verify')
    def verify(self, request, pk=None):
        """Public-facing: minimal verification data."""
        obj = self.get_object()
        data = {
            'inspection_id': obj.inspection_id,
            'category': obj.category.get_full_path(),
            'item_name': obj.item_name,
            'status': obj.status,
            'verdict': None,
            'report_hash': None,
            'inspected_at': None,
        }
        if hasattr(obj, 'report') and obj.report.is_locked:
            data['verdict'] = obj.report.verdict
            data['report_hash'] = obj.report.report_hash
            data['inspected_at'] = obj.report.approved_at
        return Response(data)

    @decorators.action(detail=False, methods=['get'], url_path='my-jobs')
    def my_jobs(self, request):
        """Inspector's job queue."""
        profile = get_object_or_404(InspectorProfile, user=request.user)
        qs = InspectionRequest.objects.filter(
            assignments__inspector=profile,
            assignments__is_active=True
        ).select_related('category', 'client', 'bill').order_by('-created_at')
        return Response(InspectionRequestListSerializer(qs, many=True, context={'request': request}).data)

    @decorators.action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """Staff dashboard statistics."""
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'Requires inspection management permissions.'}, status=403)
        qs = InspectionRequest.objects.all()
        by_status = {}
        for s, _ in InspectionRequest.STATUS_CHOICES:
            by_status[s] = qs.filter(status=s).count()
        return Response({
            'total': qs.count(),
            'by_status': by_status,
            'pending_qa': qs.filter(status='qa_review').count(),
            'fraud_flags': FraudFlag.objects.filter(resolved=False).count(),
            'sla_breaches': SLABreach.objects.count(),
        })


# ──────────────────────────────────────────────
# PAYMENT
# ──────────────────────────────────────────────

class InspectionPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionPaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or has_staff_permission(user, 'can_manage_inspections'):
            return InspectionPayment.objects.all().order_by('-created_at')
        return InspectionPayment.objects.filter(request__client=user).order_by('-created_at')

    def perform_create(self, serializer):
        request_obj = serializer.validated_data['request']
        user = self.request.user
        
        # Explicit Permission Check (403 fix)
        if request_obj.client != user and not user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("You do not have permission to submit payment for this request.")
            
        serializer.save()

    @decorators.action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        payment = self.get_object()
        
        # PERMISSION CHECK
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'No permission to approve payments.'}, status=403)

        if payment.request.status != 'bill_sent' and not request.user.is_superuser:
             return Response({'detail': 'Request must be in bill_sent status to approve payment.'}, status=400)
             
        payment.status = 'approved'
        payment.confirmed_by = request.user
        payment.confirmed_at = timezone.now()
        payment.save()

        # Update request status
        req = payment.request
        if payment.stage == 'deposit':
            req.status = 'pre_inspection'
        elif payment.stage == 'balance':
            req.status = 'assigned'
        req.save()

        notify(req.client, 'payment_confirmed',
               f'Your {payment.stage} payment for {req.inspection_id} has been confirmed.', req)
        return Response({'status': 'approved'})

    @decorators.action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        payment = self.get_object()
        
        # PERMISSION CHECK
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'No permission to reject payments.'}, status=403)

        reason = request.data.get('reason', 'Payment rejected.')
        payment.status = 'rejected'
        payment.rejection_reason = reason
        payment.confirmed_by = request.user
        payment.confirmed_at = timezone.now()
        payment.save()
        notify(payment.request.client, 'payment_rejected',
               f'Your payment for {payment.request.inspection_id} was rejected: {reason}',
               payment.request)
        return Response({'status': 'rejected'})

    @decorators.action(detail=False, methods=['get'], url_path='pending')
    def pending(self, request):
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response(status=403)
        qs = InspectionPayment.objects.filter(status='pending').order_by('-created_at')
        return Response(InspectionPaymentSerializer(qs, many=True).data)


# ──────────────────────────────────────────────
# CHECK-IN
# ──────────────────────────────────────────────

class InspectionCheckInViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionCheckInSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or has_staff_permission(user, 'can_manage_inspections'):
            return InspectionCheckIn.objects.all()
        return InspectionCheckIn.objects.filter(
            Q(request__client=user) |
            Q(request__assignment__inspector__user=user)
        )

    def create(self, request, *args, **kwargs):
        request_id = request.data.get('request')
        if not request_id:
            return Response({'detail': 'request field is required.'}, status=400)

        request_obj = get_object_or_404(InspectionRequest, id=request_id)
        
        # PERMISSION CHECK: Must be superuser or the assigned inspector
        is_assigned = request_obj.assignments.filter(inspector__user=request.user, is_active=True).exists()
        if not (request.user.is_superuser or is_assigned):
            return Response({'detail': 'Only the assigned inspector can check in.'}, status=403)

        if request_obj.status != 'assigned' and not request.user.is_superuser:
            return Response({'detail': 'Cannot check in. Inspection must be in Assigned status.'}, status=400)

        instance = InspectionCheckIn.objects.filter(request_id=request_id).first()

        if instance:
            # Already checked in — just return the existing record
            return Response(InspectionCheckInSerializer(instance).data)

        # First time — create and advance status
        res = super().create(request, *args, **kwargs)
        
        # ATOMIC TRANSITION: Update status and create report shell
        request_obj.status = 'in_progress'
        request_obj.save()
        
        # Create report shell if not exists
        if not hasattr(request_obj, 'report'):
            InspectionReport.objects.create(
                request=request_obj,
                submitted_by=request.user,
                submitted_at=timezone.now()
            )
            
        return res

    @decorators.action(detail=False, methods=['post'], url_path='checkout/(?P<request_id>[^/.]+)')
    def checkout(self, request, request_id=None):
        checkin = get_object_or_404(InspectionCheckIn, request_id=request_id)
        
        # PERMISSION CHECK
        is_assigned = checkin.request.assignments.filter(inspector__user=request.user, is_active=True).exists()
        if not (request.user.is_superuser or is_assigned):
            return Response({'detail': 'Only the assigned inspector can check out.'}, status=403)

        checkin.checkout_photo = request.FILES.get('checkout_photo')
        checkin.checkout_lat = request.data.get('checkout_lat')
        checkin.checkout_lng = request.data.get('checkout_lng')
        checkin.checkout_at = timezone.now()
        checkin.save()
        inspection_req = checkin.request
        inspection_req.status = 'submitted'
        inspection_req.save()
        return Response(InspectionCheckInSerializer(checkin).data)


# ──────────────────────────────────────────────
# EVIDENCE
# ──────────────────────────────────────────────

class InspectionEvidenceViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionEvidenceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or has_staff_permission(user, 'can_manage_inspections'):
            return InspectionEvidence.objects.all()
        return InspectionEvidence.objects.filter(
            Q(request__assignments__inspector__user=user, request__assignments__is_active=True) |
            Q(request__client=user)
        )


# ──────────────────────────────────────────────
# REPORT
# ──────────────────────────────────────────────

class InspectionReportViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        is_superuser = user.is_superuser
        can_manage = has_staff_permission(user, 'can_manage_inspections')
        explicit_all = self.request.query_params.get('all') == 'true'

        if is_superuser or (can_manage and (explicit_all or self.action != 'list')):
            return InspectionReport.objects.all()

        return InspectionReport.objects.filter(
            Q(request__client=user) | Q(request__assignments__inspector__user=user, request__assignments__is_active=True)
        )

    def perform_create(self, serializer):
        # We need the request object to check status
        req_id = self.request.data.get('request')
        req = get_object_or_404(InspectionRequest, id=req_id)
        
        # PERMISSION CHECK
        is_assigned = req.assignments.filter(inspector__user=self.request.user, is_active=True).exists()
        if not (self.request.user.is_superuser or is_assigned):
             raise permissions.exceptions.PermissionDenied("Only the assigned inspector can submit reports.")

        if req.status != 'in_progress' and not self.request.user.is_superuser:
             from rest_framework import serializers as drf_serializers
             raise drf_serializers.ValidationError(f"Cannot submit report for request in {req.status} status.")

        report = serializer.save(
            submitted_by=self.request.user,
            submitted_at=timezone.now()
        )
        # Only advance to qa_review if this is a real final submission (has summary and verdict)
        if report.summary and report.verdict and report.summary.strip():
            req.status = 'qa_review'
            req.save()
            # Auto fraud check only on real submissions
            has_flags = auto_fraud_check(req)
            if has_flags:
                report.qa_notes = 'AUTO-FLAGGED: Anomalies detected. Review before approving.'
                report.save()

    @decorators.action(detail=True, methods=['patch'], url_path='finalize')
    def finalize(self, request, pk=None):
        """Inspector finalizes the report with verdict, summary after checklist."""
        report = self.get_object()
        
        # PERMISSION CHECK
        is_assigned = report.request.assignments.filter(inspector__user=request.user, is_active=True).exists()
        if not (request.user.is_superuser or is_assigned):
            return Response({'detail': 'Only the assigned inspector can finalize reports.'}, status=403)

        if report.request.status != 'in_progress' and not request.user.is_superuser:
            return Response({'detail': 'Can only finalize reports while inspection is in progress.'}, status=400)

        if report.is_locked:
            return Response({'detail': 'Report is locked.'}, status=400)
        verdict = request.data.get('verdict')
        summary = request.data.get('summary', '')
        if not verdict or not summary.strip():
            return Response({'detail': 'verdict and summary are required.'}, status=400)
        report.verdict = verdict
        report.summary = summary
        report.finalized_at = timezone.now()
        report.save()
        # Now advance to qa_review
        req = report.request
        req.status = 'qa_review'
        req.save()
        # Run fraud check
        has_flags = auto_fraud_check(req)
        if has_flags:
            report.qa_notes = 'AUTO-FLAGGED: Anomalies detected. Review before approving.'
            report.save()
        return Response(InspectionReportSerializer(report).data)

    @decorators.action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        report = self.get_object()
        
        # PERMISSION CHECK
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'No permission to approve reports.'}, status=403)

        if report.request.status != 'qa_review' and not request.user.is_superuser:
            return Response({'detail': 'Only reports in QA Review can be approved.'}, status=400)

        if report.is_locked:
            return Response({'detail': 'Report already locked.'}, status=400)
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save()
        report.lock_and_hash()
        report.request.status = 'published'
        report.request.save()

        # Update inspector stats
        try:
            active = report.request.assignments.filter(is_active=True).first()
            if active:
                profile = active.inspector
                profile.total_inspections += 1
                profile.save()
        except Exception:
            pass

        notify(report.request.client, 'report_ready',
               f'Your inspection report for {report.request.inspection_id} is ready. Verdict: {report.verdict.upper()}.',
               report.request)
        return Response(InspectionReportSerializer(report).data)

    @decorators.action(detail=True, methods=['post'], url_path='return-for-revision')
    def return_for_revision(self, request, pk=None):
        report = self.get_object()
        
        # PERMISSION CHECK
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'No permission to return reports for revision.'}, status=403)

        if report.is_locked:
            return Response({'detail': 'Cannot return a locked report.'}, status=400)
        notes = request.data.get('notes', '')
        report.qa_notes = notes
        report.save()
        report.request.status = 'in_progress'
        report.request.save()
        active = report.request.assignments.filter(is_active=True).first()
        if active:
            notify(active.inspector.user, 'qa_returned',
                   f'Report for {report.request.inspection_id} was returned: {notes}',
                   report.request)
        return Response({'detail': 'Returned for revision.'})

    @decorators.action(detail=False, methods=['get'], url_path='qa-queue')
    def qa_queue(self, request):
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_inspections')):
            return Response({'detail': 'Requires QA review permissions.'}, status=403)
        # Only show reports where the request is actually in qa_review status
        qs = InspectionReport.objects.filter(
            is_locked=False,
            request__status='qa_review'
        ).select_related('request', 'submitted_by').order_by('finalized_at')
        return Response(InspectionReportSerializer(qs, many=True).data)


# ──────────────────────────────────────────────
# CHECKLIST RESPONSES
# ──────────────────────────────────────────────

class ChecklistResponseViewSet(viewsets.ModelViewSet):
    serializer_class = ChecklistResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or has_staff_permission(user, 'can_manage_inspections'):
            return ChecklistResponse.objects.all()
        return ChecklistResponse.objects.filter(
            Q(report__request__assignments__inspector__user=user, report__request__assignments__is_active=True) |
            Q(report__request__client=user)
        )

    def perform_create(self, serializer):
        response = serializer.save()
        # Auto-flag if item triggers flag on fail
        item = response.checklist_item
        if item.fail_triggers_flag and response.response_value.lower() in ['fail', '1', 'false']:
            response.flagged = True
            response.save()


# ──────────────────────────────────────────────
# RE-INSPECTION
# ──────────────────────────────────────────────

class ReInspectionViewSet(viewsets.ModelViewSet):
    serializer_class = ReInspectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or has_staff_permission(user, 'can_manage_inspections'):
            return ReInspection.objects.all()
        return ReInspection.objects.filter(triggered_by=user)

    def perform_create(self, serializer):
        user = self.request.user
        if not (user.is_superuser or has_staff_permission(user, 'can_manage_inspections')):
            # Only managers can trigger re-inspections (disputes)
             raise permissions.exceptions.PermissionDenied("You do not have permission to trigger re-inspections.")
             
        original = serializer.validated_data['original_request']
        reinsp = serializer.save(triggered_by=user)
        # Create a new InspectionRequest excluding original inspector
        original_inspector = None
        active = original.active_assignment
        if active:
            original_inspector = active.inspector

        new_req = InspectionRequest.objects.create(
            client=original.client,
            category=original.category,
            item_name=original.item_name,
            item_description=original.item_description,
            item_address=original.item_address,
            scope=original.scope,
            turnaround=original.turnaround,
            status='pre_inspection',
        )
        reinsp.new_request = new_req
        reinsp.status = 'assigned'
        reinsp.save()

        # Mark excluded inspector on the new request via notes
        if original_inspector:
            new_req.pre_inspection_notes = f'RE-INSPECTION: Exclude inspector {original_inspector.user.username}'
            new_req.save()


# ──────────────────────────────────────────────
# NOTIFICATIONS
# ──────────────────────────────────────────────

class InspectionNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InspectionNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return InspectionNotification.objects.filter(user=self.request.user)

    @decorators.action(detail=True, methods=['post'], url_path='mark-read')
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save()
        return Response({'is_read': True})

    @decorators.action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        InspectionNotification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All marked read.'})

    @decorators.action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        count = InspectionNotification.objects.filter(user=request.user, is_read=False).count()
        return Response({'count': count})


# ──────────────────────────────────────────────
# FRAUD FLAGS
# ──────────────────────────────────────────────

class FraudFlagViewSet(viewsets.ModelViewSet):
    serializer_class = FraudFlagSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = FraudFlag.objects.all().order_by('-created_at')

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or has_staff_permission(user, 'can_view_reports'):
            return self.queryset
        return FraudFlag.objects.none()

    @decorators.action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_view_reports')):
            return Response(status=403)
        flag = self.get_object()
        flag.resolved = True
        flag.resolved_by = request.user
        flag.save()
        return Response({'resolved': True})


# ──────────────────────────────────────────────
# PUBLIC VERIFY VIEW
# ──────────────────────────────────────────────

class PublicVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, inspection_id):
        try:
            obj = InspectionRequest.objects.select_related(
                'category', 'report'
            ).get(inspection_id=inspection_id)
        except InspectionRequest.DoesNotExist:
            return Response({'detail': 'Inspection not found.'}, status=404)

        data = {
            'inspection_id': obj.inspection_id,
            'category': obj.category.get_full_path(),
            'item_name': obj.item_name,
            'status': obj.status,
            'verdict': None,
            'report_hash': None,
            'inspected_at': None,
            'is_verified': False,
        }
        if hasattr(obj, 'report') and obj.report.is_locked:
            data.update({
                'verdict': obj.report.verdict,
                'report_hash': obj.report.report_hash,
                'inspected_at': obj.report.approved_at,
                'is_verified': True,
            })
        return Response(data)


# ──────────────────────────────────────────────
# INSPECTOR PERFORMANCE (Admin)
# ──────────────────────────────────────────────

class InspectorPerformanceView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

    def get(self, request):
        profiles = InspectorProfile.objects.select_related('user').all()
        data = []
        for p in profiles:
            flags = FraudFlag.objects.filter(request__assignments__inspector=p).count()
            data.append({
                'id': p.id,
                'username': p.user.username,
                'level': p.level,
                'performance_score': float(p.performance_score),
                'total_inspections': p.total_inspections,
                'total_flags': flags,
                'is_available': p.is_available,
            })
        return Response(data)
