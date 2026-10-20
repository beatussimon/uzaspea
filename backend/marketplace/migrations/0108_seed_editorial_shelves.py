from django.db import migrations

# (key, title, subtitle, category slug, fallback name keywords, audience, base_order)
SHELVES = [
    ('womens-fashion', 'Look Different', 'Trendy styles, dresses, shoes & beauty picks', 'womens-fashion', ["Women's Fashion", 'Women'], 'female', 10),
    ('mens-fashion', 'Look Different', 'Sharp looks, shoes & style essentials for men', 'mens-fashion', ["Men's Fashion", 'Men Fashion'], 'male', 10),
    ('for-your-car', 'For Your Car', 'Spare parts, accessories & vehicles', 'vehicles', ['Vehicles', 'Vehicle Parts', 'Cars'], 'all', 20),
    ('phone-deals', 'Deals in Phones', 'Smartphones, accessories & gadgets', 'electronics-mobile-phones', ['Mobile Phones', 'Phones', 'Electronics'], 'all', 30),
    ('home-living', 'Home & Living', 'Furniture, kitchen & home appliances', 'home-garden-furniture', ['Home', 'Furniture', 'Appliances'], 'all', 40),
]


def seed(apps, schema_editor):
    Category = apps.get_model('marketplace', 'Category')
    EditorialShelf = apps.get_model('marketplace', 'EditorialShelf')
    for key, title, subtitle, slug, keywords, audience, order in SHELVES:
        category = Category.objects.filter(slug=slug).first()
        if category is None:
            for kw in keywords:
                category = Category.objects.filter(name__icontains=kw).order_by('id').first()
                if category is not None:
                    break
        if category is None:
            continue
        EditorialShelf.objects.update_or_create(
            key=key,
            defaults={'title': title, 'subtitle': subtitle, 'category': category,
                      'audience': audience, 'base_order': order, 'is_active': True},
        )


def unseed(apps, schema_editor):
    apps.get_model('marketplace', 'EditorialShelf').objects.filter(key__in=[s[0] for s in SHELVES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0107_recommendations_v3'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
