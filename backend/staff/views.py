# staff/views.py
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from .models import User
from .serializers import UserSerializer, UserCreateSerializer, LoginSerializer
from task.permissions import IsAdmin, IsAdminOrStaff

@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
def login_view(request):
    """Login endpoint with JWT token generation using email"""
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    user = authenticate(
        request,
        username=serializer.validated_data['email'],  # Django uses 'username' param
        password=serializer.validated_data['password']
    )
    
    if user:
        refresh = RefreshToken.for_user(user)
        return Response({
            'token': str(refresh.access_token),
            'refresh': str(refresh),
            'staff': UserSerializer(user).data
        })
    
    return Response(
        {'error': 'Invalid credentials'},
        status=status.HTTP_401_UNAUTHORIZED
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_info_view(request):
    """Get current user information"""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_users(request):
    """Get all users - All authenticated users can see user list for task assignment"""
    users = User.objects.all().order_by('role', 'department')
    serializer = UserSerializer(users, many=True)
    return Response({'users': serializer.data})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def create_user(request):
    """Admin/Staff: Create new user"""
    serializer = UserCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    return Response(
        UserSerializer(user).data,
        status=status.HTTP_201_CREATED
    )


@api_view(['PUT'])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def update_user(request, user_id):
    """Admin/Staff: Update user"""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if 'name' in request.data:
        name_parts = request.data['name'].split(' ', 1)
        user.first_name = name_parts[0]
        user.last_name = name_parts[1] if len(name_parts) > 1 else ''
    
    if 'role' in request.data:
        user.role = request.data['role']
    
    if 'department' in request.data:
        user.department = request.data['department']
    
    if 'email' in request.data:
        user.email = request.data['email']
    
    user.save()
    return Response(UserSerializer(user).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def delete_user(request, user_id):
    """Admin/Staff: Delete user"""
    try:
        user = User.objects.get(id=user_id)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def reset_password(request, user_id):
    """Admin/Staff: Reset own password only"""
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response(
            {'error': 'User not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Check if admin is resetting their own password
    if request.user.id != user_id:
        return Response(
            {'error': 'You can only reset your own password'},
            status=status.HTTP_403_FORBIDDEN
        )
    
    new_password = request.data.get('password')
    
    if not new_password:
        return Response(
            {'error': 'Password is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    if len(new_password) < 6:
        return Response(
            {'error': 'Password must be at least 6 characters long'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    user.set_password(new_password)
    user.save()
    
    return Response({
        'message': f'Password reset successfully for {user.email}',
        'user': UserSerializer(user).data
    })