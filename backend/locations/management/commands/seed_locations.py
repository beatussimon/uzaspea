import os
import time
import requests
from django.core.management.base import BaseCommand
from locations.models import Region, District
from warehouses.models import Warehouse
from django.utils.text import slugify

TANZANIA_REGIONS = {
    'Arusha': ['Arusha City', 'Arumeru', 'Karatu', 'Monduli', 'Ngorongoro', 'Longido'],
    'Dar es Salaam': ['Ilala', 'Kinondoni', 'Temeke', 'Kigamboni', 'Ubungo'],
    'Dodoma': ['Dodoma', 'Bahi', 'Chamwino', 'Chemba', 'Kondoa', 'Kongwa', 'Mpwapwa'],
    'Geita': ['Geita', 'Bukombe', 'Chato', 'Mbogwe', 'Nyang\'hwale'],
    'Iringa': ['Iringa', 'Kilolo', 'Mufindi'],
    'Kagera': ['Bukoba', 'Biharamulo', 'Karagwe', 'Kyerwa', 'Missenyi', 'Muleba', 'Ngara'],
    'Katavi': ['Mpanda', 'Mlele', 'Tanganyika'],
    'Kigoma': ['Kigoma', 'Buhigwe', 'Kakonko', 'Kasulu', 'Kibondo', 'Uvinza'],
    'Kilimanjaro': ['Moshi', 'Hai', 'Mwanga', 'Rombo', 'Same', 'Siha'],
    'Lindi': ['Lindi', 'Kilwa', 'Liwale', 'Machinga', 'Nachingwea', 'Ruangwa'],
    'Manyara': ['Babati', 'Hanang', 'Kiteto', 'Mbulu', 'Simanjiro'],
    'Mara': ['Musoma', 'Bunda', 'Butiama', 'Rorya', 'Serengeti', 'Tarime'],
    'Mbeya': ['Mbeya', 'Chunya', 'Kyela', 'Rungwe', 'Mbarali'],
    'Morogoro': ['Morogoro', 'Gairo', 'Kilombero', 'Kilosa', 'Malinyi', 'Mvomero', 'Ulanga'],
    'Mtwara': ['Mtwara', 'Masasi', 'Nanyumbu', 'Newala', 'Tandahimba'],
    'Mwanza': ['Mwanza', 'Ilemela', 'Kwimba', 'Magu', 'Misungwi', 'Sengerema', 'Ukerewe'],
    'Njombe': ['Njombe', 'Ludewa', 'Makambako', 'Makete', 'Wanging\'ombe'],
    'Pemba North': ['Micheweni', 'Wete'],
    'Pemba South': ['Chake Chake', 'Mkoani'],
    'Pwani': ['Kibaha', 'Bagamoyo', 'Kibiti', 'Kisarawe', 'Mafia', 'Mkuranga', 'Rufiji'],
    'Rukwa': ['Sumbawanga', 'Kalambo', 'Nkasi'],
    'Ruvuma': ['Songea', 'Mbinga', 'Namtumbo', 'Nyasa', 'Tunduru'],
    'Shinyanga': ['Shinyanga', 'Kahama', 'Kishapu'],
    'Simiyu': ['Bariadi', 'Busega', 'Itilima', 'Maswa', 'Meatu'],
    'Singida': ['Singida', 'Iramba', 'Ikungi', 'Manyoni', 'Mkalama'],
    'Songwe': ['Vwawa', 'Ileje', 'Mbozi', 'Momba', 'Songwe'],
    'Tabora': ['Tabora', 'Igunga', 'Kaliua', 'Nzega', 'Sikonge', 'Urambo', 'Uyui'],
    'Tanga': ['Tanga', 'Handeni', 'Kilindi', 'Korogwe', 'Lushoto', 'Mkinga', 'Muheza', 'Pangani'],
    'Zanzibar Central/South': ['Kati', 'Kusini'],
    'Zanzibar North': ['Kaskazini A', 'Kaskazini B'],
    'Zanzibar Urban/West': ['Magharibi', 'Mjini']
}

def fetch_coords(query):
    url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
    headers = {'User-Agent': 'Uzaspea/1.0 (info@uzaspea.com)'}
    for attempt in range(3):
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code == 200:
                data = res.json()
                if data and len(data) > 0:
                    time.sleep(1)
                    return data[0]['lat'], data[0]['lon']
            elif res.status_code == 429:
                time.sleep(5) # Rate limited
        except Exception as e:
            if attempt == 2:
                print(f"Error fetching coords for {query}: {e}")
            time.sleep(2)
    time.sleep(1.5) # Be nice to Nominatim API
    return None, None

class Command(BaseCommand):
    help = 'Seeds the database with Tanzania regions, districts, and creates regional warehouses.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding regions and districts with OSM coordinates...")
        
        created_regions = 0
        created_districts = 0
        created_warehouses = 0
        
        for region_name, districts in TANZANIA_REGIONS.items():
            region, created = Region.objects.get_or_create(name=region_name)
            if created:
                created_regions += 1
                
            if region.latitude is None or region.longitude is None:
                lat, lon = fetch_coords(f"{region_name}, Tanzania")
                if lat and lon:
                    region.latitude = lat
                    region.longitude = lon
                    region.save()
            
            for district_name in districts:
                district, d_created = District.objects.get_or_create(name=district_name, region=region)
                if d_created:
                    created_districts += 1
                
                if district.latitude is None or district.longitude is None:
                    d_lat, d_lon = fetch_coords(f"{district_name}, {region_name}, Tanzania")
                    if d_lat and d_lon:
                        district.latitude = d_lat
                        district.longitude = d_lon
                        district.save()
            
            # Create a warehouse for the region
            warehouse_code = f"WH-{slugify(region.name).upper()}-01"
            warehouse, w_created = Warehouse.objects.get_or_create(
                region=region,
                defaults={
                    'name': f"{region.name} Warehouse",
                    'code': warehouse_code,
                    'address': f"Main Warehouse, {region.name}",
                    'is_active': True,
                    'latitude': region.latitude,
                    'longitude': region.longitude
                }
            )
            if w_created:
                created_warehouses += 1
            else:
                # Update existing warehouse
                warehouse.region = region
                if warehouse.latitude is None and region.latitude is not None:
                    warehouse.latitude = region.latitude
                    warehouse.longitude = region.longitude
                warehouse.save()

        self.stdout.write(self.style.SUCCESS(
            f'Successfully seeded {created_regions} regions, {created_districts} districts, and {created_warehouses} warehouses.'
        ))
