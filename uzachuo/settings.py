import os
from pathlib import Path
#from dotenv import load_dotenv  # Only needed if using a .env file

# Load environment variables from .env file
#load_dotenv() # Comment this out if not using a .env file

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
#SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', 'your-fallback-secret-key') # Use environment variable
SECRET_KEY = 'put-a-real-secret-key-here-for-development'  # CHANGE THIS

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True  # MUST be False in production!

ALLOWED_HOSTS = ['*']  # VERY IMPORTANT: change to allowed hosts in production.


INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.humanize',  # For intcomma
    'marketplace',  # Your app
    'crispy_forms',
    'crispy_bootstrap5',
]

MIDDLEWARE = [
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

WSGI_APPLICATION = 'uzachuo.wsgi.application'# Replace with your project


# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
        'OPTIONS': {  # Add this for better SQLite concurrency in dev.
            'timeout': 20,
        },
    }
}

AUTH_PASSWORD_VALIDATORS = []

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

# Email configuration (using MailHog for development):
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'  # Use SMTP backend
EMAIL_HOST = 'localhost'  # MailHog runs on localhost
EMAIL_PORT = 1025          # MailHog's SMTP port
EMAIL_HOST_USER = ''       # No username needed for MailHog
EMAIL_HOST_PASSWORD = ''   # No password needed for MailHog
EMAIL_USE_TLS = False      # No TLS for MailHog
DEFAULT_FROM_EMAIL = 'test@example.com'  # Set a default from email

# Session settings
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = False  # Set to True in production (requires HTTPS)
SESSION_EXPIRE_AT_BROWSER_CLOSE = True