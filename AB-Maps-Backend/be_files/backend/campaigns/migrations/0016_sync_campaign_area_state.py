# Migration to sync Django's migration state with the actual database
# The fields already exist in the database from previous RunPython migrations
# This migration only updates Django's migration state without touching the database
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0015_sync_campaign_state'),
        ('areas', '0004_sync_areaemployee_state'),
    ]

    operations = [
        # Use SeparateDatabaseAndState to update state without database changes
        migrations.SeparateDatabaseAndState(
            # No database operations - fields already exist
            database_operations=[],
            # Only update Django's migration state
            state_operations=[
                migrations.AddField(
                    model_name='campaignarea',
                    name='campaign',
                    field=models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, 
                        to='campaigns.campaign',
                    ),
                ),
                migrations.AddField(
                    model_name='campaignarea',
                    name='area',
                    field=models.ForeignKey(
                        db_column='area_id',
                        on_delete=django.db.models.deletion.CASCADE,
                        to='areas.area',
                    ),
                ),
                migrations.AlterUniqueTogether(
                    name='campaignarea',
                    unique_together={('campaign', 'area')},
                ),
            ],
        ),
    ]

