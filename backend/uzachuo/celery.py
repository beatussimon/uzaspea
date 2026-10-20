
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'uzachuo.settings')

app = Celery('uzachuo')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Periodic task schedule - runs check_expirations every 5 minutes
app.conf.beat_schedule = {
    'check-expirations-every-5-min': {
        'task': 'marketplace.tasks.check_expirations_periodic',
        'schedule': crontab(minute='*/5'),
    },
    'check-saved-searches-hourly': {  # FIX B-13
        'task': 'marketplace.tasks.check_saved_searches',
        'schedule': crontab(minute=0),
    },
    'check-price-alerts-every-15-min': {  # FIX B-13
        'task': 'marketplace.tasks.check_price_alerts',
        'schedule': crontab(minute='*/15'),
    },
    'generate-monthly-invoices-first-of-month': {
        'task': 'billing.tasks.generate_monthly_invoices',
        'schedule': crontab(day_of_month=1, hour=0, minute=0),
    },
    # Recommendations v3 (times are UTC; EAT = UTC+3)
    'recs-refresh-product-stats-hourly': {
        'task': 'marketplace.tasks.refresh_product_stats_task',
        'schedule': crontab(minute=7),
    },
    'recs-build-product-recs-nightly': {
        'task': 'marketplace.tasks.build_product_recs_task',
        'schedule': crontab(hour=23, minute=15),
    },
    'recs-prune-weekly': {
        'task': 'marketplace.tasks.prune_rec_data_task',
        'schedule': crontab(day_of_week=0, hour=0, minute=30),
    },
}

app.conf.timezone = 'UTC'
