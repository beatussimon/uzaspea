def is_vehicle_category(category):
    """
    Checks if a category corresponds to a whole vehicle.
    Specifically excludes 'spare-parts' and other non-vehicle subcategories 
    by restricting the match to known vehicle domain slugs.
    """
    if not category:
        return False
    if category.slug.lower() in ['cars-suvs', 'motorcycles', 'trucks']:
        return True
    if category.parent:
        return is_vehicle_category(category.parent)
    return False


def order_has_vehicles(order):
    """
    Checks if any item in the order is a whole vehicle category.
    """
    for item in order.orderitem_set.select_related('product__category').all():
        if is_vehicle_category(item.product.category):
            return True
    return False
