from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from . import frontend as fe


urlpatterns = [
    path("admin/", admin.site.urls),
    # Server-rendered pages (Basic CRUD, auth, etc.)
    path("", include("web.urls")),
    # API endpoints for SPA and others
    path("api/", include("posts.urls")),
    path("api/auth/", include("config.auth_urls")),
    # Mount SPA under /app/ (index and static assets)
    path("app/", fe.spa, name="spa_root"),
    re_path(r"^app/(?P<path>.*)$", fe.spa, name="spa_assets"),
]

# Serve uploaded media (development and demo deployment)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Custom error handlers
handler404 = "web.views.custom_404"
