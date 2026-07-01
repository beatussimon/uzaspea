from marketplace.models import Order
o = Order.objects.get(id=48)
o.status = 'AWAITING_DELIVERY_PAYMENT'
o.save()
print("Order 48 updated successfully")
