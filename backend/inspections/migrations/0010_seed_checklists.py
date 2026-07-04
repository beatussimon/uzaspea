from django.db import migrations
from django.core.management import call_command

def seed_data(apps, schema_editor):
    call_command('seed_inspections')

class Migration(migrations.Migration):

    dependencies = [
        ('inspections', '0009_checklistitem_section_checklistitem_severity_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_data),
    ]
