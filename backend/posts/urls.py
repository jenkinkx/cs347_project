from django.urls import path
from . import views


urlpatterns = [
    # Groups
    path("groups/", views.groups_list_create, name="groups_list_create"),
    path("groups/<int:group_id>/", views.group_detail, name="group_detail"),
    path("groups/<int:group_id>/join/", views.join_group, name="join_group"),

    # Posts
    path("posts/", views.posts_list, name="posts_list"),
    path("posts/upload/", views.upload_post, name="upload_post"),
]
