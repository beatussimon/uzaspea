from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0053_product_sale_price'),
    ]

    operations = [
        migrations.AlterField(
            model_name='lipanumber',
            name='purpose',
            field=models.CharField(
                choices=[
                    ('general', 'General'),
                    ('subscriptions', 'Subscriptions & Upgrades'),
                    ('commissions', 'Commission Payments'),
                    ('logistics', 'Logistics & Delivery Fees'),
                ],
                default='general',
                max_length=20,
            ),
        ),
    ]
