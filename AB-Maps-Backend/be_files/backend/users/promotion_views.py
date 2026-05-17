"""
Views for user promotion functionality.

This module handles:
1. Promoting Employee to Manager
2. Promoting Manager to Superuser/Admin
"""
import logging
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from users.models import Employee, Manager
from addresses.models import Address
from areas.models import AreaEmployee
from campaigns.models import CampaignEmployee, CampaignForm
from dashboard.models import Activity, Sales, PerformanceMetrics, DashboardSummary, AnalyticsThreshold
from tracking.models import LocationPing
from buildings.models import Building

User = get_user_model()
logger = logging.getLogger(__name__)


class PromotionError(Exception):
    """Custom exception for promotion errors."""
    pass


def is_superuser_permission(request):
    """Check if the requesting user is a superuser."""
    return request.user and request.user.is_authenticated and request.user.is_superuser


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def promote_employee_to_manager(request):
    """
    Promote an Employee to Manager role.
    
    This endpoint:
    1. Creates a new Manager record with employee data
    2. Migrates all foreign key references from Employee to Manager
    3. Updates the User record
    4. Deletes the old Employee record
    
    All operations are wrapped in a transaction for data integrity.
    
    Request Body:
        {
            "employee_id": "uuid-of-employee",
            "reason": "Optional reason for promotion"
        }
    
    Returns:
        {
            "success": true,
            "message": "Employee successfully promoted to Manager",
            "data": {
                "user_id": "...",
                "old_employee_id": "...",
                "new_manager_id": "...",
                "manager": {...},
                "migrated_records": {...},
                "promoted_at": "...",
                "promoted_by": "..."
            }
        }
    """
    # Check if user is superuser
    if not is_superuser_permission(request):
        return Response({
            'success': False,
            'error': 'Only superusers can promote employees to managers',
            'code': 'PERMISSION_DENIED'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get employee_id from request
    employee_id = request.data.get('employee_id')
    reason = request.data.get('reason', '')
    
    if not employee_id:
        return Response({
            'success': False,
            'error': 'employee_id is required',
            'code': 'MISSING_EMPLOYEE_ID'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            # Step 1: Validate Employee exists
            try:
                employee = Employee.objects.get(id=employee_id)
            except Employee.DoesNotExist:
                raise PromotionError('Employee not found')
            
            # Step 2: Check if Employee has a User (optional - not all employees have User accounts)
            user = None
            try:
                user = employee.user
            except User.DoesNotExist:
                logger.info(f"Employee {employee.id} ({employee.name}) does not have a User account. Promotion will proceed without User linking.")
            
            # Step 3: Validate User doesn't already have a Manager (only if user exists)
            if user and user.manager:
                raise PromotionError('User already has a manager role')
            
            # Step 4: Create new Manager record
            new_manager = Manager.objects.create(
                name=employee.name,
                email=employee.email,
                phone=employee.phone,
                status=employee.status if employee.status in ['online', 'offline', 'busy', 'away'] else 'offline',
                is_online=employee.is_online,
                last_seen=employee.last_seen,
                created_at=employee.created_at,  # Preserve original creation date
            )
            
            logger.info(f"Created new Manager {new_manager.id} from Employee {employee.id}")
            
            # Step 5: Track migration counts
            migration_counts = {}
            
            # Step 6: Migrate all foreign key references
            
            # 6.1 Address
            address_count = Address.objects.filter(employee=employee).update(
                manager=new_manager,
                employee=None
            )
            migration_counts['addresses'] = address_count
            logger.info(f"Migrated {address_count} addresses")
            
            # 6.2 AreaEmployee
            area_assignments = AreaEmployee.objects.filter(employee=employee)
            area_count = 0
            for area_assignment in area_assignments:
                area_assignment.employee = None
                area_assignment.manager = new_manager
                area_assignment.save()
                area_count += 1
            migration_counts['area_assignments'] = area_count
            logger.info(f"Migrated {area_count} area assignments")
            
            # 6.3 CampaignEmployee
            campaign_assignments = CampaignEmployee.objects.filter(employee=employee)
            campaign_count = 0
            for campaign_assignment in campaign_assignments:
                campaign_assignment.employee = None
                campaign_assignment.manager = new_manager
                campaign_assignment.save()
                campaign_count += 1
            migration_counts['campaign_assignments'] = campaign_count
            logger.info(f"Migrated {campaign_count} campaign assignments")
            
            # 6.4 Activity
            activity_count = Activity.objects.filter(employee=employee).update(
                manager=new_manager,
                employee=None
            )
            migration_counts['activities'] = activity_count
            logger.info(f"Migrated {activity_count} activities")
            
            # 6.5 Sales
            sales_count = Sales.objects.filter(employee=employee).update(
                manager=new_manager,
                employee=None
            )
            migration_counts['sales'] = sales_count
            logger.info(f"Migrated {sales_count} sales records")
            
            # 6.6 PerformanceMetrics
            metrics_count = PerformanceMetrics.objects.filter(employee=employee).update(
                manager=new_manager,
                employee=None
            )
            migration_counts['performance_metrics'] = metrics_count
            logger.info(f"Migrated {metrics_count} performance metrics")
            
            # 6.7 DashboardSummary
            summary_count = DashboardSummary.objects.filter(employee=employee).update(
                manager=new_manager,
                employee=None
            )
            migration_counts['dashboard_summaries'] = summary_count
            logger.info(f"Migrated {summary_count} dashboard summaries")
            
            # 6.8 LocationPing (SET_NULL, so just update)
            ping_count = LocationPing.objects.filter(employee=employee).update(
                manager=new_manager,
                employee=None
            )
            migration_counts['location_pings'] = ping_count
            logger.info(f"Migrated {ping_count} location pings")
            
            # 6.9 Building (SET_NULL, so just update)
            building_count = Building.objects.filter(created_by_employee=employee).update(
                created_by=new_manager,
                created_by_employee=None
            )
            migration_counts['buildings'] = building_count
            logger.info(f"Migrated {building_count} buildings")
            
            # 6.10 AnalyticsThreshold
            threshold_count = AnalyticsThreshold.objects.filter(employee=employee).update(
                manager=new_manager,
                employee=None
            )
            migration_counts['analytics_thresholds'] = threshold_count
            logger.info(f"Migrated {threshold_count} analytics thresholds")
            
            # 6.11 CampaignForm.sales_rep_id (UUID field, not ForeignKey)
            form_count = CampaignForm.objects.filter(sales_rep_id=employee.id).update(
                sales_rep_id=new_manager.id
            )
            migration_counts['campaign_forms'] = form_count
            logger.info(f"Migrated {form_count} campaign forms")
            
            # 6.12 TeamMember - Delete team memberships (TeamMember only has employee, no manager)
            # Managers typically don't belong to teams in the same way employees do
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM team_member WHERE employee_id = %s",
                    [str(employee.id)]
                )
                team_member_count = cursor.rowcount
            migration_counts['team_members'] = team_member_count
            logger.info(f"Deleted {team_member_count} team member records")
            
            # Note: TimeTracking is NOT migrated - it only has employee field and represents
            # historical work time when the person was an employee. We keep it as-is.
            
            # Step 7: Update User record (only if user exists)
            if user:
                user.manager = new_manager
                user.employee = None
                user.save()
                logger.info(f"Updated User {user.id} to reference Manager {new_manager.id}")
            else:
                logger.info(f"No User account to update for Employee {employee.id}")
            
            # Step 8: Delete old Employee record
            old_employee_id = str(employee.id)
            employee.delete()
            logger.info(f"Deleted old Employee {old_employee_id}")
            
            # Step 9: Log the promotion
            Activity.objects.create(
                manager=new_manager,
                activity_type='status_change',
                description=f'Promoted from Employee to Manager. Reason: {reason}',
                metadata={
                    'old_employee_id': old_employee_id,
                    'new_manager_id': str(new_manager.id),
                    'promoted_by': str(request.user.id),
                    'reason': reason,
                    'migration_counts': migration_counts
                }
            )
            
            # Step 10: Return success response
            response_data = {
                'user_id': str(user.id) if user else None,
                'old_employee_id': old_employee_id,
                'new_manager_id': str(new_manager.id),
                'has_user_account': user is not None,
                'manager': {
                    'id': str(new_manager.id),
                    'name': new_manager.name,
                    'email': new_manager.email,
                    'phone': new_manager.phone,
                    'status': new_manager.status,
                    'created_at': new_manager.created_at.isoformat(),
                },
                'migrated_records': migration_counts,
                'promoted_at': timezone.now().isoformat(),
                'promoted_by': str(request.user.id),
                'reason': reason
            }
            
            message = 'Employee successfully promoted to Manager'
            if not user:
                message += ' (Note: Employee had no User account - no login credentials were migrated)'
            
            return Response({
                'success': True,
                'message': message,
                'data': response_data
            }, status=status.HTTP_200_OK)
            
    except PromotionError as e:
        logger.error(f"Promotion error: {str(e)}")
        return Response({
            'success': False,
            'error': str(e),
            'code': 'PROMOTION_ERROR'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.exception(f"Unexpected error during promotion: {str(e)}")
        return Response({
            'success': False,
            'error': f'An unexpected error occurred: {str(e)}',
            'code': 'INTERNAL_ERROR'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def promote_manager_to_superuser(request):
    """
    Promote a Manager to Superuser/Admin role.
    
    This endpoint:
    1. Validates the Manager exists and has a User account
    2. Sets is_staff and is_superuser flags to True
    3. Logs the promotion
    
    Request Body:
        {
            "manager_id": "uuid-of-manager",
            "reason": "Optional reason for promotion"
        }
    
    Returns:
        {
            "success": true,
            "message": "Manager successfully promoted to Superuser",
            "data": {
                "user_id": "...",
                "manager_id": "...",
                "manager": {...},
                "permissions": {...},
                "promoted_at": "...",
                "promoted_by": "..."
            }
        }
    """
    # Check if user is superuser
    if not is_superuser_permission(request):
        return Response({
            'success': False,
            'error': 'Only superusers can promote managers to superusers',
            'code': 'PERMISSION_DENIED'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get manager_id from request - frontend sends this field but the value
    # could be either a Manager table ID or a User table ID
    manager_id = request.data.get('manager_id') or request.data.get('user_id')
    reason = request.data.get('reason', '')
    # Optional: username and password to create a User if one doesn't exist
    username = request.data.get('username', '')
    password = request.data.get('password', '')
    
    if not manager_id:
        return Response({
            'success': False,
            'error': 'manager_id is required',
            'code': 'MISSING_MANAGER_ID'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            # Step 1: Resolve to Manager - the ID could be from Manager table or User table
            manager = None
            try:
                manager = Manager.objects.get(id=manager_id)
            except Manager.DoesNotExist:
                # ID not in Manager table - try User table (frontend may send user_id as manager_id)
                try:
                    target_user = User.objects.get(id=manager_id)
                    if not target_user.manager_id:
                        raise PromotionError('User does not have an associated manager profile')
                    manager = target_user.manager
                    logger.info(f"Resolved user_id {manager_id} to manager_id {manager.id}")
                except User.DoesNotExist:
                    raise PromotionError('Manager not found with the provided ID')
            
            # Step 2: Check if Manager has a User account
            user = None
            user_created = False
            try:
                user = manager.user
            except User.DoesNotExist:
                pass
            
            # Step 3: If no User, create one (requires username and password)
            if not user:
                if not username or not password:
                    return Response({
                        'success': False,
                        'error': 'This manager does not have a user account. To promote to superuser, you must provide "username" and "password" fields to create a login account.',
                        'code': 'USER_ACCOUNT_REQUIRED',
                        'details': {
                            'manager_id': str(manager.id),
                            'manager_name': manager.name,
                            'manager_email': manager.email,
                            'hint': 'Include "username" and "password" in your request body to create a user account for this manager.'
                        }
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Validate username is unique
                if User.objects.filter(username=username).exists():
                    return Response({
                        'success': False,
                        'error': f'Username "{username}" is already taken. Please choose a different username.',
                        'code': 'USERNAME_TAKEN'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Create User account
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    email=manager.email or '',
                    manager=manager,
                    is_staff=True,
                    is_superuser=True
                )
                user_created = True
                logger.info(f"Created new User account '{username}' for Manager {manager.id}")
            else:
                # Step 4: Check if already superuser
                if user.is_superuser and user.is_staff:
                    return Response({
                        'success': False,
                        'error': 'Manager is already a superuser',
                        'code': 'ALREADY_SUPERUSER'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Step 5: Promote existing user to superuser
                user.is_staff = True
                user.is_superuser = True
                user.save()
            
            logger.info(f"Promoted Manager {manager.id} (User {user.id}) to Superuser")
            
            # Step 6: Log the promotion
            Activity.objects.create(
                manager=manager,
                activity_type='status_change',
                description=f'Promoted to Superuser/Admin. Reason: {reason}',
                metadata={
                    'manager_id': str(manager.id),
                    'user_id': str(user.id),
                    'promoted_by': str(request.user.id),
                    'reason': reason,
                    'user_created': user_created,
                    'permissions': {
                        'is_staff': True,
                        'is_superuser': True
                    }
                }
            )
            
            # Step 7: Return success response
            message = 'Manager successfully promoted to Superuser'
            if user_created:
                message += f' (New user account "{username}" was created)'
            
            return Response({
                'success': True,
                'message': message,
                'data': {
                    'user_id': str(user.id),
                    'manager_id': str(manager.id),
                    'user_created': user_created,
                    'username': user.username,
                    'manager': {
                        'id': str(manager.id),
                        'name': manager.name,
                        'email': manager.email,
                        'phone': manager.phone,
                        'status': manager.status,
                    },
                    'permissions': {
                        'is_staff': user.is_staff,
                        'is_superuser': user.is_superuser,
                    },
                    'promoted_at': timezone.now().isoformat(),
                    'promoted_by': str(request.user.id),
                    'reason': reason
                }
            }, status=status.HTTP_200_OK)
            
    except PromotionError as e:
        logger.error(f"Promotion error: {str(e)}")
        return Response({
            'success': False,
            'error': str(e),
            'code': 'PROMOTION_ERROR'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.exception(f"Unexpected error during promotion: {str(e)}")
        return Response({
            'success': False,
            'error': f'An unexpected error occurred: {str(e)}',
            'code': 'INTERNAL_ERROR'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def demote_superuser_to_manager(request):
    """
    Demote a Superuser back to regular Manager role.
    
    This endpoint:
    1. Validates the Manager exists and has a User account
    2. Sets is_staff and is_superuser flags to False
    3. Logs the demotion
    
    Request Body:
        {
            "manager_id": "uuid-of-manager",
            "reason": "Optional reason for demotion"
        }
    
    Returns:
        {
            "success": true,
            "message": "Superuser successfully demoted to Manager",
            "data": {...}
        }
    """
    # Check if user is superuser
    if not is_superuser_permission(request):
        return Response({
            'success': False,
            'error': 'Only superusers can demote other superusers',
            'code': 'PERMISSION_DENIED'
        }, status=status.HTTP_403_FORBIDDEN)
    
    # Get manager_id from request - frontend sends this field but the value
    # could be either a Manager table ID or a User table ID
    manager_id = request.data.get('manager_id') or request.data.get('user_id')
    reason = request.data.get('reason', '')
    
    if not manager_id:
        return Response({
            'success': False,
            'error': 'manager_id is required',
            'code': 'MISSING_MANAGER_ID'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        with transaction.atomic():
            # Step 1: Resolve to Manager - the ID could be from Manager table or User table
            manager = None
            try:
                manager = Manager.objects.get(id=manager_id)
            except Manager.DoesNotExist:
                # ID not in Manager table - try User table (frontend may send user_id as manager_id)
                try:
                    target_user = User.objects.get(id=manager_id)
                    if not target_user.manager_id:
                        raise PromotionError('User does not have an associated manager profile')
                    manager = target_user.manager
                    logger.info(f"Resolved user_id {manager_id} to manager_id {manager.id}")
                except User.DoesNotExist:
                    raise PromotionError('Manager not found with the provided ID')
            
            # Step 2: Validate Manager has a User
            user = None
            try:
                user = manager.user
            except User.DoesNotExist:
                raise PromotionError('Manager does not have an associated user account. Cannot demote a manager who has no login credentials.')
            
            # Step 3: Check if not a superuser
            if not user.is_superuser and not user.is_staff:
                return Response({
                    'success': False,
                    'error': 'Manager is not a superuser',
                    'code': 'NOT_SUPERUSER'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Step 4: Prevent self-demotion
            if user.id == request.user.id:
                return Response({
                    'success': False,
                    'error': 'You cannot demote yourself',
                    'code': 'SELF_DEMOTION_FORBIDDEN'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Step 5: Demote from superuser
            user.is_staff = False
            user.is_superuser = False
            user.save()
            
            logger.info(f"Demoted Manager {manager.id} (User {user.id}) from Superuser")
            
            # Step 6: Log the demotion
            Activity.objects.create(
                manager=manager,
                activity_type='status_change',
                description=f'Demoted from Superuser/Admin to Manager. Reason: {reason}',
                metadata={
                    'manager_id': str(manager.id),
                    'user_id': str(user.id),
                    'demoted_by': str(request.user.id),
                    'reason': reason,
                    'permissions': {
                        'is_staff': False,
                        'is_superuser': False
                    }
                }
            )
            
            # Step 7: Return success response
            return Response({
                'success': True,
                'message': 'Superuser successfully demoted to Manager',
                'data': {
                    'user_id': str(user.id),
                    'manager_id': str(manager.id),
                    'manager': {
                        'id': str(manager.id),
                        'name': manager.name,
                        'email': manager.email,
                        'phone': manager.phone,
                        'status': manager.status,
                    },
                    'permissions': {
                        'is_staff': user.is_staff,
                        'is_superuser': user.is_superuser,
                    },
                    'demoted_at': timezone.now().isoformat(),
                    'demoted_by': str(request.user.id),
                    'reason': reason
                }
            }, status=status.HTTP_200_OK)
            
    except PromotionError as e:
        logger.error(f"Demotion error: {str(e)}")
        return Response({
            'success': False,
            'error': str(e),
            'code': 'DEMOTION_ERROR'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    except Exception as e:
        logger.exception(f"Unexpected error during demotion: {str(e)}")
        return Response({
            'success': False,
            'error': f'An unexpected error occurred: {str(e)}',
            'code': 'INTERNAL_ERROR'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
