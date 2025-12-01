from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Group, Post, Profile

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

    class Meta:
        model = Group
        fields = ('id', 'name', 'owner', 'members', 'color', 'description', 'member_usernames', 'post_count')

    def get_member_usernames(self, obj):
        try:
            return list(obj.members.values_list('username', flat=True)[:12])
        except Exception:
            return []

    def get_post_count(self, obj):
        try:
            return obj.posts.count()
        except Exception:
            return 0


class PostSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source='author.username')
    user_name = serializers.ReadOnlyField(source='author.username')
    image_url = serializers.SerializerMethodField(read_only=True)

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
        fields = ('id', 'group', 'author', 'user_name', 'caption', 'image', 'image_url', 'date')
