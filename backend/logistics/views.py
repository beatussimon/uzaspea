from rest_framework import viewsets, permissions, status, views
from rest_framework.response import Response
from rest_framework.decorators import action
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import Shipment, DeliveryOption, PickupCode, LocationPing, DriverPayment
from .serializers import ShipmentSerializer, DeliveryOptionSerializer, LocationPingSerializer, DriverPaymentSerializer
from .pricing import calculate_delivery_price
from marketplace.models import Order
from marketplace.services import OrderStateMachine
from uzachuo.permissions import IsStaffMember, has_staff_permission

from .utils import is_vehicle_category, order_has_vehicles


class DeliveryOptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DeliveryOption.objects.filter(is_active=True)
    serializer_class = DeliveryOptionSerializer
    permission_classes = [permissions.AllowAny]


class ShipmentViewSet(viewsets.ModelViewSet):
    serializer_class = ShipmentSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve', 'latest_ping', 'ping']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsStaffMember()]

    def get_queryset(self):
        user = self.request.user
        is_staff = user.is_superuser or (hasattr(user, 'staff_profile') and user.staff_profile.is_active)
        queryset = Shipment.objects.select_related(
            'order', 'driver'
        ).prefetch_related(
            'order__orderitem_set__product__category'
        ).all()
        
        status_param = self.request.query_params.get('status')
        order_param = self.request.query_params.get('order')
        
        if is_staff:
            if status_param:
                queryset = queryset.filter(status=status_param)
            if order_param:
                queryset = queryset.filter(order_id=order_param)
            return queryset
            
        from django.db.models import Q
        queryset = queryset.filter(
            Q(order__user=user) |
            Q(driver=user) |
            Q(order__orderitem_set__product__seller=user)
        ).distinct()
        
        if status_param:
            queryset = queryset.filter(status=status_param)
        if order_param:
            queryset = queryset.filter(order_id=order_param)
            
        return queryset

    @action(detail=True, methods=['get'], url_path='latest-ping')
    def latest_ping(self, request, pk=None):
        shipment = self.get_object()
        ping = shipment.pings.order_by('-recorded_at').first()
        if not ping:
            return Response({'error': 'No location ping found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(LocationPingSerializer(ping).data)

    @action(detail=False, methods=['get'])
    def drivers(self, request):
        from .models import Driver
        drivers = Driver.objects.filter(is_active=True).select_related('user')
        data = [{'id': d.user.id, 'username': d.user.username, 'email': d.user.email, 'vehicle_type': d.vehicle_type, 'assigned_region': d.assigned_region} for d in drivers]
        return Response(data)

    def perform_create(self, serializer):
        if not (self.request.user.is_superuser or has_staff_permission(self.request.user, 'can_manage_logistics')):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to manage logistics.')
        order = serializer.validated_data['order']
        new_status = serializer.validated_data.get('status', 'pending')
        driver = serializer.validated_data.get('driver', None)

        if new_status == 'in_transit':
            carrier_type = serializer.validated_data.get('carrier_type', 'driver')
            # Fleet driver assignment is optional for now and not enforced
            # if order_has_vehicles(order):
            #     if carrier_type == 'driver' and not driver:
            #         raise ValidationError("A driver must be assigned to vehicle-category shipments before transit.")
            
            if carrier_type == 'third_party' and not serializer.validated_data.get('third_party_driver_info'):
                raise ValidationError("Third party driver info must be provided for shipments before transit.")

        shipment = serializer.save()
        if driver:
            from marketplace.models import push_notification
            try:
                push_notification(
                    driver, 'delivery_assigned', 'New delivery assigned',
                    f'You have been assigned order #{order.id} for delivery.',
                    f'/driver/deliveries?highlight={order.id}'
                )
            except Exception:
                pass

        if new_status == 'in_transit':
            try:
                OrderStateMachine.transition_order(order, 'IN_TRANSIT', notes="Shipment is in transit.")
            except Exception:
                pass
        elif order.status == 'RECEIVED_AT_WAREHOUSE':
            try:
                OrderStateMachine.transition_order(order, 'ASSIGNED_TRANSPORT', notes="Transport has been assigned for this shipment.")
            except Exception:
                pass

    def perform_update(self, serializer):
        if not (self.request.user.is_superuser or has_staff_permission(self.request.user, 'can_manage_logistics')):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to manage logistics.')
        instance = self.get_object()
        order = serializer.validated_data.get('order', instance.order)
        new_status = serializer.validated_data.get('status', instance.status)
        driver = serializer.validated_data.get('driver', instance.driver)

        if new_status == 'in_transit' and instance.status != 'in_transit':
            carrier_type = serializer.validated_data.get('carrier_type', instance.carrier_type)
            # Fleet driver assignment is optional for now and not enforced
            # if order_has_vehicles(order):
            #     if carrier_type == 'driver' and not driver:
            #         raise ValidationError("A driver must be assigned to vehicle-category shipments before transit.")
            
            if carrier_type == 'third_party' and not serializer.validated_data.get('third_party_driver_info', instance.third_party_driver_info):
                raise ValidationError("Third party driver info must be provided for shipments before transit.")

        shipment = serializer.save()

        if driver and instance.driver != driver:
            from marketplace.models import push_notification
            try:
                push_notification(
                    driver, 'delivery_assigned', 'New delivery assigned',
                    f'You have been assigned order #{order.id} for delivery.',
                    f'/driver/deliveries?highlight={order.id}'
                )
            except Exception:
                pass
        
        if instance.driver and instance.driver != driver:
            from marketplace.models import push_notification
            try:
                push_notification(
                    instance.driver, 'delivery_assigned', 'Delivery unassigned',
                    f'You have been unassigned from order #{order.id}.',
                    f'/driver/deliveries'
                )
            except Exception:
                pass

        if new_status == 'in_transit' and instance.status != 'in_transit':
            try:
                OrderStateMachine.transition_order(order, 'IN_TRANSIT', notes="Shipment is in transit.")
            except Exception:
                pass
        elif new_status == 'arrived_at_hub' and instance.status != 'arrived_at_hub':
            # Hand off visibility to destination warehouse if this was a transfer
            from warehouses.models import WarehouseTransfer
            transfer = WarehouseTransfer.objects.filter(order=order).order_by('-id').first()
            if transfer:
                if transfer.status != 'completed':
                    transfer.status = 'completed'
                    transfer.received_at = timezone.now()
                    transfer.save()
                
                if not order.delivery_info:
                    order.delivery_info = {}
                order.delivery_info['warehouse_code'] = transfer.destination_warehouse.code
                order.save(update_fields=['delivery_info'])

            if order_has_vehicles(order):
                try:
                    OrderStateMachine.transition_order(order, 'READY_FOR_VEHICLE_HANDOVER', notes="Vehicle arrived at local hub and is ready for handover.")
                except Exception:
                    pass
            else:
                try:
                    OrderStateMachine.transition_order(order, 'ARRIVED_AT_REGIONAL_WAREHOUSE', notes="Shipment arrived at regional hub.")
                except Exception:
                    pass
        elif new_status == 'delivered' and instance.status != 'delivered':
            try:
                OrderStateMachine.transition_order(order, 'DELIVERED', notes="Shipment delivered to destination.")
            except Exception:
                pass
        elif instance.status == 'pending' and order.status == 'RECEIVED_AT_WAREHOUSE':
            try:
                OrderStateMachine.transition_order(order, 'ASSIGNED_TRANSPORT', notes="Transport has been assigned for this shipment.")
            except Exception:
                pass

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def confirm_delivery(self, request, pk=None):
        shipment = self.get_object()
        user = request.user
        
        # Check permissions: only assigned driver or staff
        is_staff = user.is_superuser or (hasattr(user, 'staff_profile') and user.staff_profile.is_active)
        if not is_staff and shipment.driver != user:
            return Response({'error': 'You are not authorized to confirm this delivery.'}, status=status.HTTP_403_FORBIDDEN)
            
        code = request.data.get('code')
        if not code:
            return Response({'error': 'Delivery code is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if shipment.order.delivery_code != code:
            return Response({'error': 'Incorrect delivery code. Please verify with the customer.'}, status=status.HTTP_400_BAD_REQUEST)
            
        if shipment.status == 'delivered':
            return Response({'error': 'Shipment is already delivered.'}, status=status.HTTP_400_BAD_REQUEST)
            
        shipment.status = 'delivered'
        shipment.save()
        
        # Once the correct code is provided, the delivery is guaranteed complete.
        # Transition the order directly to COMPLETED to trigger payouts and prompt user for rating.
        from marketplace.services import OrderStateMachine
        try:
            OrderStateMachine.transition_order(shipment.order, 'COMPLETED', notes="Delivery confirmed via secure code.")
        except Exception as e:
            # If for some reason it fails (e.g. state machine rules), we'll try DELIVERED first, then COMPLETED.
            try:
                OrderStateMachine.transition_order(shipment.order, 'DELIVERED', notes="Shipment delivered to destination.")
                OrderStateMachine.transition_order(shipment.order, 'COMPLETED', notes="Delivery confirmed via secure code.")
            except Exception:
                pass
        
        return Response({'status': 'Delivery confirmed successfully.'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def report_failure(self, request, pk=None):
        shipment = self.get_object()
        user = request.user
        
        is_staff = user.is_superuser or (hasattr(user, 'staff_profile') and user.staff_profile.is_active)
        if not is_staff and shipment.driver != user:
            return Response({'error': 'You are not authorized to report failure for this delivery.'}, status=status.HTTP_403_FORBIDDEN)
            
        reason = request.data.get('reason', 'No reason provided')
        shipment.status = 'failed'
        shipment.save()
        
        from marketplace.services import OrderStateMachine
        try:
            OrderStateMachine.transition_order(shipment.order, 'FAILED_DELIVERY', notes=f"Delivery failed: {reason}")
        except Exception:
            pass
            
        return Response({'status': 'Delivery failure reported.'})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def ping(self, request, pk=None):
        shipment = self.get_object()
        if not request.user.is_staff and shipment.driver != request.user:
            raise ValidationError("You are not the driver assigned to this shipment.")
            
        if shipment.status != 'in_transit':
            raise ValidationError("Location pinging is only allowed when shipment is in transit.")
        
        lat = request.data.get('lat')
        lng = request.data.get('lng')
        if lat is None:
            lat = request.data.get('latitude')
        if lng is None:
            lng = request.data.get('longitude')
        source = request.data.get('source', 'driver')

        if lat is None or lng is None:
            raise ValidationError("Both lat (or latitude) and lng (or longitude) are required.")

        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            raise ValidationError("Coordinates must be numbers.")

        ping = LocationPing.objects.create(
            shipment=shipment,
            lat=lat,
            lng=lng,
            source=source
        )

        # Broadcast via WebSocket channel layer
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f'shipment_tracking_{shipment.id}',
                {
                    'type': 'shipment_ping',
                    'shipment_id': shipment.id,
                    'lat': ping.lat,
                    'lng': ping.lng,
                    'recorded_at': ping.recorded_at.isoformat(),
                    'source': ping.source
                }
            )

        return Response({
            'status': 'success',
            'lat': ping.lat,
            'lng': ping.lng,
            'recorded_at': ping.recorded_at
        }, status=status.HTTP_201_CREATED)


class DeliveryQuoteView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        start_lat = request.data.get('start_lat')
        start_lng = request.data.get('start_lng')
        end_lat = request.data.get('end_lat')
        end_lng = request.data.get('end_lng')
        weight = request.data.get('weight', 1.0)
        size = request.data.get('size', 'small')

        if not all([start_lat, start_lng, end_lat, end_lng]):
            return Response({'error': 'Coordinates start_lat, start_lng, end_lat, and end_lng are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Get all active options
        options = DeliveryOption.objects.filter(is_active=True)
        quotes = []
        for opt in options:
            cost = calculate_delivery_price(start_lat, start_lng, end_lat, end_lng, weight, size, opt.code)
            quotes.append({
                'id': opt.id,
                'name': opt.name,
                'code': opt.code,
                'price': cost
            })
            
        # If no delivery options are configured in database, calculate defaults
        if not quotes:
            for code in ['economy', 'standard', 'express', 'urgent']:
                cost = calculate_delivery_price(start_lat, start_lng, end_lat, end_lng, weight, size, code)
                quotes.append({
                    'id': None,
                    'name': code.capitalize(),
                    'code': code,
                    'price': cost
                })

        return Response({'quotes': quotes})


class DriverPaymentViewSet(viewsets.ModelViewSet):
    serializer_class = DriverPaymentSerializer

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated(), IsStaffMember()]

    def get_queryset(self):
        user = self.request.user
        is_staff = user.is_superuser or (hasattr(user, 'staff_profile') and user.staff_profile.is_active)
        
        if is_staff:
            queryset = DriverPayment.objects.filter(is_cancelled=False).select_related('shipment__order', 'driver')
            seller_view = self.request.query_params.get('seller_view')
            if seller_view == 'true':
                queryset = queryset.filter(shipment__order__orderitem_set__product__seller=user).distinct()
            return queryset
            
        from django.db.models import Q
        return DriverPayment.objects.filter(
            Q(shipment__order__orderitem_set__product__seller=user) |
            Q(driver=user),
            is_cancelled=False
        ).distinct().select_related('shipment__order', 'driver')

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        if not (request.user.is_superuser or has_staff_permission(request.user, 'can_manage_logistics')):
            return Response({'error': 'You do not have permission to disburse driver payments.'}, status=403)
        payment = self.get_object()
        if payment.is_paid:
            return Response({'error': 'Payment already processed.'}, status=status.HTTP_400_BAD_REQUEST)
        payment.is_paid = True
        payment.paid_at = timezone.now()
        payment.save()
        return Response({
            'status': 'success',
            'is_paid': payment.is_paid,
            'paid_at': payment.paid_at
        })

from .serializers import DriverSerializer
from .models import Driver

class DriverViewSet(viewsets.ModelViewSet):
    serializer_class = DriverSerializer
    queryset = Driver.objects.select_related('user').all()

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsStaffMember()]

    def perform_create(self, serializer):
        if not (self.request.user.is_superuser or has_staff_permission(self.request.user, 'can_manage_logistics')):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to manage drivers.')
        serializer.save()
