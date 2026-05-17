# Generated manually for QC campaign brand color

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("campaigns", "0017_add_manager_to_campaign_employee"),
    ]

    operations = [
        migrations.AddField(
            model_name="campaign",
            name="brand_color_hex",
            field=models.CharField(
                blank=True,
                help_text="Optional QC UI accent color (#RRGGBB), null/empty = default theme",
                max_length=7,
                null=True,
            ),
        ),
    ]
