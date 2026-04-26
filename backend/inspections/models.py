import hashlib
import json
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


# ─────────────────────────────────────────────
# CATEGORY TREE
# ─────────────────────────────────────────────

class InspectionCategory(models.Model):
    LEVEL_CHOICES = [
        ('domain', 'Domain'),
        ('category', 'Category'),
        ('subcategory', 'Subcategory'),
        ('item_type', 'Item Type'),
    ]
    INSPECTOR_LEVEL_CHOICES = [
        ('junior', 'Junior'),
        ('senior', 'Senior'),
        ('specialist', 'Specialist'),
    ]

    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, blank=True)
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='category')
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='children'
    )
    description = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    required_inspector_level = models.CharField(
        max_length=20, choices=INSPECTOR_LEVEL_CHOICES, default='junior'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Inspection Categories'
        ordering = ['name']

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            base = slugify(self.name)
            slug = base
            n = 1
            while InspectionCategory.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{n}'
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def get_ancestors(self):
        ancestors = []
        node = self.parent
        while node:
            ancestors.insert(0, node)
            node = node.parent
        return ancestors

    def get_full_path(self):
        return ' → '.join([a.name for a in self.get_ancestors()] + [self.name])

    def __str__(self):
        return self.get_full_path()


# ─────────────────────────────────────────────
# CHECKLIST TEMPLATES
# ─────────────────────────────────────────────

class ChecklistTemplate(models.Model):
    category = models.ForeignKey(
        InspectionCategory, on_delete=models.CASCADE, related_name='templates'
    )
    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        unique_together = ('category', 'version')
        ordering = ['-version']

    def __str__(self):
        return f'{self.category.name} — v{self.version}'


class ChecklistItem(models.Model):
    ITEM_TYPE_CHOICES = [
        ('pass_fail', 'Pass / Fail'),
        ('scale', 'Scale 1–5'),
        ('measurement', 'Measurement'),
        ('text', 'Text Note'),
        ('media', 'Media Required'),
    ]

    template = models.ForeignKey(
        ChecklistTemplate, on_delete=models.CASCADE, related_name='items'
    )
    label = models.CharField(max_length=255)
    item_type = models.CharField(max_length=20, choices=ITEM_TYPE_CHOICES, default='pass_fail')
    is_mandatory = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    fail_triggers_flag = models.BooleanField(
        default=False,
        help_text='Auto-flag report if this item fails'
    )
    unit = models.CharField(
        max_length=30, blank=True,
        help_text='Unit for measurement items e.g. mm, kg'
    )
    help_text = models.TextField(blank=True, help_text='Guidance shown to inspector')

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.template} — {self.label}'


# ─────────────────────────────────────────────
# INSPECTOR PROFILE
# ─────────────────────────────────────────────

class InspectorProfile(models.Model):
    LEVEL_CHOICES = [
        ('junior', 'Junior'),
        ('senior', 'Senior'),
        ('specialist', 'Specialist'),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='inspector_profile'
    )
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='junior')
    certified_categories = models.ManyToManyField(
        InspectionCategory, blank=True, related_name='certified_inspectors'
    )
    is_available = models.BooleanField(default=True)
    performance_score = models.DecimalField(max_digits=5, decimal_places=2, default=100.00)
    total_inspections = models.PositiveIntegerField(default=0)
    total_flags = models.PositiveIntegerField(default=0)
    phone_number = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user.username} ({self.level})'


# ─────────────────────────────────────────────
# INSPECTION REQUEST & BILLING
# ─────────────────────────────────────────────

class InspectionRequest(models.Model):
    SCOPE_CHOICES = [
        ('basic', 'Basic'),
        ('standard', 'Standard'),
        ('deep', 'Deep / Technical'),
    ]
    TURNAROUND_CHOICES = [
        ('standard', 'Standard (24–48h)'),
        ('express', 'Express (Same Day)'),
        ('instant', 'Instant (Within Hours)'),
    ]
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('bill_sent', 'Bill Sent'),
        ('deposit_paid', 'Deposit Paid'),
        ('pre_inspection', 'Pre-Inspection'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('qa_review', 'QA Review'),
        ('published', 'Published'),
        ('cancelled', 'Cancelled'),
        ('blocked', 'Blocked'),
        ('rescheduled', 'Rescheduled'),
    ]

    client = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='inspection_requests'
    )
    category = models.ForeignKey(
        InspectionCategory, on_delete=models.PROTECT, related_name='requests'
    )
    inspection_id = models.CharField(max_length=40, unique=True, blank=True)
    item_name = models.CharField(max_length=255)
    item_description = models.TextField()
    item_address = models.TextField(help_text='Full address / location of item')
    item_age_years = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Age of item in years (affects complexity surcharge)'
    )
    is_complex = models.BooleanField(
        default=False,
        help_text='Mark if item is unusually complex'
    )
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default='standard')
    turnaround = models.CharField(
        max_length=20, choices=TURNAROUND_CHOICES, default='standard'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    pre_inspection_notes = models.TextField(
        blank=True, help_text='Notes from pre-inspection readiness check'
    )
    reinspection_coverage = models.BooleanField(
        default=False,
        help_text='Client purchased re-inspection coverage'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.inspection_id:
            self.inspection_id = self._generate_id()
        super().save(*args, **kwargs)

    def _generate_id(self):
        from django.utils import timezone
        import random
        domain_code = self.category.name[:3].upper() if self.category_id else 'GEN'
        date_str = timezone.now().strftime('%Y%m%d')
        seq = str(InspectionRequest.objects.filter(
            inspection_id__contains=date_str
        ).count() + 1).zfill(5)
        return f'UZ-{domain_code}-{date_str}-{seq}'

    def __str__(self):
        return f'{self.inspection_id} — {self.item_name}'


class InspectionBill(models.Model):
    request = models.OneToOneField(
        InspectionRequest, on_delete=models.CASCADE, related_name='bill'
    )
    base_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    scope_multiplier = models.DecimalField(max_digits=4, decimal_places=2, default=1.00)
    turnaround_surcharge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    complexity_surcharge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    travel_surcharge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    inspector_level_surcharge = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    reinspection_coverage_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    remaining_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='TZS')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Bill for {self.request.inspection_id} — {self.total_amount} {self.currency}'


class InspectionPayment(models.Model):
    STAGE_CHOICES = [
        ('deposit', 'Booking Deposit'),
        ('balance', 'Remaining Balance'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    request = models.ForeignKey(
        InspectionRequest, on_delete=models.CASCADE, related_name='payments'
    )
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    proof_image = models.ImageField(upload_to='inspection_payment_proofs/', blank=True, null=True)
    transaction_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    confirmed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='confirmed_inspection_payments'
    )
    confirmed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.stage} for {self.request.inspection_id} ({self.status})'


# ─────────────────────────────────────────────
# ASSIGNMENT
# ─────────────────────────────────────────────

class InspectionAssignment(models.Model):
    request = models.OneToOneField(
        InspectionRequest, on_delete=models.CASCADE, related_name='assignment'
    )
    inspector = models.ForeignKey(
        InspectorProfile, on_delete=models.PROTECT, related_name='assignments'
    )
    assigned_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='inspection_assignments_made'
    )
    is_manual_override = models.BooleanField(default=False)
    override_reason = models.TextField(blank=True)
    sla_deadline = models.DateTimeField(null=True, blank=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.request.inspection_id} → {self.inspector.user.username}'


# ─────────────────────────────────────────────
# EVIDENCE & LOCATION
# ─────────────────────────────────────────────

class InspectionCheckIn(models.Model):
    request = models.OneToOneField(
        InspectionRequest, on_delete=models.CASCADE, related_name='checkin'
    )
    checkin_photo = models.ImageField(upload_to='inspection_checkins/')
    checkin_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    checkin_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    checkin_at = models.DateTimeField(auto_now_add=True)
    checkout_photo = models.ImageField(upload_to='inspection_checkouts/', blank=True, null=True)
    checkout_lat = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    checkout_lng = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    checkout_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f'CheckIn for {self.request.inspection_id}'


class InspectionEvidence(models.Model):
    request = models.ForeignKey(
        InspectionRequest, on_delete=models.CASCADE, related_name='evidence'
    )
    checklist_item = models.ForeignKey(
        ChecklistItem, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='evidence'
    )
    image = models.ImageField(upload_to='inspection_evidence/')
    captured_at = models.DateTimeField(auto_now_add=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    file_hash = models.CharField(max_length=64, blank=True)
    caption = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['captured_at']

    def save(self, *args, **kwargs):
        if self.image and not self.file_hash:
            h = hashlib.sha256()
            for chunk in self.image.chunks():
                h.update(chunk)
            self.file_hash = h.hexdigest()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Evidence for {self.request.inspection_id}'


# ─────────────────────────────────────────────
# REPORT
# ─────────────────────────────────────────────

class InspectionReport(models.Model):
    VERDICT_CHOICES = [
        ('pass', 'Pass'),
        ('conditional', 'Conditional'),
        ('fail', 'Fail'),
    ]

    request = models.OneToOneField(
        InspectionRequest, on_delete=models.CASCADE, related_name='report'
    )
    checklist_template_version = models.PositiveIntegerField(default=1)
    verdict = models.CharField(max_length=20, choices=VERDICT_CHOICES)
    summary = models.TextField()
    is_locked = models.BooleanField(default=False)
    report_hash = models.CharField(max_length=64, blank=True)
    submitted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='submitted_inspection_reports'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='approved_inspection_reports'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    qa_notes = models.TextField(blank=True)

    def lock_and_hash(self):
        data = {
            'inspection_id': self.request.inspection_id,
            'verdict': self.verdict,
            'summary': self.summary,
            'approved_at': str(self.approved_at),
        }
        self.report_hash = hashlib.sha256(
            json.dumps(data, sort_keys=True).encode()
        ).hexdigest()
        self.is_locked = True
        self.save()

    def __str__(self):
        return f'Report — {self.request.inspection_id} ({self.verdict})'


class ChecklistResponse(models.Model):
    report = models.ForeignKey(
        InspectionReport, on_delete=models.CASCADE, related_name='responses'
    )
    checklist_item = models.ForeignKey(
        ChecklistItem, on_delete=models.PROTECT, related_name='responses'
    )
    response_value = models.TextField()
    flagged = models.BooleanField(default=False)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ('report', 'checklist_item')

    def __str__(self):
        return f'{self.checklist_item.label}: {self.response_value}'


# ─────────────────────────────────────────────
# RE-INSPECTION
# ─────────────────────────────────────────────

class ReInspection(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('assigned', 'Assigned'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    original_request = models.ForeignKey(
        InspectionRequest, on_delete=models.CASCADE,
        related_name='reinspections'
    )
    new_request = models.OneToOneField(
        InspectionRequest, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='is_reinspection_of'
    )
    triggered_by = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='triggered_reinspections'
    )
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    discount_applied = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'ReInspection of {self.original_request.inspection_id}'


# ─────────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────────

class InspectionNotification(models.Model):
    TYPE_CHOICES = [
        ('bill_ready', 'Bill Ready'),
        ('payment_confirmed', 'Payment Confirmed'),
        ('payment_rejected', 'Payment Rejected'),
        ('assigned', 'Inspector Assigned'),
        ('in_progress', 'Inspection In Progress'),
        ('report_ready', 'Report Ready'),
        ('qa_returned', 'Report Returned for Revision'),
        ('reinspection_ready', 'Re-inspection Ready'),
        ('status_update', 'Status Update'),
        ('sla_breach', 'SLA Breach'),
    ]

    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='inspection_notifications'
    )
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    message = models.TextField()
    related_request = models.ForeignKey(
        InspectionRequest, on_delete=models.CASCADE,
        null=True, blank=True, related_name='notifications'
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Notification → {self.user.username}: {self.notification_type}'


# ─────────────────────────────────────────────
# FRAUD & SLA FLAGS
# ─────────────────────────────────────────────

class FraudFlag(models.Model):
    FLAG_TYPES = [
        ('speed_anomaly', 'Speed Anomaly'),
        ('no_checkin', 'Missing Check-In'),
        ('no_media', 'No Media Submitted'),
        ('gps_mismatch', 'GPS Mismatch'),
        ('pattern_match', 'Collusion Pattern'),
    ]

    request = models.ForeignKey(
        InspectionRequest, on_delete=models.CASCADE, related_name='fraud_flags'
    )
    flag_type = models.CharField(max_length=30, choices=FLAG_TYPES)
    details = models.TextField()
    resolved = models.BooleanField(default=False)
    resolved_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='resolved_fraud_flags'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Flag: {self.flag_type} on {self.request.inspection_id}'


class SLABreach(models.Model):
    request = models.ForeignKey(
        InspectionRequest, on_delete=models.CASCADE, related_name='sla_breaches'
    )
    phase = models.CharField(max_length=50)
    breached_at = models.DateTimeField(auto_now_add=True)
    escalated_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='escalated_sla_breaches'
    )

    def __str__(self):
        return f'SLA Breach: {self.phase} for {self.request.inspection_id}'
