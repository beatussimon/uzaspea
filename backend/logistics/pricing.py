import math
from decimal import Decimal
from .models import DeliveryOption

def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    # Radius of the earth in km
    R = 6371.0
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    distance = R * c
    return distance


def calculate_delivery_price(start_lat, start_lng, end_lat, end_lng, weight, size, speed_code):
    distance = calculate_haversine_distance(
        float(start_lat), float(start_lng),
        float(end_lat), float(end_lng)
    )
    
    # Size multiplier
    size_multipliers = {
        'small': Decimal('1.0'),
        'medium': Decimal('1.2'),
        'large': Decimal('1.5'),
        'oversized': Decimal('2.5'),
    }
    size_mult = size_multipliers.get(size.lower(), Decimal('1.0'))
    
    try:
        opt = DeliveryOption.objects.get(code=speed_code.lower())
        base = opt.base_price
        per_km = opt.per_km_rate
        per_kg = opt.per_kg_rate
    except (DeliveryOption.DoesNotExist, Exception):
        # Fallback defaults
        defaults = {
            'economy': (Decimal('2000.00'), Decimal('100.00'), Decimal('50.00')),
            'standard': (Decimal('4000.00'), Decimal('150.00'), Decimal('75.00')),
            'express': (Decimal('7000.00'), Decimal('250.00'), Decimal('120.00')),
            'urgent': (Decimal('12000.00'), Decimal('450.00'), Decimal('200.00')),
        }
        base, per_km, per_kg = defaults.get(speed_code.lower(), defaults['standard'])
        
    distance_cost = Decimal(str(distance)) * per_km
    weight_cost = Decimal(str(weight)) * per_kg
    
    total_cost = (base + distance_cost + weight_cost) * size_mult
    # Round to nearest 100 TZS
    total_cost = Decimal(str(round(total_cost / 100) * 100))
    return max(total_cost, Decimal('0.00'))
