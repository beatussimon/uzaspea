from rest_framework import serializers
from .models import Shipment, DeliveryOption, PickupCode, LocationPing, DriverPayment

class DeliveryOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryOption
        fields = ['id', 'name', 'code', 'base_price', 'per_km_rate', 'per_kg_rate', 'is_active']


class ShipmentSerializer(serializers.ModelSerializer):
    driver_username = serializers.CharField(source='driver.username', read_only=True)
    customer_username = serializers.CharField(source='order.user.username', read_only=True)

    class Meta:
        model = Shipment
        fields = [
            'id', 'order', 'carrier_type', 'driver', 'driver_username',
            'customer_username', 'tracking_number', 'status', 'estimated_delivery',
            'created_at'
        ]


class LocationPingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocationPing
        fields = ['id', 'shipment', 'source', 'lat', 'lng', 'recorded_at']
        read_only_fields = ['id', 'recorded_at']


class DriverPaymentSerializer(serializers.ModelSerializer):
    driver_username = serializers.CharField(source='driver.username', read_only=True)
    shipment_order_id = serializers.IntegerField(source='shipment.order.id', read_only=True)

    class Meta:
        model = DriverPayment
        fields = ['id', 'shipment', 'shipment_order_id', 'driver', 'driver_username', 'amount', 'is_paid', 'paid_at', 'created_at']
        read_only_fields = ['id', 'shipment', 'driver', 'amount', 'paid_at', 'created_at']

