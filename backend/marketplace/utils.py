from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings

def send_order_confirmation_email(order):
    """Sends an order confirmation email to the user."""
    subject = f'Order Confirmation #{order.id}'
    message = render_to_string('marketplace/order_confirmation_email.txt', {'order': order})
    html_message = render_to_string('marketplace/order_confirmation_email.html', {'order': order})  # HTML version

    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,  # Use a configured sender
        [order.user.email],  # Send to the user's email
        fail_silently=False,  # Raise exceptions for debugging
        html_message=html_message # Send HTML Email
    )