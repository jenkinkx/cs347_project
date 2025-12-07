from rest_framework import generics, viewsets, status, mixins
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.filters import SearchFilter
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import transaction
from django.db.models import Q

from .permissions import IsAuthorOrReadOnly
from .serializers import (
    UserSerializer,
    GroupSerializer,
    PostSerializer,
    ProfileSerializer,
    CommentSerializer,
)
from .models import Group, Post, Profile, Comment, GroupMembership


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """Session auth without CSRF enforcement (prototype convenience)."""

    def enforce_csrf(self, request):
        return None


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = UserSerializer


class ProfileViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user.profile


class GroupViewSet(viewsets.ModelViewSet):
    queryset = Group.objects.all()
    serializer_class = GroupSerializer
    permission_classes = [IsAuthenticated]
    authentication_classes = [CsrfExemptSessionAuthentication]

    def get_queryset(self):
        user = self.request.user
        return Group.objects.filter(Q(owner=user) | Q(members=user)).distinct().order_by("-created_at")

    def perform_create(self, serializer):
        group = serializer.save(owner=self.request.user)
        GroupMembership.objects.get_or_create(user=self.request.user, group=group, defaults={"role": "member"})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def cover(self, request, pk=None):
        group = get_object_or_404(Group, pk=pk)
        if group.owner_id != request.user.id:
            return Response({"detail": "Only the owner can update the cover."}, status=status.HTTP_403_FORBIDDEN)
        file = request.FILES.get("cover")
        if not file:
            return Response({"detail": "Missing cover file."}, status=status.HTTP_400_BAD_REQUEST)
        group.cover = file
        group.save(update_fields=["cover"])
        ser = self.get_serializer(group, context={"request": request})
        return Response(ser.data)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def join(self, request, pk=None):
        group = get_object_or_404(Group, pk=pk)
        if not group.is_public and group.owner_id != request.user.id:
            return Response({"detail": "Cannot join a private group without an invite."}, status=status.HTTP_403_FORBIDDEN)
        GroupMembership.objects.get_or_create(user=request.user, group=group, defaults={"role": "member"})
        return Response({"ok": True})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def leave(self, request, pk=None):
        group = get_object_or_404(Group, pk=pk)
        if group.owner_id == request.user.id:
            return Response({"detail": "Owners cannot leave their own group."}, status=status.HTTP_400_BAD_REQUEST)
        GroupMembership.objects.filter(user=request.user, group=group).delete()
        return Response({"ok": True})

    def list(self, request, *args, **kwargs):
        discover = (request.query_params.get("discover") or "").lower() in {"1", "true", "yes"}
        if discover:
            qs = Group.objects.filter(is_public=True).exclude(Q(owner=request.user) | Q(members=request.user))
            q = (request.query_params.get("q") or "").strip()
            if q:
                qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
        else:
            qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response({"results": serializer.data})


class PostViewSet(viewsets.ModelViewSet):
    queryset = Post.objects.all().order_by("-created_at")
    serializer_class = PostSerializer
    permission_classes = [IsAuthenticated, IsAuthorOrReadOnly]
    authentication_classes = [CsrfExemptSessionAuthentication]
    filter_backends = [SearchFilter]
    search_fields = ["caption"]

    def get_queryset(self):
        user = self.request.user
        today = timezone.localdate()
        queryset = super().get_queryset().filter(date=today)
        group_id = self.request.query_params.get("group_id")
        if group_id:
            queryset = queryset.filter(group_id=group_id)
            try:
                group = Group.objects.get(id=group_id)
            except Group.DoesNotExist:
                return queryset.none()
            if not (group.owner_id == user.id or group.members.filter(id=user.id).exists()):
                return queryset.none()
        else:
            queryset = queryset.filter(Q(author=user) | Q(group__members=user) | Q(group__owner=user)).distinct()
        return queryset

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def _ensure_member(self, post, user):
        if post.group.owner_id == user.id:
            return True
        return post.group.members.filter(id=user.id).exists()

    @action(detail=False, methods=["post"], permission_classes=[IsAuthenticated, IsAuthorOrReadOnly])
    def bulk_delete(self, request):
        post_ids = request.data.get("post_ids", [])
        if not post_ids:
            return Response({"detail": "No post IDs provided."}, status=status.HTTP_400_BAD_REQUEST)
        posts_to_delete = Post.objects.filter(id__in=post_ids, author=request.user)
        deleted_count, _ = posts_to_delete.delete()
        return Response({"detail": f"Successfully deleted {deleted_count} posts."}, status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def export_my_posts(self, request):
        user_posts = Post.objects.filter(author=request.user).order_by("-created_at")
        serializer = self.get_serializer(user_posts, many=True)
        return Response(serializer.data)

    @csrf_exempt
    @action(detail=True, methods=["get", "post"], permission_classes=[IsAuthenticated])
    def comments(self, request, pk=None):
        post = get_object_or_404(Post, pk=pk)
        if not self._ensure_member(post, request.user):
            return Response({"detail": "Join the group to view comments."}, status=status.HTTP_403_FORBIDDEN)

        if request.method.lower() == "get":
            comments = (
                Comment.objects.filter(post=post)
                .select_related("author")
                .prefetch_related("replies")
                .order_by("created_at")
            )
            comment_map = {}
            roots = []

            def to_dict(c):
                return {
                    "id": c.id,
                    "post_id": c.post_id,
                    "user_id": c.author_id,
                    "user_name": c.user_name,
                    "text": c.text,
                    "created_at": c.created_at.isoformat(),
                    "parent": c.parent_id,
                    "replies": [],
                }

            for c in comments:
                comment_map[c.id] = to_dict(c)
            for c in comments:
                node = comment_map[c.id]
                if c.parent_id and c.parent_id in comment_map:
                    comment_map[c.parent_id]["replies"].append(node)
                else:
                    roots.append(node)
            return Response({"results": roots})

        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Comment text is required."}, status=status.HTTP_400_BAD_REQUEST)
        parent_id = request.data.get("parent_id")
        parent_obj = None
        if parent_id:
            try:
                parent_obj = Comment.objects.get(pk=parent_id, post=post)
            except Comment.DoesNotExist:
                return Response({"detail": "Parent comment not found."}, status=status.HTTP_404_NOT_FOUND)
        comment = Comment.objects.create(
            post=post,
            author=request.user,
            user_name=request.user.username,
            text=text,
            parent=parent_obj,
        )
        data = {
            "id": comment.id,
            "post_id": comment.post_id,
            "user_id": comment.author_id,
            "user_name": comment.user_name,
            "text": comment.text,
            "created_at": comment.created_at.isoformat(),
            "parent": comment.parent_id,
            "replies": [],
        }
        return Response(data, status=status.HTTP_201_CREATED)


@csrf_exempt
def upload_post(request):
    """Upload from SPA: multipart image, caption, group_id."""
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    image = request.FILES.get("image")
    caption = (request.POST.get("caption") or "").strip()
    group_id = request.POST.get("group_id")
    if not image or not group_id:
        return JsonResponse({"detail": "image and group_id are required"}, status=400)
    group = get_object_or_404(Group, id=group_id)
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
