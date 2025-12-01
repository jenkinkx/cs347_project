from rest_framework import generics, viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from .permissions import IsAuthorOrReadOnly
from django.contrib.auth.models import User
from .serializers import UserSerializer, GroupSerializer, PostSerializer, ProfileSerializer
from .models import Group, Post, Profile
from rest_framework import mixins
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer


class ProfileViewSet(mixins.RetrieveModelMixin,
                   mixins.UpdateModelMixin,
                   viewsets.GenericViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Only groups the user owns or has joined
        user = self.request.user
        return Group.objects.filter(Q(owner=user) | Q(members=user)).distinct().order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by('-created_at')
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated, IsAuthorOrReadOnly]
    filter_backends = [SearchFilter]
    search_fields = ['caption']

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        group_id = self.request.query_params.get('group_id')
        if group_id:
            queryset = queryset.filter(group_id=group_id)
            # Enforce membership
            try:
                group = Group.objects.get(id=group_id)
            except Group.DoesNotExist:
                return queryset.none()
            if not (group.owner_id == user.id or group.members.filter(id=user.id).exists()):
                return queryset.none()
            # Daily gate: if the user hasn't posted today in this group, restrict to own posts only
            today = timezone.now().date()
            has_posted_today = Post.objects.filter(group=group, author=user, date=today).exists()
            if not has_posted_today:
                queryset = queryset.filter(author=user)
        else:
            # If no group filter, show only user's posts by default
            queryset = queryset.filter(author=user)
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsAuthorOrReadOnly])
    def bulk_delete(self, request):
        post_ids = request.data.get('post_ids', [])
        if not post_ids:
            return Response({"detail": "No post IDs provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Filter posts to ensure only the requesting user's posts are considered
        posts_to_delete = Post.objects.filter(id__in=post_ids, author=request.user)
        deleted_count, _ = posts_to_delete.delete()

        return Response({"detail": f"Successfully deleted {deleted_count} posts."}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def export_my_posts(self, request):
        user_posts = Post.objects.filter(author=request.user).order_by('-created_at')
        serializer = self.get_serializer(user_posts, many=True)
        return Response(serializer.data)


@csrf_exempt
def upload_post(request):
    """Handle multipart upload from the prototype UI.
    Expects fields: image (file), caption (str), group_id (int), user_name (str - ignored, derived from request.user)
    Returns JSON with id, user_name, caption, date, image_url.
    """
    if request.method != 'POST':
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    image = request.FILES.get('image')
    caption = (request.POST.get('caption') or '').strip()
    group_id = request.POST.get('group_id')
    if not image or not group_id:
        return JsonResponse({"detail": "image and group_id are required"}, status=400)
    group = get_object_or_404(Group, id=group_id)
    # Must be owner or member to post
    if not (group.owner_id == request.user.id or group.members.filter(id=request.user.id).exists()):
        return JsonResponse({"detail": "Join the group to post."}, status=403)
    with transaction.atomic():
        post = Post.objects.create(
            group=group,
            author=request.user,
            caption=caption,
            image=image,
            date=timezone.now().date(),
        )
    data = {
        "id": post.id,
        "user_name": request.user.username,
        "caption": post.caption,
        "date": post.date.isoformat() if post.date else None,
        "image_url": request.build_absolute_uri(post.image.url) if post.image else None,
    }
    return JsonResponse(data, status=201)
