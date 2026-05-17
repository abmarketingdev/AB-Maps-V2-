# Generated manually for ab_person_id feature
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_remove_managers_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='ab_person_id',
            field=models.CharField(
                blank=True,
                help_text='4-digit unique person ID (manually set by admin)',
                max_length=4,
                null=True,
                unique=True
            ),
        ),
    ]

