"""
Phase 1: Add is_admin_assigned boolean to Todo model.

- Adds the field with default=False.
- Backfills rows where assigned_by IS NOT NULL to is_admin_assigned=True.
- Adds composite index (user, is_admin_assigned).
"""
from django.db import migrations, models


def backfill_is_admin_assigned(apps, schema_editor):
    Todo = apps.get_model('todos', 'Todo')
    Todo.objects.filter(assigned_by__isnull=False).update(is_admin_assigned=True)


def reverse_backfill(apps, schema_editor):
    Todo = apps.get_model('todos', 'Todo')
    Todo.objects.all().update(is_admin_assigned=False)


class Migration(migrations.Migration):

    dependencies = [
        ('todos', '0002_adminassignedtask_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='todo',
            name='is_admin_assigned',
            field=models.BooleanField(
                default=False,
                help_text='True if this task was assigned by another user (admin/manager)',
            ),
        ),
        migrations.RunPython(backfill_is_admin_assigned, reverse_backfill),
        migrations.AddIndex(
            model_name='todo',
            index=models.Index(
                fields=['user', 'is_admin_assigned'],
                name='todo_user_is_admin_idx',
            ),
        ),
    ]
