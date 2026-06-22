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
from uzachuo.permissions import IsStaffMember

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


class DeliveryOptionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DeliveryOption.objects.filter(is_active=True)
    serializer_class = DeliveryOptionSerializer
    permission_classes = [permissions.AllowAny]


class ShipmentViewSet(viewsets.ModelViewSet):
    queryset = Shipment.objects.select_related('order', 'driver').all()
    serializer_class = ShipmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    def perform_create(self, serializer):
        order = serializer.validated_data['order']
        new_status = serializer.validated_data.get('status', 'pending')
        driver = serializer.validated_data.get('driver', None)

        if new_status == 'in_transit':
            if order_has_vehicles(order) and not driver:
                raise ValidationError("A driver must be assigned to vehicle-category shipments before transit.")

        shipment = serializer.save()
        if new_status == 'in_transit':
            try:
                OrderStateMachine.transition_order(order, 'IN_TRANSIT', notes="Shipment is in transit.")
            except Exception:
                pass

    def perform_update(self, serializer):
        instance = self.get_object()
        order = serializer.validated_data.get('order', instance.order)
        new_status = serializer.validated_data.get('status', instance.status)
        driver = serializer.validated_data.get('driver', instance.driver)

        if new_status == 'in_transit' and instance.status != 'in_transit':
            if order_has_vehicles(order) and not driver:
                raise ValidationError("A driver must be assigned to vehicle-category shipments before transit.")

        shipment = serializer.save()

        # Update order status based on shipment status updates
        if new_status == 'in_transit' and instance.status != 'in_transit':
            try:
                OrderStateMachine.transition_order(order, 'IN_TRANSIT', notes="Shipment is in transit.")
            except Exception:
                pass
        elif new_status == 'delivered' and instance.status != 'delivered':
            try:
                OrderStateMachine.transition_order(order, 'DELIVERED', notes="Shipment delivered to destination.")
            except Exception:
                pass

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def ping(self, request, pk=None):
        shipment = self.get_object()
        if not request.user.is_staff and shipment.driver != request.user:
            raise ValidationError("You are not the driver assigned to this shipment.")
        
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
    queryset = DriverPayment.objects.select_related('shipment', 'driver').all()
    serializer_class = DriverPaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffMember]

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
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
