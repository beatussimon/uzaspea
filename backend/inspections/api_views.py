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
            return [permissions.IsAdminUser()]
        return super().get_permissions()


# ──────────────────────────────────────────────
# CHECKLIST TEMPLATE
# ──────────────────────────────────────────────

class ChecklistTemplateViewSet(viewsets.ModelViewSet):
    queryset = ChecklistTemplate.objects.filter(is_active=True).prefetch_related('items')
    serializer_class = ChecklistTemplateSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'for_category']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    @decorators.action(detail=False, methods=['get'], url_path='for-category/(?P<category_id>[^/.]+)')
    def for_category(self, request, category_id=None):
        template = ChecklistTemplate.objects.filter(
            category_id=category_id, is_active=True
        ).order_by('-version').first()
        if not template:
            return Response({'detail': 'No template found for this category.'}, status=404)
        return Response(ChecklistTemplateSerializer(template).data)


# ──────────────────────────────────────────────
# INSPECTOR PROFILE
# ──────────────────────────────────────────────

class InspectorProfileViewSet(viewsets.ModelViewSet):
    queryset = InspectorProfile.objects.select_related('user').prefetch_related('certified_categories')
    serializer_class = InspectorProfileSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'me', 'available', 'performance']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    @decorators.action(detail=False, methods=['get'], url_path='available')
    def available(self, request):
        category_id = request.query_params.get('category_id')
        qs = InspectorProfile.objects.filter(is_available=True)
        if category_id:
            qs = qs.filter(certified_categories__id=category_id)
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
            'client', 'category', 'bill', 'assignment', 'report'
        ).prefetch_related('payments', 'notifications')

        # Staff see all; clients see only their own; inspectors see assigned
        # Staff see all; clients see only their own; inspectors see assigned + their own client requests
        if user.is_staff or user.is_superuser:
            return qs.all()
        
        filter_q = Q(client=user)
        if hasattr(user, 'inspector_profile'):
            filter_q |= Q(assignment__inspector__user=user)
        
        return qs.filter(filter_q)

    def perform_create(self, serializer):
        serializer.save(client=self.request.user)

    @decorators.action(detail=True, methods=['post'], url_path='generate-bill')
    def generate_bill(self, request, pk=None):
        """Staff action: generate the inspection bill."""
        obj = self.get_object()
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
        data['travel_surcharge'] = travel_surcharge
        data['total_amount'] = float(data['total_amount']) + float(travel_surcharge)
        data['remaining_balance'] = float(data['total_amount']) - float(data['deposit_amount'])

        bill = InspectionBill.objects.create(request=obj, **{
            k: v for k, v in data.items()
            if k in [f.name for f in InspectionBill._meta.get_fields()]
            and k != 'request' and k != 'breakdown'
        })
        obj.status = 'bill_sent'
        obj.save()
        notify(obj.client, 'bill_ready',
               f'Your inspection bill for {obj.item_name} is ready. Total: {bill.total_amount} {bill.currency}.',
               obj)
        return Response(InspectionBillSerializer(bill).data)

    @decorators.action(detail=True, methods=['post'], url_path='assign')
    def assign(self, request, pk=None):
        """Dispatcher action: assign an inspector."""
        obj = self.get_object()
        inspector_id = request.data.get('inspector_id')
        override_reason = request.data.get('override_reason', '')

        inspector = get_object_or_404(InspectorProfile, id=inspector_id)

        if hasattr(obj, 'assignment'):
            obj.assignment.delete()

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
            assignment__inspector=profile
        ).select_related('category', 'client', 'bill').order_by('-created_at')
        return Response(InspectionRequestListSerializer(qs, many=True, context={'request': request}).data)

    @decorators.action(detail=False, methods=['get'], url_path='dashboard-stats')
    def dashboard_stats(self, request):
        """Staff dashboard statistics."""
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(status=403)
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
        if user.is_staff or user.is_superuser:
            return InspectionPayment.objects.all().order_by('-created_at')
        return InspectionPayment.objects.filter(request__client=user).order_by('-created_at')

    @decorators.action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        payment = self.get_object()
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
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(status=403)
        qs = InspectionPayment.objects.filter(status='pending').order_by('-created_at')
        return Response(InspectionPaymentSerializer(qs, many=True).data)


# ──────────────────────────────────────────────
# CHECK-IN
# ──────────────────────────────────────────────

class InspectionCheckInViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionCheckInSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = InspectionCheckIn.objects.all()

    def create(self, request, *args, **kwargs):
        request_id = request.data.get('request')
        instance = InspectionCheckIn.objects.filter(request_id=request_id).first()
        if instance:
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        return super().create(request, *args, **kwargs)

    @decorators.action(detail=False, methods=['post'], url_path='checkout/(?P<request_id>[^/.]+)')
    def checkout(self, request, request_id=None):
        checkin = get_object_or_404(InspectionCheckIn, request_id=request_id)
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
        return InspectionEvidence.objects.filter(
            request__assignment__inspector__user=self.request.user
        ) | InspectionEvidence.objects.filter(
            request__client=self.request.user
        )


# ──────────────────────────────────────────────
# REPORT
# ──────────────────────────────────────────────

class InspectionReportViewSet(viewsets.ModelViewSet):
    serializer_class = InspectionReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return InspectionReport.objects.all()
        return InspectionReport.objects.filter(
            Q(request__client=user) | Q(request__assignment__inspector__user=user)
        )

    def perform_create(self, serializer):
        report = serializer.save(submitted_by=self.request.user)
        req = report.request
        req.status = 'qa_review'
        req.save()

        # Auto fraud check
        has_flags = auto_fraud_check(req)
        if has_flags:
            report.qa_notes = 'AUTO-FLAGGED: Anomalies detected. Review before approving.'
            report.save()

    @decorators.action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        report = self.get_object()
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
            profile = report.request.assignment.inspector
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
        if report.is_locked:
            return Response({'detail': 'Cannot return a locked report.'}, status=400)
        notes = request.data.get('notes', '')
        report.qa_notes = notes
        report.save()
        report.request.status = 'in_progress'
        report.request.save()
        notify(report.request.assignment.inspector.user, 'qa_returned',
               f'Report for {report.request.inspection_id} was returned: {notes}',
               report.request)
        return Response({'detail': 'Returned for revision.'})

    @decorators.action(detail=False, methods=['get'], url_path='qa-queue')
    def qa_queue(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response(status=403)
        qs = InspectionReport.objects.filter(
            is_locked=False
        ).select_related('request', 'submitted_by').order_by('submitted_at')
        return Response(InspectionReportSerializer(qs, many=True).data)


# ──────────────────────────────────────────────
# CHECKLIST RESPONSES
# ──────────────────────────────────────────────

class ChecklistResponseViewSet(viewsets.ModelViewSet):
    serializer_class = ChecklistResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ChecklistResponse.objects.filter(
            report__request__assignment__inspector__user=self.request.user
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
        if user.is_staff or user.is_superuser:
            return ReInspection.objects.all()
        return ReInspection.objects.filter(triggered_by=user)

    def perform_create(self, serializer):
        original = serializer.validated_data['original_request']
        reinsp = serializer.save(triggered_by=self.request.user)
        # Create a new InspectionRequest excluding original inspector
        original_inspector = None
        if hasattr(original, 'assignment'):
            original_inspector = original.assignment.inspector

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
    permission_classes = [permissions.IsAdminUser]
    queryset = FraudFlag.objects.all().order_by('-created_at')

    @decorators.action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
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
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        profiles = InspectorProfile.objects.select_related('user').all()
        data = []
        for p in profiles:
            flags = FraudFlag.objects.filter(request__assignment__inspector=p).count()
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
