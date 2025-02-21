# my_marketplace/marketplace/context_processors.py

def cart_contents(request):
    """Makes the cart contents available in all templates."""
    cart = request.session.get('cart', {})
    cart_items_count = sum(cart.values())  # Total number of items
    return {'cart': cart, 'cart_items_count': cart_items_count}