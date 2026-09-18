from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0097_alter_order_options_alter_payment_options_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='product',
            index=models.Index(
                fields=['is_available', 'is_draft', 'stock', 'category', '-created_at'],
                name='mkt_prod_avail_cat_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='product',
            index=models.Index(
                fields=['is_available', 'is_draft', 'stock', 'brand', '-created_at'],
                name='mkt_prod_avail_brd_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='productvehiclefitment',
            index=models.Index(
                fields=['vehicle', 'product'],
                name='mkt_fitment_veh_prod_idx'
            ),
        ),
    ]
