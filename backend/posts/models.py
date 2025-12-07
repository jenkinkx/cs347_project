from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
import secrets


class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)

    def __str__(self):
        return f"{self.user.username} Profile"


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)


@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    try:
        instance.profile.save()
    except Exception:
        pass


class Group(models.Model):
    name = models.CharField(max_length=200)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_groups")
    members = models.ManyToManyField(User, through="GroupMembership", related_name="joined_groups")
    color = models.CharField(max_length=16, default="#6b9bff")
    description = models.TextField(blank=True)
    is_public = models.BooleanField(default=True)
    cover = models.ImageField(upload_to="groups/covers/", null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


class GroupMembership(models.Model):
    ROLE_CHOICES = (
        ("member", "Member"),
        ("moderator", "Moderator"),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    group = models.ForeignKey(Group, on_delete=models.CASCADE)
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default="member")
    date_joined = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("user", "group")


class GroupInvite(models.Model):
    """Invite links to join a group via tokenized URL."""
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="invites")
    code = models.CharField(max_length=64, unique=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name="created_invites")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"Invite to {self.group.name} ({self.code})"

    @staticmethod
    def new_code() -> str:
        return secrets.token_urlsafe(16)

    def is_valid(self) -> bool:
        return not self.expires_at or self.expires_at >= timezone.now()


def upload_to_post(instance: "Post", filename: str) -> str:
    return f"posts/{instance.id or 'tmp'}/{filename}"


class Post(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="posts")
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    caption = models.TextField(blank=True)
    image = models.ImageField(upload_to=upload_to_post)
    date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def as_dict(self, request=None):
        url = self.image.url if self.image else None
        if request and url:
            url = request.build_absolute_uri(url)
        return {
            "id": self.id,
            "group_id": self.group_id,
            "user_name": self.author.username,
            "caption": self.caption,
            "image_url": url,
            "date": self.date.isoformat() if self.date else None,
        }


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="comments")
    user_name = models.CharField(max_length=120)
    text = models.TextField()
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="replies")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.user_name}: {self.text[:24]}"

    def as_dict(self):
        return {
            "id": self.id,
            "post_id": self.post_id,
            "user_id": self.author_id,
            "user_name": self.user_name,
            "text": self.text,
            "created_at": self.created_at.isoformat(),
        }


class AuditLog(models.Model):
    ACTION_CHOICES = (
        ("create", "Create"),
        ("update", "Update"),
        ("delete", "Delete"),
    )
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=12, choices=ACTION_CHOICES)
    model = models.CharField(max_length=50)
    object_id = models.CharField(max_length=64)
    details = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.created_at:%Y-%m-%d %H:%M} {self.user or 'system'} {self.action} {self.model}#{self.object_id}"


def _log_action(user: User | None, action: str, instance: models.Model):
    try:
        AuditLog.objects.create(
            user=user,
            action=action,
            model=instance.__class__.__name__,
            object_id=str(getattr(instance, 'pk', '?')),
            details=str(instance),
        )
    except Exception:
        pass


@receiver(post_save, sender=Post)
def log_post_save(sender, instance: Post, created: bool, **kwargs):
    _log_action(getattr(instance, '_actor', None), 'create' if created else 'update', instance)


@receiver(post_delete, sender=Post)
def log_post_delete(sender, instance: Post, **kwargs):
    _log_action(getattr(instance, '_actor', None), 'delete', instance)


@receiver(post_save, sender=Group)
def log_group_save(sender, instance: 'Group', created: bool, **kwargs):
    _log_action(getattr(instance, '_actor', None), 'create' if created else 'update', instance)


@receiver(post_delete, sender=Group)
def log_group_delete(sender, instance: 'Group', **kwargs):
    _log_action(getattr(instance, '_actor', None), 'delete', instance)
