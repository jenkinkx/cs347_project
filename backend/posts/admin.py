from django.contrib import admin
from .models import Group, Post


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "color", "created_at")


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "user_name", "date", "created_at")
    list_filter = ("group", "date")

