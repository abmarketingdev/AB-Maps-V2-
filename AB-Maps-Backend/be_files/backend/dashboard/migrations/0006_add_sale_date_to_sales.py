# Add sale_date to Sales for registration date (display and filtering)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('dashboard', '0005_update_analytics_report_recipient_email'),
    ]

    operations = [
        migrations.AddField(
            model_name='sales',
            name='sale_date',
            field=models.DateField(
                blank=True,
                help_text='Registration date of the sale (when the sale was made). Used for display and date filtering; if null, created_at is used.',
                null=True,
            ),
        ),
    ]
