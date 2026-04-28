
from celery import shared_task
from django.core.management import call_command
from django.utils import timezone


@shared_task
def check_expirations_periodic():
    """
    Periodic task that runs the check_expirations management command.
    Scheduled every 30 minutes via Celery Beat.
    """
    call_command('check_expirations')
    return f'Expiry check completed at {timezone.now()}'
