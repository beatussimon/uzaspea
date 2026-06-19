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
