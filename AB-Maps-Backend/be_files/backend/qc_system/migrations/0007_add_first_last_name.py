# Add first_name and last_name for cards and NRC (full name display)

from django.db import migrations, models


def populate_first_last_from_customer_name(apps, schema_editor):
    """Set first_name/last_name from customer_name: split on first space, or all in first_name."""
    QCContact = apps.get_model('qc_system', 'QCContact')
    QCHistory = apps.get_model('qc_system', 'QCHistory')
    for c in QCContact.objects.all():
        name = (c.customer_name or '').strip()
        if name:
            parts = name.split(None, 1)  # max 1 split: first word, rest
            c.first_name = parts[0]
            c.last_name = parts[1] if len(parts) > 1 else ''
        else:
            c.first_name = ''
            c.last_name = ''
        c.save(update_fields=['first_name', 'last_name'])
    for h in QCHistory.objects.all():
        name = (h.customer_name or '').strip()
        if name:
            parts = name.split(None, 1)
            h.first_name = parts[0]
            h.last_name = parts[1] if len(parts) > 1 else ''
        else:
            h.first_name = ''
            h.last_name = ''
        h.save(update_fields=['first_name', 'last_name'])


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0006_add_qc_check_off'),
    ]

    operations = [
        migrations.AddField(
            model_name='qccontact',
            name='first_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='qccontact',
            name='last_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='qchistory',
            name='first_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='qchistory',
            name='last_name',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.RunPython(populate_first_last_from_customer_name, migrations.RunPython.noop),
    ]
