from django.db import models


class Group(models.Model):
    name = models.CharField(max_length=200)
    color = models.CharField(max_length=16, default="#6b9bff")
    description = models.TextField(blank=True)
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

