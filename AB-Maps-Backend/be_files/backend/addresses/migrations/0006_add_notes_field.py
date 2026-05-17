# Generated manually for addresses app - add notes field
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('addresses', '0005_tile_optimizations'),
    ]

    operations = [
        migrations.AddField(
            model_name='address',
            name='notes',
            field=models.TextField(
                blank=True,
                null=True,
                max_length=2000,
                help_text='User notes about this address (e.g., visit details, follow-up actions)'
            ),
        ),
    ]

