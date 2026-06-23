from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
from decimal import Decimal
import secrets

User = get_user_model()

def generate_pickup_code():
    return str(secrets.randbelow(900000) + 100000)

def is_vehicle_category(category):
    if not category:
        return False
    if category.name.lower() == 'vehicles' or category.slug.lower() == 'vehicles':
        return True
    if category.parent:
        return is_vehicle_category(category.parent)
    return False

def order_has_vehicles(order):
    for item in order.orderitem_set.select_related('product__category').all():
        if is_vehicle_category(item.product.category):
            return True
    return False


class DeliveryOption(models.Model):
    name = models.CharField(max_length=50)
    code = models.CharField(max_length=20, unique=True, help_text="e.g. economy, standard, express, urgent")
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    per_km_rate = models.DecimalField(max_digits=10, decimal_places=2)
    per_kg_rate = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} (Base: {self.base_price})"


class Shipment(models.Model):
    CARRIER_CHOICES = [
        ('driver', 'SokoniMax Driver'),
        ('third_party', 'Third-Party Courier'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_transit', 'In Transit'),
        ('arrived_at_hub', 'Arrived At Hub'),
        ('delivered', 'Delivered'),
    ]
    order = models.ForeignKey('marketplace.Order', on_delete=models.CASCADE, related_name='shipments')
    carrier_type = models.CharField(max_length=20, choices=CARRIER_CHOICES, default='driver')
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='shipments')
    tracking_number = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    estimated_delivery = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        old_status = None
        if not is_new:
            old_status = Shipment.objects.filter(pk=self.pk).values_list('status', flat=True).first()
        
        super().save(*args, **kwargs)
        
        if self.status == 'delivered' and old_status != 'delivered':
            if order_has_vehicles(self.order) and self.driver:
                amount = self.order.shipping_fee if (self.order.shipping_fee and self.order.shipping_fee > 0) else Decimal('15000.00')
                DriverPayment.objects.get_or_create(
                    shipment=self,
                    driver=self.driver,
                    defaults={'amount': amount}
                )

    def __str__(self):
        return f"Shipment for Order #{self.order_id} ({self.status})"


class PickupCode(models.Model):
    order = models.ForeignKey('marketplace.Order', on_delete=models.CASCADE, related_name='pickup_codes')
    code = models.CharField(max_length=10, unique=True, default=generate_pickup_code)
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_pickups')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pickup Code for Order #{self.order_id}: {self.code} ({'Used' if self.is_used else 'Active'})"


class LocationPing(models.Model):
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='pings')
    source = models.CharField(max_length=50, default='driver')
    lat = models.FloatField()
    lng = models.FloatField()
    recorded_at = models.DateTimeField(auto_now_add=True)

    @property
    def latitude(self):
        return self.lat

    @property
    def longitude(self):
        return self.lng

    def __str__(self):
        return f"Ping for Shipment #{self.shipment_id} ({self.lat}, {self.lng})"


class DriverPayment(models.Model):
    shipment = models.ForeignKey(Shipment, on_delete=models.CASCADE, related_name='driver_payments')
    driver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='driver_payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Payment of {self.amount} to {self.driver.username if self.driver else 'None'} ({'Paid' if self.is_paid else 'Unpaid'})"

