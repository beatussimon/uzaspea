from django.core.management.base import BaseCommand
from inspections.models import InspectionCategory, ChecklistTemplate, ChecklistItem

class Command(BaseCommand):
    help = 'Seeds initial inspection categories and checklist templates'

    def handle(self, *args, **options):
        # 1. Domains
        vehicles, _ = InspectionCategory.objects.get_or_create(name='Vehicles', defaults={'level': 'domain', 'base_price': 0})
        electronics, _ = InspectionCategory.objects.get_or_create(name='Electronics', defaults={'level': 'domain', 'base_price': 0})
        property_domain, _ = InspectionCategory.objects.get_or_create(name='Property', defaults={'level': 'domain', 'base_price': 0})

        # 2. Categories
        cars, _ = InspectionCategory.objects.get_or_create(name='Cars', parent=vehicles, defaults={'level': 'category', 'base_price': 50000})
        phones, _ = InspectionCategory.objects.get_or_create(name='Phones', parent=electronics, defaults={'level': 'category', 'base_price': 20000})
        residential, _ = InspectionCategory.objects.get_or_create(
            name='Residential', 
            parent=property_domain, 
            defaults={'level': 'category', 'base_price': 100000, 'required_inspector_level': 'senior'}
        )

        # 3. Subcategories
        InspectionCategory.objects.get_or_create(name='Sedans', parent=cars, defaults={'level': 'subcategory', 'base_price': 50000})

        # 4. Checklist Templates
        def create_template(category, items):
            template, created = ChecklistTemplate.objects.get_or_create(
                category=category,
                version=1,
                defaults={'is_active': True}
            )
            if template:
                for label, ctype in items:
                    ChecklistItem.objects.get_or_create(
                        template=template,
                        label=label,
                        defaults={'item_type': ctype, 'is_mandatory': True}
                    )

        # Vehicle Checklist
        create_template(cars, [
            ('Engine Sound & Smoothness', 'pass_fail'),
            ('Exterior Body & Paint Condition', 'scale'),
            ('Tire Tread Depth & Wear', 'scale'),
            ('Interior Electronics & AC', 'pass_fail'),
            ('Chassis & Suspension Check', 'pass_fail'),
        ])

        # Electronics Checklist
        create_template(phones, [
            ('Screen & Touch Sensitivity', 'pass_fail'),
            ('Battery Health (%)', 'text'),
            ('Camera Quality (Front/Back)', 'scale'),
            ('Network & Wi-Fi Connectivity', 'pass_fail'),
        ])

        # Property Checklist
        create_template(residential, [
            ('Structural Integrity Check', 'pass_fail'),
            ('Electrical Point Testing', 'pass_fail'),
            ('Plumbing & Water Leakage', 'pass_fail'),
            ('Security & Locks', 'pass_fail'),
        ])

        self.stdout.write(self.style.SUCCESS('Successfully seeded inspection categories and checklist templates'))
