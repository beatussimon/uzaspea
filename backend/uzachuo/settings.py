import os
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# FIX: S-01 — Never commit the real secret key
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'unsafe-dev-only-key-change-before-deploy')

# FIX: S-02 — Read from environment; default to False for dev safety
DEBUG = os.environ.get('DJANGO_DEBUG', 'False') == 'True'

# FIX: S-02 — Explicit allowed hosts
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# FIX MED-04: when behind a trusted reverse proxy (Traefik), Django can trust all hosts
# Traefik is the gatekeeper — it validates the Host header before requests reach Django
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

ALLOWED_HOSTS.append('testserver')


INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'channels',
    'marketplace',
    'staff',
    'crispy_forms',
    'crispy_bootstrap5',
    'django_extensions',
    'inspections',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 16,
    # FIX D-07: rate limiting
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/hour',
        'user': '1000/hour',
        'register': '5/hour',
        'login': '10/hour',
        'ticket': '5/hour',
        'verify_superuser': '30/minute',
    },
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=2),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'UPDATE_LAST_LOGIN': True,
}

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Add Whitenoise *here*
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'uzachuo.urls' # Replace with your project.

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # Correct way to specify template dirs
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'marketplace.context_processors.cart_contents',
            ],
        },
    },
]

WSGI_APPLICATION = 'uzachuo.wsgi.application'
ASGI_APPLICATION = 'uzachuo.asgi.application'

# FIX: S-04 — Never allow all origins with credentials in production
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://localhost:3000'
).split(',')
CORS_ALLOW_CREDENTIALS = True

# FIX DEVOPS-03: Redis URL from environment, not hardcoded IP
REDIS_URL = os.environ.get('REDIS_URL', 'redis://127.0.0.1:6379/0')

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    },
}

# Also configure Celery to use same Redis
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL

# FIX DEVOPS-02: use Postgres in production, sqlite only as dev fallback
import dj_database_url

DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# FIX: S-03 — Enforce password strength
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'  # Correct URL prefix
STATICFILES_DIRS = [
    BASE_DIR / "static",  # Project-level static files
]
STATIC_ROOT = BASE_DIR / "staticfiles"  # For production (collectstatic)

# FIX D-05: WhiteNoise compressed + hashed static files for production
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}


# Media files (user uploads)
MEDIA_URL = '/media/'  # URL prefix for media files.  MUST start and end with a slash.
MEDIA_ROOT = BASE_DIR / 'media'  # Absolute path to the media directory

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Crispy Forms settings
CRISPY_ALLOWED_TEMPLATE_PACKS = "bootstrap5"
CRISPY_TEMPLATE_PACK = "bootstrap5"

# Login/Logout redirects
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/'

# FIX: S-14 — Use console backend as safe default; override via env in production
EMAIL_BACKEND = os.environ.get(
    'DJANGO_EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '1025'))
EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'False') == 'True'
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@kiboss.co.tz')

# Session settings
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False') == 'True'
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

CSRF_COOKIE_SECURE = os.environ.get('CSRF_COOKIE_SECURE', 'False') == 'True'
CSRF_TRUSTED_ORIGINS = os.environ.get(
    'CSRF_TRUSTED_ORIGINS', 
    'http://localhost:8000,http://127.0.0.1:8000,http://localhost,http://3.6.193.212'
).split(',')
if os.environ.get('DOMAIN'):
    _dom = os.environ.get('DOMAIN')
    CSRF_TRUSTED_ORIGINS.append(f"http://{_dom}")
    CSRF_TRUSTED_ORIGINS.append(f"https://{_dom}")

# FIX DEVOPS-15: production security headers
if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True      # no MIME sniffing
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
    # HTTPS-only settings — enable when domain + SSL is ready
    # Set FORCE_HTTPS=True in .env when you have a domain with Let's Encrypt
    if os.environ.get('FORCE_HTTPS', 'False') == 'True':
        SECURE_HSTS_SECONDS = 31536000          # 1 year HSTS
        SECURE_HSTS_INCLUDE_SUBDOMAINS = True
        SECURE_HSTS_PRELOAD = True
        SECURE_SSL_REDIRECT = True              # force HTTPS
        CSRF_COOKIE_SECURE = True
        SESSION_COOKIE_SECURE = True
    else:
        # Fix COOP error over HTTP for admin login
        SECURE_CROSS_ORIGIN_OPENER_POLICY = None
    SECURE_CROSS_ORIGIN_OPENER_POLICY = None
