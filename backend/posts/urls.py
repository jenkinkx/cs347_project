from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    RegisterView,
    GroupViewSet,
    PostViewSet,
    ProfileViewSet,
    upload_post,
    group_detail,
    start_photo_upload,
    create_post_from_s3,
)

router = DefaultRouter()
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"posts", PostViewSet, basename="post")
router.register(r"profile", ProfileViewSet, basename="profile")

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth_register"),

    # Function-based endpoints
    path("groups/<int:group_id>/", group_detail, name="group_detail"),
    path("posts/upload/", upload_post, name="upload_post"),
    path("api/upload-url/", start_photo_upload),
    path("api/confirm-upload/", create_post_from_s3, name="confirm_upload"),

    # ViewSet routes
    path("", include(router.urls)),
]