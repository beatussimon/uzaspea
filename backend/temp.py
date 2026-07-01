from marketplace.models import PaymentConfirmation
for p in PaymentConfirmation.objects.all()[:5]:
    print(p.id, p.status)
