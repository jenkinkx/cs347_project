from pathlib import Path
import os
import dj_database_url


BASE_DIR = Path(__file__).resolve().parent.parent


# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-secret-key-change-me")

ENVIRONMENT = os.getenv("DJANGO_ENV", "development")
# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = ENVIRONMENT != "production" if os.getenv("DEBUG") is None else os.getenv("DEBUG") == "1"

ALLOWED_HOSTS = [h for h in os.getenv("ALLOWED_HOSTS", "*").split(",") if h]
CSRF_TRUSTED_ORIGINS = [o for o in os.getenv("CSRF_TRUSTED_ORIGINS", "https://*.ondigitalocean.app,https://*.ondigitalocean.app:443").split(",") if o]


# Application definition
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "storages",
    "rest_framework",
    "rest_framework_simplejwt",
    "web",
    "posts",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "web.middleware.RequestTimingMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"


# Database
# https://docs.djangoproject.com/en/stable/ref/settings/#databases
ENVIRONMENT = os.getenv("DJANGO_ENV", "production")
DATABASE_URL = os.getenv("DATABASE_URL", "")

if ENVIRONMENT == "production" and DATABASE_URL:
    # Use Postgres (or whatever DATABASE_URL points to)
    DATABASES = {
        "default": dj_database_url.config(default=DATABASE_URL, conn_max_age=600)
    }
else:
    # Safe fallback: always a real ENGINE
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True


STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS: list[str] = []
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Media (uploaded images) — default local, override to Spaces in production
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# DigitalOcean Spaces / S3 configuration (optional)
SPACES_BUCKET = os.getenv("SPACES_BUCKET")
SPACES_REGION = os.getenv("SPACES_REGION")
SPACES_ENDPOINT = os.getenv("SPACES_ENDPOINT")  # e.g., https://nyc3.digitaloceanspaces.com
SPACES_CUSTOM_DOMAIN = os.getenv("SPACES_CUSTOM_DOMAIN")  # e.g., mybucket.nyc3.digitaloceanspaces.com
if SPACES_BUCKET and (SPACES_ENDPOINT or SPACES_REGION):
    DEFAULT_FILE_STORAGE = "storages.backends.s3boto3.S3Boto3Storage"
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = SPACES_BUCKET
    if not SPACES_ENDPOINT and SPACES_REGION:
        SPACES_ENDPOINT = f"https://{SPACES_REGION}.digitaloceanspaces.com"
    AWS_S3_ENDPOINT_URL = SPACES_ENDPOINT
    AWS_S3_REGION_NAME = SPACES_REGION
    AWS_S3_SIGNATURE_VERSION = "s3v4"
    AWS_QUERYSTRING_AUTH = False
    # Public read for demo; lock down with signed URLs in production if needed
    AWS_S3_OBJECT_PARAMETERS = {"CacheControl": "max-age=86400"}
    _domain = SPACES_CUSTOM_DOMAIN or (f"{SPACES_BUCKET}.{SPACES_REGION}.digitaloceanspaces.com" if SPACES_REGION else None)
    if _domain:
        MEDIA_URL = f"https://{_domain}/"


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS (dev only)
CORS_ALLOW_ALL_ORIGINS = True

# Auth redirects (server-rendered pages)
LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

# Basic logging (console) for development
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        }
    },
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "INFO"},
        "web.middleware": {"handlers": ["console"], "level": "INFO"},
    },
}
