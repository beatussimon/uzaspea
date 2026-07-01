from rest_framework import serializers
from .models import Warehouse, WarehouseIntake, WarehouseTransfer

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = ['id', 'name', 'code', 'region', 'address', 'latitude', 'longitude', 'is_active']


class WarehouseIntakeSerializer(serializers.ModelSerializer):
    intake_by_username = serializers.CharField(source='intake_by.username', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    class Meta:
        model = WarehouseIntake
        fields = ['id', 'warehouse', 'warehouse_name', 'order', 'intake_by', 'intake_by_username', 'package_condition', 'photo', 'seller_signature', 'staff_signature', 'notes', 'created_at']
        read_only_fields = ['intake_by', 'created_at']


class WarehouseTransferSerializer(serializers.ModelSerializer):
    transfer_by_username = serializers.CharField(source='transfer_by.username', read_only=True)
    source_warehouse_name = serializers.CharField(source='source_warehouse.name', read_only=True)
    destination_warehouse_name = serializers.CharField(source='destination_warehouse.name', read_only=True)

    class Meta:
        model = WarehouseTransfer
        fields = [
            'id', 'source_warehouse', 'source_warehouse_name',
            'destination_warehouse', 'destination_warehouse_name',
            'order', 'transfer_by', 'transfer_by_username', 'status',
            'shipped_at', 'received_at', 'created_at'
        ]
        read_only_fields = ['transfer_by', 'shipped_at', 'received_at', 'created_at']
