from django.urls import path
from django.contrib.auth import views as auth_views
from . import views


urlpatterns = [
    path("", views.home, name="home"),
    path("groups/", views.GroupListView.as_view(), name="group_list"),
    path("groups/create/", views.GroupCreateView.as_view(), name="group_create"),
    path("groups/<int:pk>/", views.GroupDetailView.as_view(), name="group_detail"),
    path("groups/<int:pk>/edit/", views.GroupUpdateView.as_view(), name="group_edit"),
    path("groups/<int:pk>/delete/", views.GroupDeleteView.as_view(), name="group_delete"),
    path("groups/<int:pk>/invite/", views.group_invite, name="group_invite"),
    path("join/<str:code>/", views.join_group, name="join_group"),
    path("groups/<int:pk>/members/", views.manage_members, name="manage_members"),

    path("posts/", views.PostListView.as_view(), name="post_list"),
    path("posts/create/", views.PostCreateView.as_view(), name="post_create"),
    path("posts/<int:pk>/", views.PostDetailView.as_view(), name="post_detail"),
    path("posts/<int:pk>/edit/", views.PostUpdateView.as_view(), name="post_edit"),
    path("posts/<int:pk>/delete/", views.PostDeleteView.as_view(), name="post_delete"),
    path("posts/bulk/", views.post_bulk_action, name="post_bulk"),
    path("posts/export/csv/", views.export_posts_csv, name="export_posts_csv"),
    path("posts/import/csv/", views.import_posts_csv, name="import_posts_csv"),

    path("profile/", views.profile_view, name="profile"),
    path("reports/", views.reports, name="reports"),
    path("help/", views.help_page, name="help"),

    # Auth (Django session auth)
    path("accounts/login/", auth_views.LoginView.as_view(template_name="web/login.html"), name="login"),
    path("accounts/logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("accounts/register/", views.register, name="register"),
]
