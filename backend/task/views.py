from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .utils import send_task_assignment_email
from .test_email import test_email
from django.db.models import Q, Count
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from .models import Task, TaskAssignment, TaskHistory
from .serializers import TaskSerializer, TaskDetailSerializer, TaskCreateSerializer, TaskHistorySerializer
from .permissions import IsAdmin, IsHOD, IsAdminOrStaff, IsFaculty, IsStaff
from django.http import HttpResponse
import csv
from io import BytesIO
from reportlab.pdfgen import canvas
import logging

logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_view(request):
    """Dashboard stats for all roles"""
    user = request.user
    
    # Get tasks based on role
    if user.role == 'admin' or user.is_superuser:
        tasks = Task.objects.all()
    elif user.role == 'hod':
        tasks = Task.objects.filter(
            assignments__department=user.department
        ).distinct()
    else:  # staff (Faculty)
        # Staff can see all tasks (consistent with get_all_tasks)
        tasks = Task.objects.all()
    
    # Calculate stats based on status (not priority)
    total_tasks = tasks.count()
    completed_tasks = tasks.filter(status='completed').count()
    ongoing_tasks = tasks.filter(status='pending').count()  # pending = ongoing
    
    return Response({
        'total_task': total_tasks,
        'completed_task': completed_tasks,
        'ongoing_task': ongoing_tasks
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_tasks(request):
    """Get all tasks based on user role"""
    try:
        user = request.user
        
        # Query based on role hierarchy
        if user.role in ['admin', 'staff']:
            # Admin and Staff can see all tasks
            tasks = Task.objects.all()
        elif user.role == 'hod':
            # HOD can only see department tasks
            tasks = Task.objects.filter(
                Q(assignments__department=user.department)
            ).distinct()
        elif user.role == 'faculty':
            # Faculty can only see their assigned tasks
            tasks = Task.objects.filter(
                assignments__assignee=user
            ).distinct()
        
        # Prefetch related data for performance
        tasks = tasks.prefetch_related('assignments__assignee')
        
        # Update overdue tasks
        for task in tasks:
            try:
                task.update_status()
            except Exception as e:
                logger.warning(f"Error updating status for task {task.id}: {str(e)}")
                continue
        
        serializer = TaskSerializer(tasks, many=True)
        return Response({'tasks': serializer.data})
    except Exception as e:
        logger.error(f"Error in get_all_tasks: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': 'Failed to fetch tasks', 'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def get_task(request, task_id):
    """Get, update, or delete a task"""
    user = request.user
    
    try:
        task = Task.objects.prefetch_related(
            'assignments__assignee',                                                                        
            'history__performed_by',
            'attachments'
        ).get(id=task_id)
        
        # Check permission - Staff can now view all tasks
        if user.role == 'hod' and not user.is_superuser:
            if not task.assignments.filter(department=user.department).exists():
                return Response(
                    {'error': 'Permission denied'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        # Handle GET request
        if request.method == 'GET':
            task.update_status()
            serializer = TaskDetailSerializer(task)
            return Response(serializer.data)
        
        # Handle PUT request (Update)
        elif request.method == 'PUT':
            # Permission and logging block
            try:
                # Debug logging - Safe access to created_by and assignees
                created_by_safe = task.created_by if isinstance(task.created_by, str) else (task.created_by.email if task.created_by else 'None')
                assignee_emails = [
                    a.assignee.email if not isinstance(a.assignee, str) else a.assignee 
                    for a in task.assignments.all()
                ]
                logger.info(f"PUT request from user: {user.email}, role: {user.role}")
                logger.info(f"Task ID: {task.id}, created_by: {created_by_safe}")
                logger.info(f"Task assignments: {assignee_emails}")
                logger.info(f"Request data: {request.data}")
                
                # Permission check based on hierarchy
                can_edit = False
                
                if user.role in ['admin', 'staff'] or user.is_superuser:
                    # Admin and Staff can edit everything
                    can_edit = True
                elif user.role == 'hod':
                    # HOD can only view, not edit
                    can_edit = False
                elif user.role == 'faculty':
                    # Faculty can only view, not edit
                    can_edit = False
                
                # Special check for status update - only admin and staff can mark as completed
                if request.data.get('status') == 'completed' and not (user.role in ['admin', 'staff'] or user.is_superuser):
                    return Response(
                        {'error': 'Only Admin and Staff can mark tasks as completed'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                # Safe creator and assigned checks
                is_creator = task.created_by == user.email if isinstance(task.created_by, str) else (task.created_by == user)
                # For assigned, use loop if filter may fail on str
                is_assigned = any(
                    a.assignee == user if not isinstance(a.assignee, str) else a.assignee == user.email
                    for a in task.assignments.all()
                )
                
                logger.info(f"Can edit: {can_edit}")
                logger.info(f"  - is_admin: {user.role == 'admin'}")
                logger.info(f"  - is_superuser: {user.is_superuser}")
                logger.info(f"  - is_creator: {is_creator}")
                logger.info(f"  - is_assigned: {is_assigned}")
                
                if not can_edit:
                    return Response(
                        {'error': 'You do not have permission to update this task'},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except Exception as e:
                logger.error(f"Error in permission check: {str(e)}")
                import traceback
                traceback.print_exc()
                return Response(
                    {'error': 'Error checking permissions', 'detail': str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            # Capture old values
            changes = {}
            
            if 'title' in request.data and task.title != request.data['title']:
                changes['title'] = {'old': task.title, 'new': request.data['title']}
                task.title = request.data['title']
            
            if 'description' in request.data and task.description != request.data['description']:
                changes['description'] = {'old': task.description, 'new': request.data['description']}
                task.description = request.data['description']
            
            if 'due_date' in request.data:
                new_deadline = request.data['due_date']
                if str(task.due_date) != str(new_deadline):
                    changes['due_date'] = {'old': str(task.due_date), 'new': str(new_deadline)}
                    task.due_date = new_deadline
            
            if 'priority' in request.data and task.priority != request.data['priority']:
                changes['priority'] = {'old': task.priority, 'new': request.data['priority']}
                task.priority = request.data['priority']
            
            if 'status' in request.data and task.status != request.data['status']:
                changes['status'] = {'old': task.status, 'new': request.data['status']}
                task.status = request.data['status']
                
                if task.status == 'completed' and not task.completed_at:
                    task.completed_at = timezone.now()
                elif task.status != 'completed' and task.completed_at:
                    task.completed_at = None
            
            # Handle assignee and department updates
            try:
                if 'assignee' in request.data:
                    from staff.models import User
                    
                    # Clear existing assignments
                    task.assignments.all().delete()
                    
                    # Create new assignments
                    assignees = request.data['assignee']
                    
                    logger.info(f"Updating assignees: {assignees}")
                    
                    # Each assignee gets assigned once with their own department
                    for email in assignees:
                        try:
                            user_obj = User.objects.get(email=email)
                            # Use the user's department from their profile
                            # unique_together constraint allows only one assignment per task-assignee pair
                            TaskAssignment.objects.create(
                                task=task,
                                assignee=user_obj,
                                department=user_obj.department or 'GENERAL'  # Fallback to GENERAL if no department
                            )
                            logger.info(f"Assigned {email} with department {user_obj.department}")
                        except User.DoesNotExist:
                            logger.warning(f"Warning: User with email {email} not found")
                            continue
                        except Exception as e:
                            logger.error(f"Error creating assignment for {email}: {str(e)}")
                            continue
            except Exception as e:
                logger.error(f"Error handling assignees: {str(e)}")
                return Response({'error': 'Error updating assignees', 'detail': str(e)}, status=500)
            
            # Capture follow_comment and decide if to save
            follow_comment = request.data.get('follow_comment', '').strip()
            has_changes = bool(changes)
            should_save = has_changes or bool(follow_comment)
            
            if should_save:
                task.save()
                
                # Build history details
                history_details = {
                    'changes': changes,
                    'updated_fields': list(changes.keys()) if has_changes else []
                }
                if follow_comment:
                    history_details['follow_comment'] = follow_comment
                    logger.info(f"Follow comment saved for task {task.id}: {follow_comment}")
                
                # Create history entry
                TaskHistory.objects.create(
                    task=task,
                    action='updated',
                    performed_by=request.user,
                    details=history_details
                )
            
            return Response(TaskDetailSerializer(task).data)
        
        # Handle DELETE request
        elif request.method == 'DELETE':
            # Debug logging - Safe access
            created_by_safe = task.created_by if isinstance(task.created_by, str) else (task.created_by.email if task.created_by else 'None')
            logger.info(f"DELETE request from user: {user.email}, role: {user.role}")
            logger.info(f"Task ID: {task.id}, created_by: {created_by_safe}")
            
            # Permission check: Admin and Staff can delete any task, HOD can delete department tasks
            # Safe creator check
            is_creator = task.created_by == user.email if isinstance(task.created_by, str) else (task.created_by == user)
            can_delete = (
                user.role == 'admin' or 
                user.role == 'staff' or  # Staff (Faculty) can delete all tasks
                user.is_superuser or
                (user.role == 'hod' and task.assignments.filter(department=user.department).exists()) or
                is_creator
            )
            
            logger.info(f"Can delete: {can_delete}")
            logger.info(f"  - is_admin: {user.role == 'admin'}")
            logger.info(f"  - is_superuser: {user.is_superuser}")
            logger.info(f"  - is_creator: {is_creator}")
            
            if not can_delete:
                return Response(
                    {'error': 'You do not have permission to delete this task'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            task.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        
    except Task.DoesNotExist:
        return Response(
            {'error': 'Task not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in get_task: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': 'Internal server error', 'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminOrStaff])
def create_task(request):
    """Create new task (Admin/HOD/Staff can create)"""
    serializer = TaskCreateSerializer(
        data=request.data,
        context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    
    # Create the task with the provided created_by name
    task = serializer.save()
    
    # Send email notifications to assigned staff and their HODs
    for assignment in task.assignments.all():
        send_task_assignment_email(task, assignment.assignee)
    
    return Response(
        TaskDetailSerializer(task).data,
        status=status.HTTP_201_CREATED
    )

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_task(request, task_id):
    """Update task details"""
    try:
        task = Task.objects.get(id=task_id)
        
        # Capture old values BEFORE updating
        old_values = {}
        changes = {}
        
        # Track what changed
        if 'title' in request.data and task.title != request.data['title']:
            old_values['title'] = task.title
            task.title = request.data['title']
            changes['title'] = {'old': old_values['title'], 'new': task.title}
        
        if 'description' in request.data and task.description != request.data['description']:
            old_values['description'] = task.description
            task.description = request.data['description']
            changes['description'] = {'old': old_values['description'], 'new': task.description}
        
        if 'due_date' in request.data:  # Note: Your model uses 'due_date', not 'deadline'
            new_deadline = request.data['due_date']
            if str(task.due_date) != str(new_deadline):
                old_values['due_date'] = str(task.due_date)
                task.due_date = new_deadline
                changes['due_date'] = {'old': old_values['due_date'], 'new': str(new_deadline)}
        
        if 'priority' in request.data and task.priority != request.data['priority']:
            old_values['priority'] = task.priority
            task.priority = request.data['priority']
            changes['priority'] = {'old': old_values['priority'], 'new': task.priority}
        
        if 'status' in request.data and task.status != request.data['status']:
            old_values['status'] = task.status
            # Store this for later email notifications
            old_status = task.status
            new_status = request.data['status']
            
            task.status = new_status
            changes['status'] = {'old': old_values['status'], 'new': task.status}

            if task.status == 'completed' and not task.completed_at:
                task.completed_at = timezone.now()
            elif task.status != 'completed' and task.completed_at:
                task.completed_at = None
        
        if 'reminder1' in request.data:
            new_reminder1 = request.data['reminder1']
            # Handle empty strings as None
            if new_reminder1 == "":
                new_reminder1 = None
            
            if str(task.reminder1) != str(new_reminder1):
                old_values['reminder1'] = str(task.reminder1) if task.reminder1 else None
                task.reminder1 = new_reminder1
                changes['reminder1'] = {'old': old_values['reminder1'], 'new': str(new_reminder1) if new_reminder1 else None}
        
        if 'reminder2' in request.data:
            new_reminder2 = request.data['reminder2']
            # Handle empty strings as None
            if new_reminder2 == "":
                new_reminder2 = None
                
            if str(task.reminder2) != str(new_reminder2):
                old_values['reminder2'] = str(task.reminder2) if task.reminder2 else None
                task.reminder2 = new_reminder2
                changes['reminder2'] = {'old': old_values['reminder2'], 'new': str(new_reminder2) if new_reminder2 else None}
                changes['reminder2'] = {'old': old_values['reminder2'], 'new': str(new_reminder2)}
        
        # NEW: Capture follow_comment
        follow_comment = request.data.get('follow_comment', '').strip()
        has_changes = bool(changes)
        should_save = has_changes or bool(follow_comment)
        
        if should_save:
            task.save()
            
            # Build history details (changes only in JSON)
            history_details = {
                'changes': changes,
                'updated_fields': list(changes.keys()) if has_changes else []
            }
            
            # Add follow_comment to details for consistent querying
            if follow_comment:
                history_details['follow_comment'] = follow_comment
            
            # Save to history
            TaskHistory.objects.create(
                task=task,
                action='updated',
                performed_by=request.user,
                details=history_details,
                comment=follow_comment if follow_comment else None  # Also save to dedicated field
            )
            
            if follow_comment:
                logger.info(f"Follow comment saved for task {task.id}: {follow_comment}")
        
        return Response(TaskDetailSerializer(task).data)
        
    except Task.DoesNotExist:
        return Response(
            {'error': 'Task not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        logger.error(f"Error in update_task: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response(
            {'error': 'Error updating task', 'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsStaff])
def delete_task(request, task_id):
    """Delete task (Admin only)"""
    try:
        task = Task.objects.get(id=task_id)
        task.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
        
    except Task.DoesNotExist:
        return Response(
            {'error': 'Task not found'},
            status=status.HTTP_404_NOT_FOUND
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin])
def generate_task_pdf(request):
    """Generate PDF report of all tasks"""
    tasks = Task.objects.select_related('created_by').prefetch_related('assignments')
    
    # Create PDF
    buffer = BytesIO()
    p = canvas.Canvas(buffer)
    
    y = 800
    p.drawString(100, y, "Task Management Report")
    y -= 30
    
    for task in tasks:
        if y < 100:
            p.showPage()
            y = 800
        
        p.drawString(100, y, f"{task.title} - {task.priority}")
        y -= 20
    
    p.save()
    buffer.seek(0)
    
    response = HttpResponse(buffer, content_type='application/pdf')
    response['Content-Disposition'] = 'attachment; filename="tasks_report.pdf"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_history(request):
    """Get recent task history/activity based on user role, including follow-up comments"""
    from .serializers import TaskHistorySerializer
    user = request.user
    
    # Get history based on role
    if user.role == 'admin' or user.is_superuser:
        # Admin sees all history
        history = TaskHistory.objects.select_related(
            'task', 'performed_by'
        ).all()[:10]
        
        # For admin, get all follow-up comments, not just from recent history
        comment_history = TaskHistory.objects.filter(
            action='updated',
            details__follow_comment__isnull=False
        ).select_related('task', 'performed_by').order_by('-timestamp')[:20]
    elif user.role == 'hod':
        # HOD sees history for tasks in their department
        history = TaskHistory.objects.select_related(
            'task', 'performed_by'
        ).filter(
            task__assignments__department=user.department
        ).distinct()[:10]
        
        # HODs do not see follow-up comments as per updated requirements
        comment_history = TaskHistory.objects.none()
    else:  # staff
        # Staff sees all task history
        history = TaskHistory.objects.select_related(
            'task', 'performed_by'
        ).all()[:10]
        
        # Staff sees all comments
        comment_history = TaskHistory.objects.filter(
            action='updated',
            details__follow_comment__isnull=False
        ).select_related('task', 'performed_by').order_by('-timestamp')[:20]
    
    # Extract follow-up comments
    comments = []
    for entry in comment_history:
        if 'follow_comment' in entry.details:
            comments.append({
                'id': entry.id,
                'task_id': entry.task.id,
                'comment': entry.details['follow_comment'],
                'performed_by': entry.performed_by.email if entry.performed_by else 'System',
                'timestamp': entry.timestamp,
                'full_details': entry.details,  # Optional: Full history for context
            })
    
    # Serialize full history
    serializer = TaskHistorySerializer(history, many=True)
    return Response({
        'activities': serializer.data,
        'follow_comments': comments  # Dedicated list of comments from broader query
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_comments(request, task_id):
    """Get follow-up comments for a specific task"""
    try:
        task = Task.objects.get(id=task_id)
        # Permission check - HODs cannot see follow-up comments
        if request.user.role == 'hod':
            return Response({'error': 'HODs do not have access to follow-up comments'}, status=status.HTTP_403_FORBIDDEN)
        
        # Fetch history entries with follow_comments
        history = TaskHistory.objects.filter(
            task_id=task_id,
            action='updated',
            details__follow_comment__isnull=False
        ).select_related('performed_by').order_by('-timestamp')
        
        follow_comments = [{
            'id': entry.id,
            'task_id': task_id,
            'comment': entry.details['follow_comment'],
            'performed_by': entry.performed_by.email if entry.performed_by else 'System',
            'timestamp': entry.timestamp,
        } for entry in history]
        
        return Response({'follow_comments': follow_comments})
    except Task.DoesNotExist:
        return Response({'error': 'Task not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in get_task_comments: {str(e)}")
        return Response(
            {'error': 'Failed to fetch comments', 'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_follow_comments(request):
    """Get all follow-up comments across tasks with pagination"""
    try:
        from django.db.models import Q
        
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        # Calculate offset
        offset = (page - 1) * page_size
        limit = offset + page_size
        
        user = request.user
        
        # Query for comments - check both details JSONField and comment field
        comment_filter = Q(details__follow_comment__isnull=False) | Q(comment__isnull=False)
        
        # Filter based on role
        if user.role == 'admin' or user.is_superuser:
            # Admin sees all follow comments from all users (admin and staff)
            query = TaskHistory.objects.filter(
                action='updated'
            ).filter(comment_filter)
        elif user.role == 'staff':
            # Staff sees all comments (same as admin)
            query = TaskHistory.objects.filter(
                action='updated'
            ).filter(comment_filter)
        elif user.role == 'hod':
            # HODs do not see follow-up comments as per updated requirements
            query = TaskHistory.objects.none()
        else:
            # Faculty sees comments on tasks assigned to them
            query = TaskHistory.objects.filter(
                action='updated',
                task__assignments__assignee=user
            ).filter(comment_filter).distinct()
            
        # Execute query with pagination
        total_count = query.count()
        history_entries = query.select_related('task', 'performed_by').order_by('-timestamp')[offset:limit]
        
        # Format comments
        follow_comments = []
        for entry in history_entries:
            # Get comment from either details or comment field
            comment_text = entry.details.get('follow_comment') if entry.details else None
            if not comment_text and entry.comment:
                comment_text = entry.comment
            
            if comment_text:
                follow_comments.append({
                    'id': entry.id,
                    'task_id': entry.task.id,
                    'task_title': entry.task.title,  # Include task title for context
                    'comment': comment_text,
                    'performed_by': entry.performed_by.email if entry.performed_by else 'System',
                    'performed_by_role': entry.performed_by.role if entry.performed_by else None,
                    'timestamp': entry.timestamp,
                })
        
        # Return paginated response
        return Response({
            'follow_comments': follow_comments,
            'pagination': {
                'total': total_count,
                'page': page,
                'page_size': page_size,
                'pages': (total_count + page_size - 1) // page_size  # Ceiling division
            }
        })
        
    except Exception as e:
        logger.error(f"Error in get_all_follow_comments: {str(e)}")
        return Response(
            {'error': 'Failed to fetch comments', 'detail': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )