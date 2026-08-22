import csv
from django.core.management.base import BaseCommand
from marketplace.models import VehicleMake, VehicleModel, Vehicle

class Command(BaseCommand):
    help = 'Bulk import extensive vehicle taxonomy from a CSV file'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')

    def handle(self, *args, **kwargs):
        csv_file = kwargs['csv_file']
        
        try:
            with open(csv_file, mode='r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                count = 0
                
                for row in reader:
                    make_name = row.get('make', '').strip()
                    model_name = row.get('model', '').strip()
                    year_val = row.get('year', '').strip()
                    trim = row.get('trim', '').strip()
                    engine = row.get('engine', '').strip()
                    drivetrain = row.get('drivetrain', '').strip()
                    transmission = row.get('transmission', '').strip()
                    body_style = row.get('body_style', '').strip()
                    region = row.get('region', 'US').strip()

                    if not all([make_name, model_name, year_val]):
                        self.stdout.write(self.style.WARNING(f'Skipping invalid row: {row}'))
                        continue
                        
                    make, _ = VehicleMake.objects.get_or_create(name=make_name)
                    model, _ = VehicleModel.objects.get_or_create(make=make, name=model_name)
                    
                    Vehicle.objects.get_or_create(
                        make=make,
                        model=model,
                        year=int(year_val),
                        trim=trim,
                        engine=engine,
                        drivetrain=drivetrain,
                        transmission=transmission,
                        body_style=body_style,
                        region=region
                    )
                    count += 1
                    
                    if count % 1000 == 0:
                        self.stdout.write(self.style.SUCCESS(f'Processed {count} vehicles...'))
                        
                self.stdout.write(self.style.SUCCESS(f'Successfully imported {count} vehicle records.'))
                
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error importing vehicles: {str(e)}'))
