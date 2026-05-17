from django.db import migrations, models
from django.utils import timezone
from datetime import timedelta


def set_default_dates(apps, schema_editor):
    """Set default dates for existing areas."""
    Area = apps.get_model('areas', 'Area')
    for area in Area.objects.all():
        if not area.start_date:
            area.start_date = area.created_at
        if not area.end_date:
            # Set end_date to 1 year from creation (adjust as needed)
            area.end_date = area.created_at + timedelta(days=365)
        area.save()


class Migration(migrations.Migration):

    dependencies = [
        ('areas', '0007_add_polygon_geography_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='area',
            name='start_date',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='area',
            name='end_date',
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.RunPython(set_default_dates, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='area',
            name='end_date',
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name='area',
            name='start_date',
            field=models.DateTimeField(null=True, blank=True),
        ),
    ]

