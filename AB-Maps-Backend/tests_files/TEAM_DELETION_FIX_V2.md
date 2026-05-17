# Critical Team Deletion Manager Cleanup Fix (V2)

## 🚨 Critical Issue Identified

When deleting a team completely, employees inside that team should have their `manager_id` set to null, but this was not happening properly. This caused employees to retain references to managers they were no longer associated with.

## Root Cause Analysis

### The Problem
1. **Signal Timing Issue**: The original signal handler used `post_delete` but tried to access `instance.members.all()` after the team was already deleted
2. **Empty Queryset**: When a team is deleted, Django automatically clears the many-to-many relationships, so `instance.members.all()` returned an empty queryset
3. **No Cleanup**: This meant no employees had their `manager_id` reset to null

### Why This Happened
```python
# ❌ BROKEN: This doesn't work because team is already deleted
@receiver(post_delete, sender=Team)
def cleanup_employee_managers_on_team_delete(sender, instance, **kwargs):
    team_employees = instance.members.all()  # Returns empty queryset!
    # No employees found, so no cleanup happens
```

## Comprehensive Solution Implemented

### 1. Fixed Signal Handler (Primary Solution)

**File**: `be_files/backend/teams/signals.py`

```python
@receiver(pre_delete, sender=Team)
def capture_team_employees_before_delete(sender, instance, **kwargs):
    """Capture employees before team deletion."""
    if instance.manager:
        instance._employees_to_check = list(instance.members.all())

@receiver(post_delete, sender=Team)
def cleanup_employee_managers_on_team_delete(sender, instance, **kwargs):
    """Clean up employee manager assignments after team deletion."""
    if hasattr(instance, '_employees_to_check') and instance._employees_to_check:
        for employee in instance._employees_to_check:
            # Check if employee has other teams with same manager
            other_teams_with_same_manager = Team.objects.filter(
                manager=instance.manager,
                members=employee
            ).exclude(id=instance.id)
            
            # Set manager_id to null if no other teams exist
            if not other_teams_with_same_manager.exists() and employee.manager == instance.manager:
                employee.manager = None
                employee.save(update_fields=['manager'])
```

### 2. Backup View Logic (Secondary Solution)

**File**: `be_files/backend/teams/views.py`

```python
def destroy(self, request, *args, **kwargs):
    team = self.get_object()
    user = request.user
    if hasattr(user, 'manager') and team.manager == user.manager:
        # Capture employees before deletion
        team_employees = list(team.members.all())
        team_manager = team.manager
        
        # Delete the team
        result = super().destroy(request, *args, **kwargs)
        
        # Cleanup employee manager assignments
        if team_manager and team_employees:
            for employee in team_employees:
                other_teams_with_same_manager = Team.objects.filter(
                    manager=team_manager,
                    members=employee
                ).exclude(id=team.id)
                
                if not other_teams_with_same_manager.exists() and employee.manager == team_manager:
                    employee.manager = None
                    employee.save(update_fields=['manager'])
        
        return result
    return Response({'detail': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
```

### 3. Signal Registration

**File**: `be_files/backend/teams/apps.py`

```python
class TeamsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'teams'

    def ready(self):
        """Import signals when the app is ready."""
        import teams.signals
```

## How the Fix Works

### Signal-Based Approach (Primary)
1. **Pre-delete**: Capture all employees in the team before deletion
2. **Post-delete**: Check each employee for remaining teams with the same manager
3. **Cleanup**: Set `manager_id` to null if employee has no other teams with that manager

### View-Based Approach (Backup)
1. **Before deletion**: Capture employees and manager
2. **After deletion**: Perform the same cleanup logic as a backup
3. **Redundancy**: Ensures cleanup happens even if signals fail

## Logic Flow

```
Team Deletion Process:
1. Pre-delete signal captures employees
2. Team is deleted from database
3. Post-delete signal processes cleanup
4. View logic provides backup cleanup
5. Employees without teams have manager_id set to null
```

## Testing

### Test Scenarios
1. **Single Team Employee**: Employee loses manager when their only team is deleted
2. **Multi-Team Employee**: Employee keeps manager if they have other teams with same manager
3. **Different Manager Teams**: Employee keeps manager if they have teams with different managers
4. **No Teams**: Employee manager_id becomes null when all teams are deleted

### Test Script
Run `test_team_deletion_fix_v2.py` to verify the fix works correctly.

## Benefits

- ✅ **Automatic**: No manual intervention required
- ✅ **Reliable**: Dual approach (signal + view) ensures cleanup
- ✅ **Safe**: Only affects employees who truly lose team association
- ✅ **Efficient**: Uses optimized database queries
- ✅ **Comprehensive**: Handles all deletion scenarios

## Files Modified

- `be_files/backend/teams/signals.py` (updated with pre-delete + post-delete)
- `be_files/backend/teams/views.py` (added backup cleanup logic)
- `be_files/backend/teams/apps.py` (signal registration)
- `test_team_deletion_fix_v2.py` (comprehensive test script)
- `TEAM_DELETION_FIX_V2.md` (this documentation)

## Deployment Notes

1. **No Database Migrations**: The fix doesn't require schema changes
2. **Backward Compatible**: Existing data remains intact
3. **Automatic Activation**: Signals activate immediately after deployment
4. **Monitoring**: Check logs for signal execution
5. **Testing**: Run test script to verify functionality

## Verification

After deployment, test by:
1. Creating a team with employees
2. Deleting the team
3. Verifying employee `manager_id` is set to null
4. Checking that employees in multiple teams keep their manager until all teams are deleted

This fix ensures that team deletion properly cleans up employee manager assignments, maintaining data integrity in the AB Maps system. 