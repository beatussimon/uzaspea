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
            name="Electronics",
            slug="electronics",
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
            name="General",
            slug="general",
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
