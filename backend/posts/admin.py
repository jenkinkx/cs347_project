from django.contrib import admin
from .models import Group, Post, GroupMembership, Profile, AuditLog, GroupInvite, Comment


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "owner", "color", "created_at")


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "author", "date", "created_at")
    list_filter = ("group", "date")


@admin.register(GroupMembership)
class GroupMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "group", "role", "date_joined")
    list_filter = ("group", "role")


@admin.register(GroupInvite)
class GroupInviteAdmin(admin.ModelAdmin):
    list_display = ("group", "code", "created_by", "expires_at", "created_at")
    search_fields = ("code",)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "bio")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "user", "action", "model", "object_id")
    list_filter = ("action", "model")
    search_fields = ("object_id", "details")


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("id", "post", "user_name", "parent", "created_at")
    list_filter = ("created_at",)
    search_fields = ("text", "user_name")
