# Generated manually to remove managers field from Employee model

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_change_manager_to_managers'),
    ]

    operations = [
        # Remove the managers ManyToManyField
        migrations.RemoveField(
            model_name='employee',
            name='managers',
        ),
    ]
