from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import get_object_or_404
from django.forms.models import model_to_dict
from django.utils.dateparse import parse_date
from django.db.models import Q, Count, Prefetch # for group search
from .models import Group, Post, GroupMembership
import json


def _member_display(user):
    if not user:
        return "Member"
    full = (user.get_full_name() or "").strip()
    if full:
        return full
    return user.get_username()


def _group_payload(g: Group, user=None, *, include_members=False, is_member=None) -> dict:
    member_count = getattr(g, "member_count", None)
    if member_count is None:
        member_count = g.memberships.count()
    data = {
        "id": g.id,
        "name": g.name,
        "color": g.color,
        "description": g.description,
        "is_private": g.is_private,
        "creator_id": g.creator_id,
        "member_count": member_count,
        "is_creator": bool(user and user.is_authenticated and g.creator_id == getattr(user, "id", None)),
    }
    if include_members:
        members = []
        for membership in g.memberships.all():
            member_user = getattr(membership, "user", None)
            if member_user:
                members.append({"id": member_user.id, "name": _member_display(member_user)})
        data["members"] = members

    if is_member is None:
        data["is_member"] = bool(user and user.is_authenticated and g.memberships.filter(user=user).exists())
    else:
        data["is_member"] = bool(is_member)

    return data


@csrf_exempt
def groups_list_create(request):
    """
    GET: Return all groups (id, name, color, description)
    POST: Create a new group (requires auth) with JSON body {name, color?, description?}
    """
    if request.method == "GET":
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)

        q = (request.GET.get("q") or "").strip()
        discover_flag = (request.GET.get("discover") or "").lower() in {"1", "true", "yes"}
        try:
            limit = max(1, min(int(request.GET.get("limit", 100)), 500))
        except ValueError:
            limit = 100

        qs = Group.objects.all().annotate(member_count=Count("memberships", distinct=True)).order_by("-id")
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(description__icontains=q))
        if discover_flag:
            qs = qs.filter(is_private=False).exclude(memberships__user=request.user)
            include_members = False
        else:
            qs = qs.filter(memberships__user=request.user)
            include_members = True
            qs = qs.prefetch_related(
                Prefetch(
                    "memberships",
                    queryset=GroupMembership.objects.select_related("user").order_by("user__username"),
                )
            )

        data = [
            _group_payload(
                g,
                request.user,
                include_members=include_members,
                is_member=(not discover_flag),
            )
            for g in qs[:limit]
        ]
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
        is_private = bool(payload.get("is_private", False))
        if not name:
            return HttpResponseBadRequest("Missing group name")

        g = Group.objects.create(
            name=name,
            color=color,
            description=description,
            creator=request.user,
            is_private=is_private,
        )
        GroupMembership.objects.create(group=g, user=request.user, is_admin=True)
        g = Group.objects.filter(pk=g.pk).prefetch_related(
            Prefetch(
                "memberships",
                queryset=GroupMembership.objects.select_related("user").order_by("user__username"),
            )
        ).annotate(member_count=Count("memberships")).first()
        return JsonResponse(_group_payload(g, request.user, include_members=True, is_member=True), status=201)

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
        include_members = g.memberships.filter(user=request.user).exists()
        if include_members:
            g = (
                Group.objects.filter(pk=g.pk)
                .prefetch_related(
                    Prefetch(
                        "memberships",
                        queryset=GroupMembership.objects.select_related("user").order_by("user__username"),
                    )
                )
                .annotate(member_count=Count("memberships"))
                .first()
            )
        return JsonResponse(_group_payload(g, request.user, include_members=include_members))

    if request.method in {"PATCH", "PUT", "POST"}:
        # Allow POST here for clients that can't easily send PATCH
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)
        if g.creator_id != request.user.id:
            return JsonResponse({"detail": "Only the creator can update this group"}, status=403)
        try:
            payload = json.loads(request.body.decode("utf-8") or "{}")
        except Exception:
            return HttpResponseBadRequest("Invalid JSON")
        name = payload.get("name")
        color = payload.get("color")
        description = payload.get("description")
        if "is_private" in payload:
            g.is_private = bool(payload.get("is_private"))
        if name is not None:
            g.name = (name or "").strip() or g.name
        if color is not None:
            g.color = (color or "").strip() or g.color
        if description is not None:
            g.description = (description or "").strip()
        g.save()
        return JsonResponse(_group_payload(g, request.user))

    if request.method == "DELETE":
        if not request.user.is_authenticated:
            return JsonResponse({"detail": "Authentication required"}, status=401)
        if g.creator_id != request.user.id:
            return JsonResponse({"detail": "Only the creator can delete this group"}, status=403)
        g.delete()
        return JsonResponse({"ok": True})

    return JsonResponse({"detail": "Method not allowed"}, status=405)


@csrf_exempt
def join_group(request, group_id: int):
    """Allow the current user to join a public (or their own private) group."""
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)
    group = get_object_or_404(Group, pk=group_id)
    if group.is_private and group.creator_id != request.user.id:
        return JsonResponse({"detail": "Cannot join a private group without an invite"}, status=403)
    membership, created = GroupMembership.objects.get_or_create(
        group=group,
        user=request.user,
        defaults={"is_admin": group.creator_id == request.user.id},
    )
    include_members = True
    group = (
        Group.objects.filter(pk=group.pk)
        .prefetch_related(
            Prefetch(
                "memberships",
                queryset=GroupMembership.objects.select_related("user").order_by("user__username"),
            )
        )
        .annotate(member_count=Count("memberships"))
        .first()
    )
    status = 201 if created else 200
    return JsonResponse(_group_payload(group, request.user, include_members=include_members, is_member=True), status=status)
