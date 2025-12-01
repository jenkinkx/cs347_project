from __future__ import annotations

from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpRequest, HttpResponse, JsonResponse, HttpResponseRedirect
from django.urls import reverse_lazy, reverse
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin, UserPassesTestMixin
from django.views.decorators.http import require_http_methods
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.db.models import Count
from django.utils import timezone
from django.contrib.auth import login
from django.contrib.auth.models import User
import csv
from io import StringIO

from posts.models import Group, Post, GroupMembership, GroupInvite
from django.utils import timezone
import secrets
from .forms import RegisterForm, PostForm, GroupForm, ProfileForm, CSVImportForm


def home(request: HttpRequest) -> HttpResponse:
    return render(request, "web/home.html")


class OwnerRequiredMixin(UserPassesTestMixin):
    def test_func(self):
        obj = self.get_object()
        return getattr(obj, "owner", None) == self.request.user


class GroupListView(LoginRequiredMixin, ListView):
    model = Group
    template_name = "web/group_list.html"
    context_object_name = "groups"
    paginate_by = 10

    def get_queryset(self):
        qs = Group.objects.all().order_by("-created_at")
        q = (self.request.GET.get("q") or "").strip()
        if q:
            qs = qs.filter(name__icontains=q)
        return qs


class GroupDetailView(LoginRequiredMixin, DetailView):
    model = Group
    template_name = "web/group_detail.html"

    def get_context_data(self, **kwargs):
        ctx = super().get_context_data(**kwargs)
        group = self.object
        ctx["memberships"] = GroupMembership.objects.filter(group=group).select_related("user").order_by("user__username")
        return ctx


class GroupCreateView(LoginRequiredMixin, CreateView):
    model = Group
    template_name = "web/group_form.html"
    form_class = GroupForm

    def form_valid(self, form):
        form.instance.owner = self.request.user
        # for audit trail
        form.instance._actor = self.request.user
        resp = super().form_valid(form)
        # Ensure owner is also a member
        try:
            GroupMembership.objects.get_or_create(user=self.request.user, group=self.object)
        except Exception:
            pass
        messages.success(self.request, "Group created.")
        return resp

    def get_success_url(self):
        return reverse("group_detail", args=[self.object.pk])


class GroupUpdateView(LoginRequiredMixin, OwnerRequiredMixin, UpdateView):
    model = Group
    template_name = "web/group_form.html"
    form_class = GroupForm

    def get_success_url(self):
        messages.success(self.request, "Group updated.")
        return reverse("group_detail", args=[self.object.pk])

    def form_valid(self, form):
        form.instance._actor = self.request.user
        return super().form_valid(form)


class GroupDeleteView(LoginRequiredMixin, OwnerRequiredMixin, DeleteView):
    model = Group
    template_name = "web/confirm_delete.html"
    success_url = reverse_lazy("group_list")

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        obj._actor = request.user
        return super().delete(request, *args, **kwargs)


@login_required
def group_invite(request: HttpRequest, pk: int) -> HttpResponse:
    group = get_object_or_404(Group, pk=pk)
    # Only owner can create invites
    if group.owner != request.user:
        messages.error(request, "Only the group owner can create invite links.")
        return redirect("group_detail", pk=pk)
    # Create a new invite (7-day expiry)
    code = GroupInvite.new_code()
    invite = GroupInvite.objects.create(group=group, code=code, created_by=request.user, expires_at=timezone.now() + timezone.timedelta(days=7))
    link = request.build_absolute_uri(reverse("join_group", args=[invite.code]))
    return render(request, "web/invite.html", {"group": group, "invite": invite, "link": link})


@login_required
def join_group(request: HttpRequest, code: str) -> HttpResponse:
    invite = get_object_or_404(GroupInvite, code=code)
    if not invite.is_valid():
        messages.error(request, "Invite link has expired.")
        return redirect("home")
    group = invite.group
    # Add membership
    GroupMembership.objects.get_or_create(user=request.user, group=group)
    messages.success(request, f"Joined {group.name}.")
    return redirect("group_detail", pk=group.pk)


@login_required
def manage_members(request: HttpRequest, pk: int) -> HttpResponse:
    group = get_object_or_404(Group, pk=pk)
    if request.user != group.owner:
        messages.error(request, "Only the owner can manage members.")
        return redirect("group_detail", pk=pk)
    if request.method == "POST":
        uid = int(request.POST.get("user_id"))
        action = request.POST.get("action")
        if uid == group.owner_id:
            messages.error(request, "Cannot modify the owner.")
            return redirect("manage_members", pk=pk)
        mem = get_object_or_404(GroupMembership, user_id=uid, group=group)
        if action == "remove":
            mem.delete()
            messages.success(request, "Member removed.")
        elif action == "role":
            role = request.POST.get("role")
            if role in ("member", "moderator"):
                mem.role = role
                mem.save(update_fields=["role"])
                messages.success(request, "Role updated.")
        return redirect("manage_members", pk=pk)
    memberships = GroupMembership.objects.filter(group=group).select_related("user").order_by("user__username")
    return render(request, "web/members.html", {"group": group, "memberships": memberships})


class PostListView(LoginRequiredMixin, ListView):
    model = Post
    template_name = "web/post_list.html"
    context_object_name = "posts"
    paginate_by = 12

    def get_queryset(self):
        qs = Post.objects.select_related("group", "author").order_by("-created_at")
        q = (self.request.GET.get("q") or "").strip()
        if q:
            qs = qs.filter(caption__icontains=q)
        gid = self.request.GET.get("group")
        if gid:
            qs = qs.filter(group_id=gid)
        return qs


class PostDetailView(LoginRequiredMixin, DetailView):
    model = Post
    template_name = "web/post_detail.html"


class PostCreateView(LoginRequiredMixin, CreateView):
    model = Post
    template_name = "web/post_form.html"
    form_class = PostForm

    def form_valid(self, form):
        form.instance.author = self.request.user
        form.instance._actor = self.request.user
        messages.success(self.request, "Post created.")
        return super().form_valid(form)

    def get_success_url(self):
        return reverse("post_detail", args=[self.object.pk])


class PostUpdateView(LoginRequiredMixin, UserPassesTestMixin, UpdateView):
    model = Post
    template_name = "web/post_form.html"
    form_class = PostForm

    def test_func(self):
        obj = self.get_object()
        if obj.author_id == self.request.user.id:
            return True
        # Allow group owner or moderators to edit
        if obj.group.owner_id == self.request.user.id:
            return True
        return GroupMembership.objects.filter(group=obj.group, user=self.request.user, role='moderator').exists()

    def get_success_url(self):
        messages.success(self.request, "Post updated.")
        return reverse("post_detail", args=[self.object.pk])

    def form_valid(self, form):
        form.instance._actor = self.request.user
        return super().form_valid(form)


class PostDeleteView(LoginRequiredMixin, UserPassesTestMixin, DeleteView):
    model = Post
    template_name = "web/confirm_delete.html"
    success_url = reverse_lazy("post_list")

    def test_func(self):
        obj = self.get_object()
        if obj.author_id == self.request.user.id:
            return True
        if obj.group.owner_id == self.request.user.id:
            return True
        return GroupMembership.objects.filter(group=obj.group, user=self.request.user, role='moderator').exists()

    def delete(self, request, *args, **kwargs):
        obj = self.get_object()
        obj._actor = request.user
        return super().delete(request, *args, **kwargs)


@login_required
@require_http_methods(["POST"])
def post_bulk_action(request: HttpRequest) -> HttpResponse:
    ids = request.POST.getlist("ids")
    action = request.POST.get("action")
    if not ids:
        messages.warning(request, "No posts selected.")
        return redirect("post_list")
    qs = Post.objects.filter(id__in=ids, author=request.user)
    if action == "delete":
        count = qs.count()
        qs.delete()
        messages.success(request, f"Deleted {count} posts.")
    return redirect("post_list")


@login_required
def export_posts_csv(request: HttpRequest) -> HttpResponse:
    # Export current user's posts
    posts = Post.objects.filter(author=request.user).select_related("group").order_by("-created_at")
    resp = HttpResponse(content_type="text/csv")
    resp["Content-Disposition"] = 'attachment; filename="my_posts.csv"'
    writer = csv.writer(resp)
    writer.writerow(["group_name", "caption", "date"])  # simple
    for p in posts:
        writer.writerow([p.group.name, p.caption, p.date.isoformat() if p.date else ""])
    return resp


@login_required
def import_posts_csv(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = CSVImportForm(request.POST, request.FILES)
        if form.is_valid():
            f = form.cleaned_data["file"]
            # Use a tiny placeholder image for imported posts
            from django.core.files.base import File
            from django.conf import settings
            placeholder_path = settings.BASE_DIR / "testdata" / "dot.png"
            reader = csv.DictReader(StringIO(f.read().decode("utf-8")))
            created = 0
            for row in reader:
                gname = (row.get("group_name") or "").strip() or "Imported"
                caption = (row.get("caption") or "").strip()
                group, _ = Group.objects.get_or_create(name=gname, defaults={"owner": request.user})
                p = Post(group=group, author=request.user, caption=caption, date=timezone.now().date())
                with open(placeholder_path, "rb") as ph:
                    p.image.save("placeholder.png", File(ph), save=True)
                created += 1
            messages.success(request, f"Imported {created} posts.")
            return redirect("post_list")
    else:
        form = CSVImportForm()
    return render(request, "web/import_posts.html", {"form": form})


@login_required
def profile_view(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = ProfileForm(request.POST, instance=request.user.profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated.")
            return redirect("profile")
    else:
        form = ProfileForm(instance=request.user.profile)
    return render(request, "web/profile.html", {"form": form})


def help_page(request: HttpRequest) -> HttpResponse:
    return render(request, "web/help.html")


@login_required
def reports(request: HttpRequest) -> HttpResponse:
    # Simple data: posts per day (last 7 days) for current user
    today = timezone.now().date()
    days = [today - timezone.timedelta(days=i) for i in range(6, -1, -1)]
    counts = []
    for d in days:
        counts.append(Post.objects.filter(author=request.user, date=d).count())
    return render(
        request,
        "web/reports.html",
        {
            "labels": [d.isoformat() for d in days],
            "counts": counts,
        },
    )


def register(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "Welcome!")
            return redirect("home")
    else:
        form = RegisterForm()
    return render(request, "web/register.html", {"form": form})


def custom_404(request: HttpRequest, exception=None) -> HttpResponse:
    return render(request, "web/404.html", status=404)
