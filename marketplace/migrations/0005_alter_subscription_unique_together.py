# Generated by Django 5.1.2 on 2025-02-21 19:30

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0004_sidebarnewsitem_sidebaroffer_subscription'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='subscription',
            unique_together={('email', 'category')},
        ),
    ]
