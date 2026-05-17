# Migration to sync Django's migration state with the actual database
# The fields already exist in the database from previous RunPython migrations
# This migration only updates Django's migration state without touching the database
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('areas', '0003_fix_area_employee_foreign_keys'),
        ('users', '0004_add_ab_person_id'),
    ]

    operations = [
        # Use SeparateDatabaseAndState to update state without database changes
        migrations.SeparateDatabaseAndState(
            # No database operations - fields already exist
            database_operations=[],
            # Only update Django's migration state
            state_operations=[
                migrations.AddField(
                    model_name='areaemployee',
                    name='area',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to='areas.area',
                        related_name='area_employees',
                    ),
                ),
                migrations.AddField(
                    model_name='areaemployee',
                    name='employee',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to='users.employee',
                        related_name='area_assignments',
                    ),
                ),
            ],
        ),
    ]

