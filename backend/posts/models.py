from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Group(models.Model):
    name = models.CharField(max_length=200, db_index=True) #added db_index for searches
    color = models.CharField(max_length=16, default="#6b9bff")
    description = models.TextField(blank=True)
    is_private = models.BooleanField(default=False)
    creator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_groups",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name


def upload_to_post(instance: "Post", filename: str) -> str:
    return f"posts/{instance.id or 'tmp'}/{filename}"


class Post(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="posts")
    user_name = models.CharField(max_length=120)
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
            "user_name": self.user_name,
            "caption": self.caption,
            "image_url": url,
            "date": self.date.isoformat() if self.date else None,
        }


class GroupMembership(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="group_memberships")
    is_admin = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("group", "user")

    def __str__(self) -> str:
        return f"{self.user} @ {self.group}"
