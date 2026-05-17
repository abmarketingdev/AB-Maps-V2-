# Team Deletion Manager Cleanup Fix

## Problem Description

When deleting a team in the AB Maps sales dashboard, the `manager_id` field in the employee table was not being set to null for employees who were part of the deleted team. This caused employees to retain references to managers they were no longer associated with.

## Root Cause

The issue occurred because:

1. **Team Deletion Logic**: The `TeamViewSet.destroy()` method only deleted the team without any cleanup logic for employee manager assignments.

2. **Employee Manager Relationship**: The `Employee` model has a `manager` field with `on_delete=models.SET_NULL`, but this only triggers when the **Manager** object itself is deleted, not when a **Team** is deleted.

3. **Missing Cleanup**: When a team was deleted, the system didn't check if employees needed their `manager_id` reset to null.

## Solution Implemented

### Signal-Based Approach (Recommended)

Added a Django signal handler in `be_files/backend/teams/signals.py` that automatically cleans up employee manager assignments when a team is deleted:

```python
@receiver(post_delete, sender=Team)
def cleanup_employee_managers_on_team_delete(sender, instance, **kwargs):
    """
    Signal handler to clean up employee manager assignments when a team is deleted.
    Sets employee.manager to None if they're no longer part of any teams managed by the same manager.
    """
    if instance.manager:
        # Get all employees that were in the deleted team
        team_employees = instance.members.all()
        
        for employee in team_employees:
            # Check if this employee is still part of any other teams managed by the same manager
            other_teams_with_same_manager = Team.objects.filter(
                manager=instance.manager,
                members=employee
            ).exclude(id=instance.id)  # Exclude the deleted team
            
            # If employee has no other teams with this manager, set manager_id to null
            if not other_teams_with_same_manager.exists() and employee.manager == instance.manager:
                employee.manager = None
                employee.save(update_fields=['manager'])
```

### Signal Registration

Updated `be_files/backend/teams/apps.py` to ensure signals are loaded:

```python
class TeamsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'teams'

    def ready(self):
        """Import signals when the app is ready."""
        import teams.signals
```

## How It Works

1. **Automatic Trigger**: When a team is deleted, the `post_delete` signal is automatically triggered.

2. **Employee Check**: The signal handler checks all employees that were part of the deleted team.

3. **Manager Validation**: For each employee, it verifies if they're still part of any other teams managed by the same manager.

4. **Cleanup**: If an employee has no remaining teams with that manager, their `manager_id` is set to null.

## Benefits

- **Automatic**: No manual intervention required
- **Reliable**: Works regardless of how the team is deleted (API, admin, etc.)
- **Safe**: Only affects employees who are truly no longer associated with the manager
- **Efficient**: Uses database queries to check remaining team associations

## Testing

A test script `test_team_deletion_fix.py` has been created to verify the fix works correctly. The test:

1. Creates managers, employees, and teams
2. Assigns employees to multiple teams
3. Deletes teams and verifies manager assignments are properly cleaned up
4. Ensures employees in multiple teams keep their manager until all teams are deleted

## Files Modified

- `be_files/backend/teams/signals.py` (new file)
- `be_files/backend/teams/apps.py` (updated)
- `test_team_deletion_fix.py` (new test file)
- `TEAM_DELETION_FIX.md` (this documentation)

## Deployment Notes

After deploying this fix:

1. The signal will automatically handle all future team deletions
2. Existing data inconsistencies (if any) may need manual cleanup
3. No database migrations are required
4. The fix is backward compatible 