from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

# Lightweight session-based JSON auth for the prototype UI
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.middleware.csrf import get_token


@require_http_methods(["GET"])
def me(request):
    if request.user.is_authenticated:
        u = request.user
        name = (u.first_name + (" " + u.last_name if u.last_name else "")).strip() or u.username
        return JsonResponse({
            "id": u.id,
            "username": u.username,
            "name": name,
            "initials": (u.first_name[:1] + u.last_name[:1]).upper() or u.username[:2].upper(),
        })
    # Set a CSRF cookie for convenience in dev (even though our endpoints are csrf_exempt)
    get_token(request)
    return JsonResponse({"detail": "Not authenticated"}, status=401)


@csrf_exempt
@require_http_methods(["POST"])
def signup(request):
    import json
    User = get_user_model()
    try:
        data = json.loads(request.body or b"{}")
    except Exception:
        data = {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    full_name = (data.get("name") or "").strip()
    first_name = full_name.split(" ")[0] if full_name else ""
    last_name = " ".join(full_name.split(" ")[1:]) if full_name and " " in full_name else ""
    if not username or not password:
        return JsonResponse({"detail": "username and password required"}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({"detail": "username already exists"}, status=400)
    u = User.objects.create_user(username=username, password=password, first_name=first_name, last_name=last_name)
    # Auto-login
    user = authenticate(request, username=username, password=password)
    if user is not None:
        login(request, user)
    name = full_name or username
    return JsonResponse({"id": u.id, "username": u.username, "name": name, "initials": (first_name[:1] + last_name[:1]).upper() or username[:2].upper()})


@csrf_exempt
@require_http_methods(["POST"])
def login_view(request):
    import json
    try:
        data = json.loads(request.body or b"{}")
    except Exception:
        data = {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid credentials"}, status=400)
    login(request, user)
    name = (user.first_name + (" " + user.last_name if user.last_name else "")).strip() or user.username
    return JsonResponse({"id": user.id, "username": user.username, "name": name, "initials": (user.first_name[:1] + user.last_name[:1]).upper() or user.username[:2].upper()})


@csrf_exempt
@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return JsonResponse({"ok": True})


urlpatterns = [
    # JWT endpoints (optional)
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    # Session JSON endpoints for the prototype
    path('me/', me, name='auth_me'),
    path('signup/', signup, name='auth_signup'),
    path('login/', login_view, name='auth_login'),
    path('logout/', logout_view, name='auth_logout'),
]
