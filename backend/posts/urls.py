from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegisterView, GroupViewSet, PostViewSet, ProfileViewSet, upload_post

router = DefaultRouter()
router.register(r'groups', GroupViewSet)
router.register(r'posts', PostViewSet)
router.register(r'profile', ProfileViewSet, basename='profile')

urlpatterns = [
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('posts/upload/', upload_post, name='post_upload'),
    path('', include(router.urls)),
]
