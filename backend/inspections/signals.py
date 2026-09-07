import json
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from marketplace.models import Product, ProductVariant, ProductImage
from .models import ProductInspectionEvent, InspectionRequest


@receiver(pre_save, sender=Product)
def product_pre_save_audit(sender, instance, **kwargs):
    """Capture previous state of product before save for change detection."""
    if instance.pk:
        try:
            instance._old_audit_state = Product.objects.filter(pk=instance.pk).values(
                'stock', 'price', 'sale_price', 'name', 'condition',
                'description', 'category_id', 'specifications', 'structured_specs'
            ).first()
        except Exception:
            instance._old_audit_state = None
    else:
        instance._old_audit_state = None


@receiver(post_save, sender=Product)
def product_post_save_audit(sender, instance, created, **kwargs):
    """Detect and log post-inspection changes or restocking."""
    if created:
        return
    old = getattr(instance, '_old_audit_state', None)
    if not old:
        return

    # Only audit if product has a published inspection
    latest_inspection = instance.inspections.filter(status='published').order_by('-created_at').first()
    if not latest_inspection:
        return

    # 1. Stock Restock check:
    # Only increments are restocks (sales decrements are normal depletion)
    old_stock = float(old.get('stock') or 0)
    new_stock = float(instance.stock or 0)
    if new_stock > old_stock:
        diff = int(new_stock - old_stock) if (new_stock - old_stock).is_integer() else round(new_stock - old_stock, 2)
        ProductInspectionEvent.objects.create(
            product=instance,
            inspection=latest_inspection,
            event_type='restock',
            title=f'Restocked (+{diff} units)',
            description=f'Stock increased from {int(old_stock)} to {int(new_stock)} units.',
            metadata={'old_stock': old_stock, 'new_stock': new_stock, 'diff': diff}
        )

    # 2. Price Change check:
    old_price = old.get('price')
    new_price = instance.price
    if old_price is not None and new_price is not None and float(old_price) != float(new_price):
        ProductInspectionEvent.objects.create(
            product=instance,
            inspection=latest_inspection,
            event_type='price_change',
            title='Price Changed',
            description=f'Price updated from TSh {int(float(old_price)):,} to TSh {int(float(new_price)):,}.',
            metadata={'old_price': str(old_price), 'new_price': str(new_price)}
        )

    # 3. Condition Change check:
    old_condition = (old.get('condition') or '').strip()
    new_condition = (instance.condition or '').strip()
    if old_condition and new_condition and old_condition.lower() != new_condition.lower():
        ProductInspectionEvent.objects.create(
            product=instance,
            inspection=latest_inspection,
            event_type='condition_change',
            title='Condition Changed',
            description=f'Condition changed from "{old_condition}" to "{new_condition}".',
            metadata={'old_condition': old_condition, 'new_condition': new_condition}
        )

    # 4. Title Change check:
    old_name = (old.get('name') or '').strip()
    new_name = (instance.name or '').strip()
    if old_name and new_name and old_name != new_name:
        ProductInspectionEvent.objects.create(
            product=instance,
            inspection=latest_inspection,
            event_type='detail_change',
            title='Title Changed',
            description=f'Product title changed from "{old_name}" to "{new_name}".',
            metadata={'old_name': old_name, 'new_name': new_name}
        )

    # 5. Specifications / Structured Specs Change check:
    try:
        old_specs = json.dumps(old.get('specifications') or {}, sort_keys=True)
        new_specs = json.dumps(instance.specifications or {}, sort_keys=True)
        old_s_specs = json.dumps(old.get('structured_specs') or {}, sort_keys=True)
        new_s_specs = json.dumps(instance.structured_specs or {}, sort_keys=True)
        if old_specs != new_specs or old_s_specs != new_s_specs:
            ProductInspectionEvent.objects.create(
                product=instance,
                inspection=latest_inspection,
                event_type='detail_change',
                title='Specifications Updated',
                description='Technical specifications were modified.',
                metadata={'specs_updated': True}
            )
    except Exception:
        pass


@receiver(pre_save, sender=ProductVariant)
def product_variant_pre_save_audit(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._old_variant_state = ProductVariant.objects.filter(pk=instance.pk).values(
                'stock', 'price_adjustment', 'name'
            ).first()
        except Exception:
            instance._old_variant_state = None
    else:
        instance._old_variant_state = None


@receiver(post_save, sender=ProductVariant)
def product_variant_post_save_audit(sender, instance, created, **kwargs):
    product = instance.product
    if not product:
        return
    latest_inspection = product.inspections.filter(status='published').order_by('-created_at').first()
    if not latest_inspection:
        return

    if created:
        ProductInspectionEvent.objects.create(
            product=product,
            inspection=latest_inspection,
            event_type='variant_change',
            title=f'Variant Added: "{instance.name}"',
            description=f'New variant "{instance.name}" added with initial stock of {instance.stock} units.',
            metadata={'variant_name': instance.name, 'stock': instance.stock}
        )
        return

    old = getattr(instance, '_old_variant_state', None)
    if not old:
        return

    old_stock = float(old.get('stock') or 0)
    new_stock = float(instance.stock or 0)
    if new_stock > old_stock:
        diff = int(new_stock - old_stock) if (new_stock - old_stock).is_integer() else round(new_stock - old_stock, 2)
        ProductInspectionEvent.objects.create(
            product=product,
            inspection=latest_inspection,
            event_type='restock',
            title=f'Restocked Variant "{instance.name}" (+{diff} units)',
            description=f'Variant "{instance.name}" stock increased from {int(old_stock)} to {int(new_stock)} units.',
            metadata={'variant_name': instance.name, 'old_stock': old_stock, 'new_stock': new_stock, 'diff': diff}
        )

    old_adj = float(old.get('price_adjustment') or 0)
    new_adj = float(instance.price_adjustment or 0)
    if old_adj != new_adj:
        ProductInspectionEvent.objects.create(
            product=product,
            inspection=latest_inspection,
            event_type='variant_change',
            title=f'Variant Price Adjusted: "{instance.name}"',
            description=f'Variant "{instance.name}" price adjustment changed from TSh {int(old_adj):,} to TSh {int(new_adj):,}.',
            metadata={'variant_name': instance.name, 'old_adjustment': old_adj, 'new_adjustment': new_adj}
        )


@receiver(post_save, sender=ProductImage)
def product_image_post_save_audit(sender, instance, created, **kwargs):
    if not created:
        return
    product = instance.product
    if not product:
        return
    latest_inspection = product.inspections.filter(status='published').order_by('-created_at').first()
    if not latest_inspection:
        return
    ProductInspectionEvent.objects.create(
        product=product,
        inspection=latest_inspection,
        event_type='image_change',
        title='Product Photos Updated',
        description='New photo added to listing after inspection.',
        metadata={'image_id': instance.id}
    )


@receiver(post_delete, sender=ProductImage)
def product_image_post_delete_audit(sender, instance, **kwargs):
    product = instance.product
    if not product:
        return
    latest_inspection = product.inspections.filter(status='published').order_by('-created_at').first()
    if not latest_inspection:
        return
    ProductInspectionEvent.objects.create(
        product=product,
        inspection=latest_inspection,
        event_type='image_change',
        title='Product Photos Updated',
        description='A photo was removed from the listing after inspection.',
        metadata={'image_id': instance.id}
    )
