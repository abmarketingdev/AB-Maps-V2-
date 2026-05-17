# Generated migration to add apartment_count field to Area model

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('areas', '0004_sync_areaemployee_state'),
    ]

    operations = [
        migrations.AddField(
            model_name='area',
            name='apartment_count',
            field=models.IntegerField(default=0, help_text='Total number of apartments in this area'),
        ),
    ]

