from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from . import frontend as fe


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("posts.urls")),
    path("api/auth/", include("config.auth_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Catch-all for the SPA frontend: anything not matched above goes to Angular index
urlpatterns += [
    re_path(r"^(?P<path>.*)$", fe.spa, name="spa"),
]
