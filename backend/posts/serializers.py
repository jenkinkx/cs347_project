from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Group, Post, Profile, Comment

class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Profile
        fields = ('username', 'bio')

class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('username', 'password', 'first_name', 'last_name')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        return user

class GroupSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source='owner.username')
    member_usernames = serializers.SerializerMethodField(read_only=True)
    post_count = serializers.SerializerMethodField(read_only=True)
    member_details = serializers.SerializerMethodField(read_only=True)
    cover_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Group
        fields = (
            'id',
            'name',
            'owner',
            'members',
            'color',
            'description',
            'is_public',
            'cover',
            'cover_url',
            'start_date',
            'end_date',
            'member_usernames',
            'member_details',
            'post_count',
        )

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError("End date cannot be before start date.")
        return attrs

    def get_member_usernames(self, obj):
        try:
            return list(obj.members.values_list('username', flat=True)[:12])
        except Exception:
            return []

    def get_member_details(self, obj):
        try:
            users = obj.members.values('id', 'username', 'first_name', 'last_name')[:50]
            details = []
            for u in users:
                full_name = f"{u['first_name']} {u['last_name']}".strip()
                details.append({
                    "id": u["id"],
                    "name": full_name or u["username"],
                    "username": u["username"],
                })
            return details
        except Exception:
            return []

    def get_cover_url(self, obj):
        try:
            request = self.context.get('request')
        except Exception:
            request = None
        url = obj.cover.url if getattr(obj, 'cover', None) else None
        if request and url:
            return request.build_absolute_uri(url)
        return url

    def get_post_count(self, obj):
        try:
            return obj.posts.count()
        except Exception:
            return 0


class PostSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source='author.username')
    author_id = serializers.ReadOnlyField(source='author.id')
    user_name = serializers.ReadOnlyField(source='author.username')
    image_url = serializers.SerializerMethodField(read_only=True)
    comment_count = serializers.SerializerMethodField(read_only=True)
    comments = serializers.SerializerMethodField(read_only=True)

    def get_image_url(self, obj):
        try:
            request = self.context.get('request')
        except Exception:
            request = None
        url = obj.image.url if getattr(obj, 'image', None) else None
        if request and url:
            return request.build_absolute_uri(url)
        return url

    class Meta:
        model = Post
        fields = ('id', 'group', 'author', 'author_id', 'user_name', 'caption', 'image', 'image_url', 'date', 'comment_count', 'comments')

    def get_comment_count(self, obj):
        try:
            return obj.comments.count()
        except Exception:
            return 0

    def get_comments(self, obj):
        qs = obj.comments.select_related("author").all().order_by("-created_at")[:20]
        # Return as flat list here; tree is handled in dedicated comment endpoint
        return CommentSerializer(qs, many=True).data


class CommentSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(read_only=True)
    author = serializers.ReadOnlyField(source="author.username")
    replies = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Comment
        fields = ("id", "post", "author", "user_name", "text", "created_at", "parent", "replies")
        read_only_fields = ("id", "author", "user_name", "created_at", "post", "replies")

    def get_replies(self, obj):
        qs = obj.replies.select_related("author").all().order_by("created_at")[:50]
        return CommentSerializer(qs, many=True).data
