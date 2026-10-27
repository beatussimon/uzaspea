_VEHICLE_CATEGORY_SLUGS = {'cars-suvs', 'motorcycles', 'trucks'}

def is_vehicle_category(category):
    """
    Checks if a category corresponds to a whole vehicle.
    Specifically excludes 'spare-parts' and other non-vehicle subcategories 
    by restricting the match to known vehicle domain slugs.
    """
    curr = category
    while curr:
        if curr.slug and curr.slug.lower() in _VEHICLE_CATEGORY_SLUGS:
            return True
        if getattr(curr, 'parent_id', None) is None:
            break
        curr = curr.parent
    return False


def order_has_vehicles(order):
    """
    Checks if any item in the order is a whole vehicle category.
    """
    items = getattr(order, 'relevant_items', None)
    if items is None:
        items = list(order.orderitem_set.all())
    for item in items:
        if getattr(item, 'product', None) and is_vehicle_category(item.product.category):
            return True
    return False
