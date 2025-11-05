from django.urls import path
from django.http import JsonResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
import json


def _user_payload(user: User):
    name = (user.get_full_name() or user.first_name or user.username).strip()
    initials = "".join([p[0] for p in name.split() if p][:2]).upper() or user.username[:2].upper()
    return {
        "id": user.id,
        "username": user.username,
        "name": name,
        "initials": initials,
        "is_authenticated": True,
    }


def me(request):
    if request.user.is_authenticated:
        return JsonResponse(_user_payload(request.user))
    return JsonResponse({"is_authenticated": False}, status=401)


@csrf_exempt
def signup(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON")

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    name = (data.get("name") or "").strip()
    if not username or not password:
        return HttpResponseBadRequest("Missing username or password")

    if User.objects.filter(username=username).exists():
        return JsonResponse({"detail": "Username already taken"}, status=400)

    user = User.objects.create_user(username=username, password=password)
    if name:
        parts = name.split()
        user.first_name = parts[0]
        user.last_name = " ".join(parts[1:]) if len(parts) > 1 else ""
        user.save()

    # Auto-login after signup for convenience
    user = authenticate(request, username=username, password=password)
    if user:
        login(request, user)
    return JsonResponse(_user_payload(user), status=201)


@csrf_exempt
def login_view(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return HttpResponseBadRequest("Invalid JSON")

    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    user = authenticate(request, username=username, password=password)
    if not user:
        return JsonResponse({"detail": "Invalid credentials"}, status=400)
    login(request, user)
    return JsonResponse(_user_payload(user))


@csrf_exempt
def logout_view(request):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    logout(request)
    return JsonResponse({"ok": True})


urlpatterns = [
    path("me/", me, name="auth_me"),
    path("signup/", signup, name="auth_signup"),
    path("login/", login_view, name="auth_login"),
    path("logout/", logout_view, name="auth_logout"),
]

