from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.forms.models import model_to_dict
from django.utils.dateparse import parse_date
from django.contrib.auth.decorators import login_required
from .models import Group, Post

# DRF
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

# S3
from storage.s3_utils import build_key, presign_upload, presign_download
import json


def _group_payload(g: Group) -> dict:
    return {
        "id": g.id,
        "name": g.name,
        "color": g.color,
        "description": g.description,
    }


@csrf_exempt
def groups_list_create(request):
    """
    GET: Return all groups (id, name, color, description)
    POST: Create a new group (requires auth) with JSON body {name, color?, description?}
    """
    if request.method == "GET":
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)
        data = [_group_payload(g) for g in Group.objects.all().order_by("-id")]
        return JsonResponse({"results": data})

    if request.method == "POST":
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except Exception:
            return HttpResponseBadRequest("Invalid JSON")
        name = (payload.get("name") or "").strip()
        color = (payload.get("color") or "#6b9bff").strip() or "#6b9bff"
        description = (payload.get("description") or "").strip()
        if not name:
            return HttpResponseBadRequest("Missing group name")
        g = Group.objects.create(name=name, color=color, description=description)
        return JsonResponse(_group_payload(g), status=201)

    return JsonResponse({"detail": "Method not allowed"}, status=405)


def posts_list(request):
    """List posts, optionally filter by group_id."""
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)
    group_id = request.GET.get("group_id")
    qs = Post.objects.all().order_by("-created_at")
    if group_id:
        qs = qs.filter(group_id=group_id)
    data = [p.as_dict(request) for p in qs]
    return JsonResponse({"results": data})


@csrf_exempt  # For prototype; replace with proper CSRF handling later.
def upload_post(request):
    """Accept multipart/form-data: image, caption, group_id, user_name."""
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    image = request.FILES.get("image")
    if not image:
        return HttpResponseBadRequest("Missing image file")

    caption = request.POST.get("caption", "").strip()
    # Prefer the authenticated user's name if available
    if request.user.is_authenticated:
        full = (request.user.get_full_name() or request.user.first_name or "").strip()
        user_name = full or request.user.username
    else:
        user_name = request.POST.get("user_name", "Anonymous").strip() or "Anonymous"
    group_id = request.POST.get("group_id")
    if not group_id:
        return HttpResponseBadRequest("Missing group_id")

    group = get_object_or_404(Group, pk=group_id)

    post = Post.objects.create(
        group=group,
        user_name=user_name,
        caption=caption,
        image=image,
    )

    return JsonResponse(post.as_dict(request), status=201)


@csrf_exempt
def group_detail(request, group_id: int):
    """
    GET: Fetch a group
    PATCH/PUT: Update group fields (requires auth)
    DELETE: Delete the group (requires auth)
    """
    g = get_object_or_404(Group, pk=group_id)

    if request.method == "GET":
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)
        return JsonResponse(_group_payload(g))

    if request.method in {"PATCH", "PUT", "POST"}:
        # Allow POST here for clients that can't easily send PATCH
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except Exception:
            return HttpResponseBadRequest("Invalid JSON")
        name = payload.get("name")
        color = payload.get("color")
        description = payload.get("description")
        if name is not None:
            g.name = (name or "").strip() or g.name
        if color is not None:
            g.color = (color or "").strip() or g.color
        if description is not None:
            g.description = (description or "").strip()
        g.save()
        return JsonResponse(_group_payload(g))

    if request.method == "DELETE":
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)
        g.delete()
        return JsonResponse({"ok": True})

    return JsonResponse({"detail": "Method not allowed"}, status=405)

@api_view(["POST"])
@permission_classes([IsAuthenticated])  # switch to AllowAny if testing without auth
def start_photo_upload(request):
    """
    Body: { "kind":"users"|"groups", "id":123, "filename":"photo.jpg", "contentType":"image/jpeg" }
    Returns: { "uploadUrl": "...", "key": "groups/123/<uuid>.jpg" }
    """
    kind = request.data.get("kind", "users")
    obj_id = request.data.get("id", "temp")
    filename = request.data.get("filename", "photo.jpg")
    content_type = request.data.get("contentType", "image/jpeg")

    key = build_key(kind, obj_id, filename)
    url = presign_upload(key, content_type)
    return Response({"uploadUrl": url, "key": key})


@api_view(["POST"])
@permission_classes([IsAuthenticated])  # switch to AllowAny if testing without auth
def create_post_from_s3(request):
    """
    Body: { "group_id":123, "key":"groups/123/<uuid>.jpg", "caption":"optional" }
    """
    group_id = request.data.get("group_id")
    key = (request.data.get("key") or "").strip()
    caption = (request.data.get("caption") or "").strip()
    if not group_id or not key:
        return Response({"detail": "group_id and key required"}, status=400)

    group = get_object_or_404(Group, pk=group_id)

    if hasattr(Post, "image_key"):
        post = Post.objects.create(group=group, user_name=request.user.get_username(),
                                   caption=caption, image_key=key)
    else:
        post = Post.objects.create(group=group, user_name=request.user.get_username(),
                                   caption=caption)

    image_url = presign_download(key)   # private bucket: short-lived GET
    return Response({
        "id": post.id,
        "user_name": post.user_name,
        "caption": post.caption,
        "image_url": image_url,
        "date": timezone.now().date().isoformat(),
        "group_id": group.id,
        "key": key
    }, status=201)