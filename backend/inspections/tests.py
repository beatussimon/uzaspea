from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal

from inspections.models import InspectionCategory, InspectionRequest, InspectorProfile
from inspections.state_machine import InspectionStateMachine, StateMachineException
from inspections.pricing import calculate_bill

User = get_user_model()

class InspectionPricingTestCase(TestCase):
    def setUp(self):
        self.category = InspectionCategory.objects.create(
            name="Electronics Test",
            slug="electronics-test",
            base_price=Decimal("100000.00"),
            required_inspector_level="senior"
        )

    def test_calculate_bill_basic(self):
        # Basic turnaround standard, no complexity, no age surcharge, no reinspection
        res = calculate_bill(
            category=self.category,
            scope="basic",
            turnaround="standard",
            is_complex=False,
            item_age_years=3,
            add_reinspection_coverage=False
        )
        
        # base_price = 100000
        # basic scope multiplier = 1.00 => adjusted base = 100000
        # senior inspector level rate = 0.20 of base = 20000
        # standard turnaround rate = 0.00 = 0
        # complexity = 0
        # reinspection = 0
        # total = 120000
        self.assertEqual(res['base_rate'], Decimal("100000.00"))
        self.assertEqual(res['inspector_level_surcharge'], Decimal("20000.00"))
        self.assertEqual(res['total_amount'], Decimal("120000.00"))
        # deposit = 30% of total = 36000
        self.assertEqual(res['deposit_amount'], Decimal("36000.00"))
        self.assertEqual(res['remaining_balance'], Decimal("84000.00"))

    def test_calculate_bill_express_deep_complex_age(self):
        # Deep scope, express turnaround, is complex, age > 5 years, add reinspection
        res = calculate_bill(
            category=self.category,
            scope="deep",
            turnaround="express",
            is_complex=True,
            item_age_years=6,
            add_reinspection_coverage=True
        )
        
        # base_price = 100000
        # deep scope multiplier = 2.00 => adjusted base = 200000
        # senior inspector level rate = 0.20 of base = 20000
        # express turnaround rate = 0.30 of base = 30000
        # complexity surcharge = 20% of base = 20000
        # age surcharge = 15% of base = 15000
        # total complexity surcharge = 35000
        # reinspection coverage = 10% of adjusted base = 20000
        # total = 200000 + 20000 + 30000 + 35000 + 20000 = 305000
        self.assertEqual(res['base_rate'], Decimal("200000.00"))
        self.assertEqual(res['inspector_level_surcharge'], Decimal("20000.00"))
        self.assertEqual(res['turnaround_surcharge'], Decimal("30000.00"))
        self.assertEqual(res['complexity_surcharge'], Decimal("35000.00"))
        self.assertEqual(res['reinspection_coverage_fee'], Decimal("20000.00"))
        self.assertEqual(res['total_amount'], Decimal("305000.00"))
        # deposit = 30% of 305000 = 91500
        self.assertEqual(res['deposit_amount'], Decimal("91500.00"))
        self.assertEqual(res['remaining_balance'], Decimal("213500.00"))


class InspectionStateMachineTestCase(TestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(username="client", password="password")
        self.staff_user = User.objects.create_user(username="staff", password="password", is_staff=True)
        self.inspector_user = User.objects.create_user(username="inspector", password="password")
        self.inspector_profile = InspectorProfile.objects.create(
            user=self.inspector_user,
            level="senior",
            is_available=True
        )
        self.superuser = User.objects.create_superuser(username="admin", password="password")
        
        self.category = InspectionCategory.objects.create(
            name="General Test",
            slug="general-test",
            base_price=Decimal("50000.00")
        )
        self.request_obj = InspectionRequest.objects.create(
            client=self.client_user,
            category=self.category,
            status="requested",
            scope="basic",
            turnaround="standard"
        )

    def test_superuser_bypass(self):
        # Superuser can transition to any valid state
        InspectionStateMachine.validate_transition(self.request_obj, "bill_sent", self.superuser)
        # Should raise on invalid status
        with self.assertRaises(StateMachineException):
            InspectionStateMachine.validate_transition(self.request_obj, "invalid_state", self.superuser)

    def test_client_cancellation_rules(self):
        # Client can cancel requested
        InspectionStateMachine.validate_transition(self.request_obj, "cancelled", self.client_user)
        
        # Change state to assigned
        self.request_obj.status = "assigned"
        self.request_obj.save()
        
        # Client cannot cancel assigned or later
        with self.assertRaises(StateMachineException):
            InspectionStateMachine.validate_transition(self.request_obj, "cancelled", self.client_user)
            
        # Staff can cancel assigned
        InspectionStateMachine.validate_transition(self.request_obj, "cancelled", self.staff_user)

    def test_staff_restricted_states(self):
        # Client cannot move requested to bill_sent
        with self.assertRaises(StateMachineException):
            InspectionStateMachine.validate_transition(self.request_obj, "bill_sent", self.client_user)
            
        # Staff can move requested to bill_sent
        InspectionStateMachine.validate_transition(self.request_obj, "bill_sent", self.staff_user)

    def test_invalid_transitions(self):
        # Cannot jump from requested directly to published
        with self.assertRaises(StateMachineException):
            InspectionStateMachine.validate_transition(self.request_obj, "published", self.staff_user)


from django.utils import timezone
from inspections.models import (
    ChecklistTemplate, ChecklistItem, ChecklistResponse,
    InspectionReport, InspectionCheckIn, FraudFlag
)

class AdvancedInspectionWorkflowTestCase(TestCase):
    def setUp(self):
        self.client_user = User.objects.create_user(username="client2", password="password")
        self.inspector_user = User.objects.create_user(username="inspector2", password="password")
        self.category = InspectionCategory.objects.create(
            name="Vehicles Test",
            slug="vehicles-test",
            base_price=Decimal("150000.00")
        )
        self.request_obj = InspectionRequest.objects.create(
            client=self.client_user,
            category=self.category,
            status="in_progress",
            scope="standard",
            turnaround="standard"
        )
        self.template = ChecklistTemplate.objects.create(
            category=self.category,
            version=1,
            is_active=True
        )
        # Create checklist items with different severities
        self.item_critical = ChecklistItem.objects.create(
            template=self.template,
            label="Brakes Condition",
            item_type="pass_fail",
            severity="critical",
            is_mandatory=True,
            order=1
        )
        self.item_major = ChecklistItem.objects.create(
            template=self.template,
            label="Tire Tread",
            item_type="scale",
            severity="major",
            is_mandatory=True,
            order=2
        )
        self.item_advisory = ChecklistItem.objects.create(
            template=self.template,
            label="Air Conditioning",
            item_type="pass_fail",
            severity="advisory",
            is_mandatory=False,
            order=3
        )
        self.report = InspectionReport.objects.create(
            request=self.request_obj,
            checklist_template_version=1,
            verdict="pass",
            summary="Initial report summary",
            submitted_by=self.inspector_user
        )

    def test_calculate_quality_score_all_pass(self):
        # Create all pass responses
        ChecklistResponse.objects.create(
            report=self.report,
            checklist_item=self.item_critical,
            response_value="pass"
        )
        ChecklistResponse.objects.create(
            report=self.report,
            checklist_item=self.item_major,
            response_value="5"
        )
        ChecklistResponse.objects.create(
            report=self.report,
            checklist_item=self.item_advisory,
            response_value="pass"
        )
        score, grade = self.report.calculate_quality_score()
        self.assertEqual(score, Decimal("100.00"))
        self.assertEqual(grade, "A+")

    def test_calculate_quality_score_critical_failure_caps_grade(self):
        # Brakes (critical) fails
        ChecklistResponse.objects.create(
            report=self.report,
            checklist_item=self.item_critical,
            response_value="fail"
        )
        # Major and Advisory pass
        ChecklistResponse.objects.create(
            report=self.report,
            checklist_item=self.item_major,
            response_value="5"
        )
        ChecklistResponse.objects.create(
            report=self.report,
            checklist_item=self.item_advisory,
            response_value="pass"
        )
        
        # total_obtained = 0*5 + 100*3 + 100*1 = 400
        # total_possible = 100*5 + 100*3 + 100*1 = 900
        # expected score = 400/900 * 100 = 44.44% (grade F)
        score, grade = self.report.calculate_quality_score()
        self.assertAlmostEqual(float(score), 44.44, places=2)
        self.assertEqual(grade, "F")

    def test_calculate_quality_score_critical_failure_caps_high_score(self):
        # Brakes (critical) fails
        ChecklistResponse.objects.create(
            report=self.report,
            checklist_item=self.item_critical,
            response_value="fail"
        )
        # Let's say we have large number of minor/major items that pass, so score would normally be high.
        # But we can verify that has_critical_failure flag forces the grade to cap at 'D' if score would otherwise yield A/B/C.
        # Let's create an artificial scenario where total obtained is high (e.g. 700 / 900) but has_critical_failure.
        # If we have 1 critical item fail (wt 5), and 15 advisory items pass (wt 1 each)
        # total obtained = 0*5 + 15 * 100 * 1 = 1500
        # total possible = 5 * 100 + 15 * 100 = 2000
        # score = 75% -> normal grade 'C'. But critical failure caps it at 'D'.
        request2 = InspectionRequest.objects.create(
            client=self.client_user,
            category=self.category,
            status="in_progress",
            scope="standard",
            turnaround="standard"
        )
        report2 = InspectionReport.objects.create(
            request=request2,
            checklist_template_version=1,
            verdict="pass",
            submitted_by=self.inspector_user
        )
        ChecklistResponse.objects.create(
            report=report2,
            checklist_item=self.item_critical,
            response_value="fail"
        )
        for i in range(15):
            item = ChecklistItem.objects.create(
                template=self.template,
                label=f"Advisory {i}",
                item_type="pass_fail",
                severity="advisory",
                order=10+i
            )
            ChecklistResponse.objects.create(
                report=report2,
                checklist_item=item,
                response_value="pass"
            )
        score, grade = report2.calculate_quality_score()
        self.assertEqual(score, Decimal("75.00")) # 1500 / 2000
        self.assertEqual(grade, "D")

    def test_gps_mismatch_fraud_flag(self):
        # Create check-in with mismatch coordinates (>500m)
        # Latitude degrees: 1 degree approx 111 km.
        # Let's place check-in at ( -6.8000, 39.2000 ) and checkout at ( -6.8100, 39.2000 )
        # Distance is roughly 1.1 km, which exceeds 500m threshold.
        from django.core.files.base import ContentFile
        from inspections.api_views import auto_fraud_check
        
        # We need an evidence for the request, otherwise 'no_media' flag is raised (but we specifically test gps_mismatch).
        from inspections.models import InspectionEvidence
        InspectionEvidence.objects.create(
            request=self.request_obj,
            image=ContentFile(b"fake_image_content", name="evidence.jpg")
        )
        
        checkin = InspectionCheckIn.objects.create(
            request=self.request_obj,
            checkin_photo=ContentFile(b"checkin", name="checkin.jpg"),
            checkin_lat=Decimal("-6.800000"),
            checkin_lng=Decimal("39.200000"),
            checkout_photo=ContentFile(b"checkout", name="checkout.jpg"),
            checkout_lat=Decimal("-6.810000"),
            checkout_lng=Decimal("39.200000"),
            checkout_at=timezone.now()
        )
        
        # Clear existing flags just in case
        FraudFlag.objects.filter(request=self.request_obj).delete()
        
        auto_fraud_check(self.request_obj)
        
        # Verify gps_mismatch flag is created
        flags = FraudFlag.objects.filter(request=self.request_obj, flag_type="gps_mismatch")
        self.assertTrue(flags.exists())
