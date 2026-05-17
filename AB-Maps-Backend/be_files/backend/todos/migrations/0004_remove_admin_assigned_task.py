"""
Phase 4: Remove AdminAssignedTask model and the admin_assigned_task FK from Todo.

Steps:
1. Remove the index on (admin_assigned_task, status).
2. Remove the admin_assigned_task FK from Todo.
3. Delete the AdminAssignedTask table.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0003_add_is_admin_assigned'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='todo',
            name='todo_admin_a_882ad5_idx',
        ),
        migrations.RemoveField(
            model_name='todo',
            name='admin_assigned_task',
        ),
        migrations.DeleteModel(
            name='AdminAssignedTask',
        ),
    ]
