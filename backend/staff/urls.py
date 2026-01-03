from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('info/', views.user_info_view, name='user-info'),
    path('users/', views.get_all_users, name='get-all-users'),
    path('users/create/', views.create_user, name='create-user'),
    path('users/<int:user_id>/update/', views.update_user, name='update-user'),
    path('users/<int:user_id>/delete/', views.delete_user, name='delete-user'),
    path('users/<int:user_id>/reset-password/', views.reset_password, name='reset-password'),
]