# Generated manually for QC user_added_import_date

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0007_add_first_last_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='qccontact',
            name='user_added_import_date',
            field=models.DateField(
                blank=True,
                db_index=True,
                help_text='User-specified sale/batch date at CSV import',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='importrecord',
            name='user_added_import_date',
            field=models.DateField(
                blank=True,
                help_text='Sale/batch date provided by user for this import',
                null=True,
            ),
        ),
    ]
