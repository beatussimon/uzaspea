from rest_framework import viewsets, permissions
from .models import Region, District
from .serializers import RegionSerializer, DistrictSerializer

class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Region.objects.all().order_by('name')
    serializer_class = RegionSerializer
    pagination_class = None
    permission_classes = [permissions.AllowAny]

class DistrictViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = District.objects.all().order_by('name')
    serializer_class = DistrictSerializer
    pagination_class = None
    permission_classes = [permissions.AllowAny]
