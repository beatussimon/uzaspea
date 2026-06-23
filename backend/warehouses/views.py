from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from .models import Warehouse, WarehouseIntake, WarehouseTransfer
from .serializers import WarehouseSerializer, WarehouseIntakeSerializer, WarehouseTransferSerializer
from marketplace.models import Order
from marketplace.services import OrderStateMachine
from uzachuo.permissions import IsStaffMember

class WarehouseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Warehouse.objects.filter(is_active=True)
    serializer_class = WarehouseSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=['get'], url_path='pending-intakes')
    def pending_intakes(self, request, pk=None):
        warehouse = self.get_object()
        from marketplace.serializers import OrderSerializer
        orders = Order.objects.filter(
            status='SHIPPED_TO_WAREHOUSE',
            delivery_info__warehouse_code=warehouse.code
        ).order_by('order_date')
        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)


class WarehouseIntakeViewSet(viewsets.ModelViewSet):
    queryset = WarehouseIntake.objects.select_related('warehouse', 'order', 'intake_by').all()
    serializer_class = WarehouseIntakeSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def perform_create(self, serializer):
        order = serializer.validated_data['order']
        warehouse = serializer.validated_data['warehouse']
        package_condition = serializer.validated_data.get('package_condition', 'good')

        # 1. Transition the order status
        OrderStateMachine.transition_order(
            order,
            'RECEIVED_AT_WAREHOUSE',
            notes=f"Package received at {warehouse.name}. Condition: {package_condition}"
        )

        # 2. Save with current staff member
        serializer.save(intake_by=self.request.user)


class WarehouseTransferViewSet(viewsets.ModelViewSet):
    serializer_class = WarehouseTransferSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        queryset = WarehouseTransfer.objects.select_related('source_warehouse', 'destination_warehouse', 'order', 'transfer_by').all()
        warehouse_id = self.request.query_params.get('warehouse')
        if warehouse_id:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(source_warehouse_id=warehouse_id) |
                Q(destination_warehouse_id=warehouse_id)
            )
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    def perform_create(self, serializer):
        serializer.save(transfer_by=self.request.user)

    @action(detail=True, methods=['post'])
    def ship(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status != 'pending':
            return Response({'error': 'Transfer has already been shipped or completed'}, status=status.HTTP_400_BAD_REQUEST)
        
        transfer.status = 'in_transit'
        transfer.shipped_at = timezone.now()
        transfer.save()

        # Transition order to IN_TRANSIT
        try:
            OrderStateMachine.transition_order(
                transfer.order,
                'IN_TRANSIT',
                notes=f"Package is in transit from {transfer.source_warehouse.name} to {transfer.destination_warehouse.name}"
            )
        except ValueError:
            # Fallback if transition from current state is not directly allowed
            pass

        return Response({'status': 'in_transit'})

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status != 'in_transit':
            return Response({'error': 'Transfer is not in transit'}, status=status.HTTP_400_BAD_REQUEST)
        
        transfer.status = 'completed'
        transfer.received_at = timezone.now()
        transfer.save()

        # Transition order to ARRIVED_AT_REGIONAL_WAREHOUSE
        OrderStateMachine.transition_order(
            transfer.order,
            'ARRIVED_AT_REGIONAL_WAREHOUSE',
            notes=f"Package received at regional hub: {transfer.destination_warehouse.name}"
        )

        return Response({'status': 'completed'})


from rest_framework.views import APIView
from django.db import transaction

class PickupVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def post(self, request, *args, **kwargs):
        code_str = request.data.get('code')
        if not code_str:
            return Response({'error': 'Verification code is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from logistics.models import PickupCode
        with transaction.atomic():
            try:
                pickup_code = PickupCode.objects.select_for_update().get(code=code_str)
            except PickupCode.DoesNotExist:
                return Response({'error': 'Invalid verification code'}, status=status.HTTP_400_BAD_REQUEST)
            
            if pickup_code.is_used:
                return Response({'error': 'This code has already been used'}, status=status.HTTP_400_BAD_REQUEST)
            
            pickup_code.is_used = True
            pickup_code.used_at = timezone.now()
            pickup_code.save()
            
            OrderStateMachine.transition_order(
                pickup_code.order,
                'DELIVERED',
                notes=f"Order picked up from hub. Verified by secure one-time pickup code: {code_str}"
            )
            
        return Response({
            'status': 'success',
            'message': 'Order pickup verified successfully',
            'order_id': pickup_code.order.id
        })
