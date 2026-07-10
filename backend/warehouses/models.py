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


class HistoricalRoutePricing(models.Model):
    origin_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='origin_prices')
    destination_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='destination_prices')
    average_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    data_points = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('origin_warehouse', 'destination_warehouse')

    def __str__(self):
        return f"{self.origin_warehouse.code} -> {self.destination_warehouse.code}: {self.average_cost}"


class WarehouseIntake(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name='intakes')
    order = models.ForeignKey('marketplace.Order', on_delete=models.CASCADE, related_name='warehouse_intakes')
    intake_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='warehouse_intakes')
    package_condition = models.CharField(max_length=50, default='good')
    photo = models.ImageField(upload_to='warehouse_intakes/', blank=True, null=True)
    seller_signature = models.TextField(blank=True, null=True, help_text="Base64 encoded seller signature")
    staff_signature = models.TextField(blank=True, null=True, help_text="Base64 encoded staff signature")
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


from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=WarehouseIntake)
def auto_route_intake(sender, instance, created, **kwargs):
    if created:
        order = instance.order
        current_warehouse = instance.warehouse
        
        # 1. Auto-create Shipment if one does not exist
        from logistics.models import Shipment
        Shipment.objects.get_or_create(
            order=order,
            defaults={'status': 'pending', 'carrier_type': 'driver'}
        )
        
        # 2. Check if a warehouse transfer is required (i.e. destination warehouse is different from current)
        dest_code = order.delivery_info.get('destination_warehouse_code') if order.delivery_info else None
        if dest_code and dest_code != current_warehouse.code:
            try:
                dest_warehouse = Warehouse.objects.get(code=dest_code)
                WarehouseTransfer.objects.get_or_create(
                    order=order,
                    source_warehouse=current_warehouse,
                    destination_warehouse=dest_warehouse,
                    defaults={'status': 'pending'}
                )
            except Warehouse.DoesNotExist:
                pass

class WarehouseStaffAssignment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='warehouse_assignments')
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name='staff_assignments')
    is_manager = models.BooleanField(default=False, help_text="Managers can edit/void intake records and view reports for this warehouse.")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'warehouse')
        verbose_name = "Warehouse Staff Assignment"
        verbose_name_plural = "Warehouse Staff Assignments"

    def __str__(self):
        return f"{self.user.username} @ {self.warehouse.code}" + (" (Manager)" if self.is_manager else "")
