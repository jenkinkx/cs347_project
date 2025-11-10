from django.urls import path
from . import views


urlpatterns = [
    # Groups
    path("groups/", views.groups_list_create, name="groups_list_create"),
    path("groups/<int:group_id>/", views.group_detail, name="group_detail"),

    # Posts
    path("posts/", views.posts_list, name="posts_list"),
    path("posts/upload/", views.upload_post, name="upload_post"),
    
    # Amazon s3
    path("upload-url/", views.start_photo_upload, name="start_photo_upload"),
    path("confirm-upload/", views.create_post_from_s3, name="confirm_upload"),
]
