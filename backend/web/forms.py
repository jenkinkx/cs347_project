from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from posts.models import Post, Group, Profile


class RegisterForm(UserCreationForm):
    first_name = forms.CharField(required=False)
    last_name = forms.CharField(required=False)

    class Meta:
        model = User
        fields = ("username", "first_name", "last_name", "password1", "password2")


class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ("group", "caption", "image")

    def clean_caption(self):
        cap = self.cleaned_data.get("caption", "").strip()
        if len(cap) < 2:
            raise forms.ValidationError("Caption must be at least 2 characters.")
        return cap


class GroupForm(forms.ModelForm):
    start_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}))
    end_date = forms.DateField(required=False, widget=forms.DateInput(attrs={"type": "date"}))

    class Meta:
        model = Group
        fields = ("name", "color", "description", "cover", "is_public", "start_date", "end_date")


class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ("bio",)


class CSVImportForm(forms.Form):
    file = forms.FileField(help_text="Upload CSV with columns: group_name, caption")
