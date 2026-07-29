from django.contrib import admin
from .models import Region, District

@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)

@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'region')
    search_fields = ('name', 'region__name')
    list_filter = ('region',)
