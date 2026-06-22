from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model

User = get_user_model()

class Warehouse(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True, default='')
    region = models.CharField(max_length=100, default='')
    address = models.TextField()
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.code})"


class WarehouseIntake(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='intakes')
    order = models.ForeignKey('marketplace.Order', on_delete=models.CASCADE, related_name='warehouse_intakes')
    intake_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='warehouse_intakes')
    package_condition = models.CharField(max_length=50, default='good')
    photo = models.ImageField(upload_to='warehouse_intakes/', blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Intake of Order #{self.order.id} at {self.warehouse.name}"


class WarehouseTransfer(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_transit', 'In Transit'),
        ('completed', 'Completed'),
    ]
    source_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='transfers_out')
    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='transfers_in')
    order = models.ForeignKey('marketplace.Order', on_delete=models.CASCADE, related_name='warehouse_transfers')
    transfer_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='warehouse_transfers')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    shipped_at = models.DateTimeField(blank=True, null=True)
    received_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Transfer of Order #{self.order_id} from {self.source_warehouse.name} to {self.destination_warehouse.name}"
