from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
import datetime

from billing.models import CommissionLedgerEntry, MonthlyInvoice, CommissionPayment
from marketplace.models import Order, Category, Product

User = get_user_model()

class BillingTestCase(TestCase):
    def setUp(self):
        self.seller = User.objects.create_user(username="seller", password="password")
        self.buyer = User.objects.create_user(username="buyer", password="password")
        
        self.category = Category.objects.create(name="Gizmos", slug="gizmos")
        self.product = Product.objects.create(
            name="Super Gizmo",
            slug="super-gizmo",
            category=self.category,
            price=Decimal("50000.00"),
            stock=10,
            seller=self.seller,
            condition="New"
        )
        
        self.order = Order.objects.create(
            user=self.buyer,
            total_amount=Decimal("50000.00"),
            status="AWAITING_PAYMENT",
            delivery_info={"address": "Test Address"}
        )

    def test_commission_ledger_entry(self):
        entry = CommissionLedgerEntry.objects.create(
            order=self.order,
            seller=self.seller,
            order_amount=Decimal("50000.00"),
            commission_rate=Decimal("10.00"),
            commission_amount=Decimal("5000.00"),
            entry_type=CommissionLedgerEntry.EntryType.COMMISSION
        )
        self.assertEqual(entry.commission_amount, Decimal("5000.00"))
        self.assertEqual(str(entry), f"seller - COMMISSION - 5000.00")

    def test_monthly_invoice_and_payment(self):
        invoice = MonthlyInvoice.objects.create(
            seller=self.seller,
            year=2026,
            month=6,
            total_order_amount=Decimal("50000.00"),
            total_commission=Decimal("5000.00"),
            order_count=1,
            status=MonthlyInvoice.Status.UNPAID,
            due_date=datetime.date(2026, 7, 5)
        )
        self.assertEqual(invoice.total_commission, Decimal("5000.00"))
        self.assertEqual(str(invoice), "seller Invoice - 2026/06 (UNPAID)")
        
        payment = CommissionPayment.objects.create(
            invoice=invoice,
            amount=Decimal("5000.00"),
            transaction_id="TX123456",
            status=CommissionPayment.Status.PENDING,
            submitted_by=self.seller
        )
        self.assertEqual(payment.amount, Decimal("5000.00"))
        self.assertEqual(str(payment), "seller Payment - 5000.00 (PENDING)")

    def test_commission_on_completion(self):
        from marketplace.services import OrderStateMachine
        from marketplace.models import OrderItem, SiteSettings
        
        # Ensure SiteSettings is created and has a 10% commission rate
        settings = SiteSettings.get()
        settings.commission_rate = Decimal("10.00")
        settings.save()

        order = Order.objects.create(
            user=self.buyer,
            total_amount=Decimal("100000.00"),
            status="DELIVERED",
            delivery_info={"address": "Test Address"}
        )
        
        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=1,
            price=Decimal("100000.00")
        )

        # Transition order to COMPLETED
        OrderStateMachine.transition_order(order, 'COMPLETED')

        # Check ledger entry
        entries = CommissionLedgerEntry.objects.filter(order=order)
        self.assertEqual(entries.count(), 1)
        entry = entries.first()
        self.assertEqual(entry.order_amount, Decimal("100000.00"))
        self.assertEqual(entry.commission_rate, Decimal("10.00"))
        self.assertEqual(entry.commission_amount, Decimal("10000.00"))
        self.assertEqual(entry.seller, self.seller)

    def test_commission_reversal_on_cancellation(self):
        """MED-7: Dispute then cancel an order with commission must produce net-zero commission.

        Real path: DELIVERED → DISPUTED → CANCELLED.
        The commission entry is created manually here to simulate an order that
        was already completed/charged before being disputed.
        """
        from marketplace.services import OrderStateMachine
        from marketplace.models import OrderItem, SiteSettings

        settings = SiteSettings.get()
        settings.commission_rate = Decimal("10.00")
        settings.save()

        # Create the order already at DELIVERED (commission has already been charged)
        order = Order.objects.create(
            user=self.buyer,
            total_amount=Decimal("100000.00"),
            status="DELIVERED",
            delivery_info={"address": "Test Address"}
        )

        OrderItem.objects.create(
            order=order,
            product=self.product,
            quantity=1,
            price=Decimal("100000.00")
        )

        # Manually create a commission entry simulating what would have happened at COMPLETED
        commission_entry = CommissionLedgerEntry.objects.create(
            order=order,
            seller=self.seller,
            order_amount=Decimal("100000.00"),
            commission_rate=Decimal("10.00"),
            commission_amount=Decimal("10000.00"),
            entry_type=CommissionLedgerEntry.EntryType.COMMISSION
        )

        # Dispute the delivered order (real-world dispute path)
        OrderStateMachine.transition_order(order, "DISPUTED")

        # Staff resolves in buyer's favour — cancel the disputed order
        OrderStateMachine.transition_order(order, "CANCELLED")

        reversal_entries = CommissionLedgerEntry.objects.filter(
            order=order, entry_type=CommissionLedgerEntry.EntryType.REVERSAL
        )
        self.assertEqual(reversal_entries.count(), 1, "A reversal entry must be created on cancellation")

        reversal = reversal_entries.first()

        # Reversal amounts must exactly negate the original commission
        self.assertEqual(reversal.order_amount, -commission_entry.order_amount)
        self.assertEqual(reversal.commission_amount, -commission_entry.commission_amount)
        self.assertEqual(reversal.seller, commission_entry.seller)

        # Net commission across all entries must be zero
        all_entries = CommissionLedgerEntry.objects.filter(order=order)
        net = sum(e.commission_amount for e in all_entries)
        self.assertEqual(net, Decimal("0.00"), "Net commission after cancellation must be zero")
