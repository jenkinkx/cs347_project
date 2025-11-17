from django.contrib import admin
from .models import Group, Post, GroupMembership


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "color", "is_private", "creator", "created_at")
    list_filter = ("is_private",)


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "user_name", "date", "created_at")
    list_filter = ("group", "date")


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "user", "is_admin", "created_at")
    list_filter = ("is_admin", "group")
