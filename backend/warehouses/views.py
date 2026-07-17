from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from .models import Warehouse, WarehouseIntake, WarehouseTransfer, WarehouseStaffAssignment
from .serializers import WarehouseSerializer, WarehouseIntakeSerializer, WarehouseTransferSerializer, WarehouseStaffAssignmentSerializer
from marketplace.models import Order
from marketplace.services import OrderStateMachine
from uzachuo.permissions import IsStaffMember, has_staff_permission


def user_can_access_warehouse(user, warehouse):
    """Returns True if the user may operate on this specific warehouse's queues."""
    if user.is_superuser:
        return True
    from uzachuo.permissions import has_staff_permission
    if has_staff_permission(user, 'can_manage_logistics'):
        return True  # Logistics managers are cross-warehouse by design
    return WarehouseStaffAssignment.objects.filter(user=user, warehouse=warehouse).exists()

class IsSuperUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_superuser)

class WarehouseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Warehouse.objects.filter(is_active=True)
    serializer_class = WarehouseSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsStaffMember()]

    @action(detail=True, methods=['get'], url_path='pending-intakes')
    def pending_intakes(self, request, pk=None):
        warehouse = self.get_object()
        if not user_can_access_warehouse(request.user, warehouse):
            return Response({'error': 'You are not assigned to this warehouse.'}, status=403)
        from marketplace.serializers import WarehouseOrderSerializer
        from django.db.models import Q
        orders = Order.objects.filter(
            (Q(status='SHIPPED_TO_WAREHOUSE') & (Q(delivery_info__warehouse_code=warehouse.code) | Q(delivery_info__isnull=True) | Q(delivery_info={}))) |
            (Q(status__in=['IN_TRANSIT', 'ARRIVED_AT_REGIONAL_WAREHOUSE', 'FAILED_DELIVERY']) & Q(delivery_info__destination_warehouse_code=warehouse.code))
        ).order_by('order_date')
        serializer = WarehouseOrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='received-intakes')
    def received_intakes(self, request, pk=None):
        warehouse = self.get_object()
        if not user_can_access_warehouse(request.user, warehouse):
            return Response({'error': 'You are not assigned to this warehouse.'}, status=403)
        from marketplace.serializers import WarehouseOrderSerializer
        from django.db.models import Q
        orders = Order.objects.filter(
            Q(status='RECEIVED_AT_WAREHOUSE') &
            (Q(delivery_info__current_warehouse_code=warehouse.code) |
             Q(delivery_info__warehouse_code=warehouse.code) |
             Q(delivery_info__destination_warehouse_code=warehouse.code) |
             Q(delivery_info__isnull=True) |
             Q(delivery_info={}))
        ).order_by('order_date')
        serializer = WarehouseOrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='set-delivery-fee')
    def set_delivery_fee(self, request, pk=None):
        current_warehouse = self.get_object()
        
        # Manager check
        user = request.user
        is_manager = False
        if user.is_superuser:
            is_manager = True
        else:
            from uzachuo.permissions import has_staff_permission
            if has_staff_permission(user, 'can_manage_logistics'):
                is_manager = True
            else:
                assignment = WarehouseStaffAssignment.objects.filter(user=user, warehouse=current_warehouse).first()
                if assignment and assignment.is_manager:
                    is_manager = True
                    
        if not is_manager:
            return Response({'error': 'Only warehouse managers can override delivery fees.'}, status=403)
        
        order_id = request.data.get('order_id')
        fee = request.data.get('fee')
        dest_code = request.data.get('destination_warehouse')
        
        if not user_can_access_warehouse(request.user, current_warehouse):
            return Response({'error': 'You are not assigned to this warehouse.'}, status=403)
        
        try:
            order = Order.objects.get(id=order_id)
            if order.status != 'RECEIVED_AT_WAREHOUSE':
                return Response({'error': 'Order must be RECEIVED_AT_WAREHOUSE to set fee.'}, status=400)
            
            if dest_code:
                from warehouses.models import Warehouse as _Warehouse, WarehouseTransfer
                from .models import HistoricalRoutePricing
                from django.db import transaction
                from decimal import Decimal

                if not order.delivery_info:
                    order.delivery_info = {}
                new_di = dict(order.delivery_info)
                new_di['destination_warehouse_code'] = dest_code
                order.delivery_info = new_di
                order.shipping_fee = fee
                order.save(update_fields=['shipping_fee', 'delivery_info'])

                # Update historical route pricing (rolling average) for future staff guidance.
                try:
                    dest_wh_obj = _Warehouse.objects.get(code=dest_code)
                    fee_dec = Decimal(str(fee))
                    with transaction.atomic():
                        hrp, created = HistoricalRoutePricing.objects.select_for_update().get_or_create(
                            origin_warehouse=current_warehouse,
                            destination_warehouse=dest_wh_obj,
                            defaults={'average_cost': fee_dec, 'data_points': 1}
                        )
                        if not created:
                            n = hrp.data_points
                            new_avg = hrp.average_cost + (fee_dec - hrp.average_cost) / Decimal(str(n + 1))
                            hrp.average_cost = new_avg
                            hrp.data_points = n + 1
                            hrp.save(update_fields=['average_cost', 'data_points'])
                except _Warehouse.DoesNotExist:
                    pass

                if dest_code != current_warehouse.code:
                    try:
                        dest_warehouse = _Warehouse.objects.get(code=dest_code)
                        WarehouseTransfer.objects.get_or_create(
                            order=order,
                            source_warehouse=current_warehouse,
                            destination_warehouse=dest_warehouse,
                            defaults={'status': 'pending'}
                        )
                    except _Warehouse.DoesNotExist:
                        pass
            else:
                order.shipping_fee = fee
                order.save(update_fields=['shipping_fee'])
            
            # Transition
            OrderStateMachine.transition_order(order, 'AWAITING_DELIVERY_PAYMENT', notes=f"Final delivery fee confirmed: TSh {fee}")
            return Response({'status': 'success', 'shipping_fee': fee})
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


    @action(detail=True, methods=['get'], url_path='suggested-fee')
    def suggested_fee(self, request, pk=None):
        warehouse = self.get_object()
        dest_code = request.query_params.get('destination_warehouse')
        if not dest_code:
            return Response({'error': 'destination_warehouse query param is required'}, status=400)
        from .models import HistoricalRoutePricing
        from decimal import Decimal
        try:
            dest_wh = Warehouse.objects.get(code=dest_code)
            hrp = HistoricalRoutePricing.objects.filter(
                origin_warehouse=warehouse, destination_warehouse=dest_wh
            ).first()
            if hrp and hrp.data_points > 0:
                return Response({
                    'suggested_fee': float(hrp.average_cost),
                    'data_points': hrp.data_points,
                    'low_range': float(hrp.average_cost * Decimal('0.85')),
                    'high_range': float(hrp.average_cost * Decimal('1.15')),
                })
            return Response({'suggested_fee': None, 'data_points': 0})
        except Warehouse.DoesNotExist:
            return Response({'error': 'Destination warehouse not found'}, status=404)

    @action(detail=True, methods=['get'], url_path='awaiting-payment')
    def awaiting_payment(self, request, pk=None):
        warehouse = self.get_object()
        if not user_can_access_warehouse(request.user, warehouse):
            return Response({'error': 'You are not assigned to this warehouse.'}, status=403)
        from marketplace.serializers import WarehouseOrderSerializer
        from django.db.models import Q
        orders = Order.objects.filter(
            Q(status__in=['AWAITING_DELIVERY_PAYMENT', 'PENDING_DELIVERY_VERIFICATION']) &
            (Q(delivery_info__current_warehouse_code=warehouse.code) |
             Q(delivery_info__warehouse_code=warehouse.code) |
             Q(delivery_info__destination_warehouse_code=warehouse.code) |
             Q(delivery_info__isnull=True) |
             Q(delivery_info={}))
        ).order_by('order_date')
        serializer = WarehouseOrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='outbound-queue')
    def outbound_queue(self, request, pk=None):
        warehouse = self.get_object()
        if not user_can_access_warehouse(request.user, warehouse):
            return Response({'error': 'You are not assigned to this warehouse.'}, status=403)
        from marketplace.serializers import WarehouseOrderSerializer
        from django.db.models import Q
        orders = Order.objects.filter(
            Q(status__in=['ASSIGNED_TRANSPORT', 'READY_FOR_TRANSIT']) &
            (Q(delivery_info__current_warehouse_code=warehouse.code) |
             (Q(delivery_info__isnull=True) | Q(delivery_info={})))
        ).order_by('order_date')
        serializer = WarehouseOrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='ready-for-pickup')
    def ready_for_pickup(self, request, pk=None):
        warehouse = self.get_object()
        if not user_can_access_warehouse(request.user, warehouse):
            return Response({'error': 'You are not assigned to this warehouse.'}, status=403)
        from marketplace.serializers import WarehouseOrderSerializer
        from django.db.models import Q
        orders = Order.objects.filter(
            Q(status__in=['READY_FOR_PICKUP', 'READY_FOR_VEHICLE_HANDOVER']) &
            (Q(delivery_info__current_warehouse_code=warehouse.code) |
             Q(delivery_info__warehouse_code=warehouse.code) |
             Q(delivery_info__destination_warehouse_code=warehouse.code) |
             Q(delivery_info__isnull=True) |
             Q(delivery_info={}))
        ).order_by('order_date')
        serializer = WarehouseOrderSerializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='dispatch-order')
    def dispatch_order(self, request, pk=None):
        warehouse = self.get_object()
        if not (
            request.user.is_superuser
            or has_staff_permission(request.user, 'can_manage_warehouse_intake')
            or user_can_access_warehouse(request.user, warehouse)
        ):
            return Response({'error': 'You do not have permission to perform this action.'}, status=403)
        order_id = request.data.get('order_id')
        try:
            order = Order.objects.get(id=order_id)
            if order.status != 'ASSIGNED_TRANSPORT':
                return Response({'error': 'Order must be in ASSIGNED_TRANSPORT state to be dispatched.'}, status=400)
            
            is_last_mile = order.delivery_info and order.delivery_info.get('current_warehouse_code') == order.delivery_info.get('destination_warehouse_code')
            if is_last_mile:
                notes = f"Package handed over to last-mile courier at {warehouse.name} for final delivery."
                new_status = 'OUT_FOR_DELIVERY'
            else:
                notes = f"Package dispatched from origin warehouse ({warehouse.name}) and is in transit to destination hub."
                new_status = 'IN_TRANSIT'
            
            OrderStateMachine.transition_order(
                order, 
                new_status, 
                notes=notes
            )
            
            # Sync Shipment state
            from logistics.models import Shipment
            shipment = Shipment.objects.filter(order=order).order_by('-created_at').first()
            if shipment and shipment.status == 'pending':
                shipment.status = 'in_transit'
                shipment.save(update_fields=['status'])
            
            # Update transfer record if it exists
            WarehouseTransfer.objects.filter(
                order=order,
                source_warehouse=warehouse,
                status='pending'
            ).update(status='in_transit', shipped_at=timezone.now())
            return Response({'status': 'success'})
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=400)


class WarehouseIntakeViewSet(viewsets.ModelViewSet):
    serializer_class = WarehouseIntakeSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return WarehouseIntake.objects.none()
        from uzachuo.permissions import has_staff_permission
        if user.is_superuser or has_staff_permission(user, 'can_manage_logistics'):
            return WarehouseIntake.objects.select_related('warehouse', 'order', 'intake_by').all()
        assigned_warehouse_ids = WarehouseStaffAssignment.objects.filter(user=user).values_list('warehouse_id', flat=True)
        return WarehouseIntake.objects.filter(warehouse_id__in=assigned_warehouse_ids).select_related('warehouse', 'order', 'intake_by')

    def perform_create(self, serializer):
        warehouse = serializer.validated_data['warehouse']
        if not (
            self.request.user.is_superuser
            or has_staff_permission(self.request.user, 'can_manage_warehouse_intake')
            or user_can_access_warehouse(self.request.user, warehouse)
        ):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to manage warehouse intake.')
        order = serializer.validated_data['order']
        package_condition = serializer.validated_data.get('package_condition', 'good')

        from logistics.utils import order_has_vehicles
        
        if order.status == 'FAILED_DELIVERY':
            new_status = 'RETURNED_TO_HUB'
            notes = f"Failed delivery package returned to hub ({warehouse.name}). Condition: {package_condition}"
            
            origin_code = order.delivery_info.get('warehouse_code') if order.delivery_info else None
            if origin_code and origin_code != warehouse.code:
                # Need to route it back to origin warehouse for seller pickup
                try:
                    origin_wh = Warehouse.objects.get(code=origin_code)
                    WarehouseTransfer.objects.create(
                        order=order,
                        source_warehouse=warehouse,
                        destination_warehouse=origin_wh,
                        status='pending'
                    )
                except Warehouse.DoesNotExist:
                    pass
        elif order.status == 'IN_TRANSIT':
            is_home_delivery = order.delivery_info and order.delivery_info.get('shipping_speed')
            if order_has_vehicles(order):
                new_status = 'READY_FOR_VEHICLE_HANDOVER'
            elif is_home_delivery:
                new_status = 'ASSIGNED_TRANSPORT'
            else:
                new_status = 'READY_FOR_PICKUP'
            notes = f"Package received at destination warehouse ({warehouse.name}). Ready for final delivery/pickup. Condition: {package_condition}"
        elif order.status == 'ARRIVED_AT_REGIONAL_WAREHOUSE':
            is_home_delivery = order.delivery_info and order.delivery_info.get('shipping_speed')
            if order_has_vehicles(order):
                new_status = 'READY_FOR_VEHICLE_HANDOVER'
            elif is_home_delivery:
                new_status = 'ASSIGNED_TRANSPORT'
            else:
                new_status = 'READY_FOR_PICKUP'
            notes = f"Package inspected and shelved at destination hub ({warehouse.name}). Ready for final delivery/pickup. Condition: {package_condition}"
        else:
            new_status = 'RECEIVED_AT_WAREHOUSE'
            notes = f"Package received at origin warehouse ({warehouse.name}). Condition: {package_condition}"

        OrderStateMachine.transition_order(
            order,
            new_status,
            notes=notes
        )

        if not order.delivery_info:
            order.delivery_info = {}
        new_di = dict(order.delivery_info)
        new_di['current_warehouse_code'] = warehouse.code
        order.delivery_info = new_di
        order.save(update_fields=['delivery_info'])

        # Mark any incoming transfer as completed
        WarehouseTransfer.objects.filter(
            order=order,
            destination_warehouse=warehouse,
            status='in_transit'
        ).update(status='completed', received_at=timezone.now())

        # 2. Save with current staff member
        serializer.save(intake_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        is_allowed = user.is_superuser
        if not is_allowed:
            is_allowed = WarehouseStaffAssignment.objects.filter(
                user=user, warehouse=instance.warehouse, is_manager=True
            ).exists()
            
        if not is_allowed:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only warehouse managers or superusers can delete these records.")
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        is_allowed = user.is_superuser
        if not is_allowed:
            is_allowed = WarehouseStaffAssignment.objects.filter(
                user=user, warehouse=instance.warehouse, is_manager=True
            ).exists()
            
        if not is_allowed:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only warehouse managers or superusers can update these records.")
        return super().update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='preview-order')
    def preview_order(self, request):
        order_id = request.query_params.get('order_id')
        if not order_id:
            return Response({'error': 'order_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            order = Order.objects.get(id=order_id)
            
            # Get primary product name/image (name masked for logistics security)
            product_name = "SokoniMax Secured Package"
            product_image = None

            first_item = order.items.select_related('product__seller').first()

            buyer_name = order.user.get_full_name() or order.user.username
            seller_name = "Unknown Seller"
            if first_item:
                seller = first_item.product.seller
                seller_name = seller.get_full_name() or seller.username
                
            from marketplace.serializers import PaymentSerializer
            payments = PaymentSerializer(order.payments.all(), many=True).data

            return Response({
                'id': order.id,
                'status': order.status,
                'product_name': product_name,
                'product_image': product_image,
                'buyer_name': buyer_name,
                'seller_name': seller_name,
                'payments': payments,
                'delivery_info': order.delivery_info,
            })
        except Order.DoesNotExist:
            return Response({'error': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)


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
        source_warehouse = serializer.validated_data.get('source_warehouse')
        if not (
            self.request.user.is_superuser
            or has_staff_permission(self.request.user, 'can_manage_warehouse_transfers')
            or (source_warehouse and user_can_access_warehouse(self.request.user, source_warehouse))
        ):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to manage warehouse transfers.')
        serializer.save(transfer_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only superusers can delete these records.")
        return super().destroy(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only superusers can update these records.")
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def ship(self, request, pk=None):
        transfer = self.get_object()
        if not (
            request.user.is_superuser
            or has_staff_permission(request.user, 'can_manage_warehouse_transfers')
            or user_can_access_warehouse(request.user, transfer.source_warehouse)
        ):
            return Response({'error': 'You do not have permission to manage warehouse transfers.'}, status=403)
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
        if not (
            request.user.is_superuser
            or has_staff_permission(request.user, 'can_manage_warehouse_transfers')
            or user_can_access_warehouse(request.user, transfer.destination_warehouse)
        ):
            return Response({'error': 'You do not have permission to manage warehouse transfers.'}, status=403)
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


class WarehouseStaffAssignmentViewSet(viewsets.ModelViewSet):
    queryset = WarehouseStaffAssignment.objects.select_related('user', 'warehouse').all()
    serializer_class = WarehouseStaffAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperUser]

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
            pickup_code.verified_by = request.user
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
