"""URL configuration for django_project."""
from django.urls import path, include
from apps.myapp import views

urlpatterns = [
    path("api/", include("apps.myapp.urls")),
]
