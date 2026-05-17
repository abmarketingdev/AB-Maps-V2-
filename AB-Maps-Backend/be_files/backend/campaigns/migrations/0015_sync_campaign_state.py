# Migration to sync Django's migration state with the actual database
# The created_by field already exists in the database from previous RunPython migrations
# This migration only updates Django's migration state without touching the database
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0014_fix_campaign_area_foreign_keys'),
        ('users', '0004_add_ab_person_id'),
    ]

    operations = [
        # Use SeparateDatabaseAndState to update state without database changes
        migrations.SeparateDatabaseAndState(
            # No database operations - field already exists
            database_operations=[],
            # Only update Django's migration state
            state_operations=[
                migrations.AddField(
                    model_name='campaign',
                    name='created_by',
                    field=models.ForeignKey(
                        help_text='Manager who created this campaign',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='created_campaigns',
                        to='users.manager',
                    ),
                ),
            ],
        ),
    ]

