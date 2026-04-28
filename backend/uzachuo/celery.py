
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')

app = Celery('uzachuo')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Periodic task schedule - runs check_expirations every 30 minutes
app.conf.beat_schedule = {
    'check-expirations-every-30-min': {
        'task': 'marketplace.tasks.check_expirations_periodic',
        'schedule': crontab(minute='*/30'),
    },
}

app.conf.timezone = 'UTC'
