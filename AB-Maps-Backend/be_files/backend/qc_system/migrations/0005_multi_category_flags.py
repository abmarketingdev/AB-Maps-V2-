# Multi-category flags so a contact can appear in multiple lists (Giverinnspill + Oppsigelse etc.)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0004_add_qc_favourite'),
    ]

    operations = [
        migrations.AddField(
            model_name='qccontact',
            name='is_oppsigelse',
            field=models.BooleanField(default=False, help_text='Also appears in Oppsigelser list'),
        ),
        migrations.AddField(
            model_name='qccontact',
            name='is_giverinspill',
            field=models.BooleanField(default=False, help_text='Also appears in Giverinnspill list'),
        ),
        migrations.AddField(
            model_name='qccontact',
            name='is_ris',
            field=models.BooleanField(default=False, help_text='Also appears in Ris (negative) list'),
        ),
        migrations.AddField(
            model_name='qccontact',
            name='is_noeytral',
            field=models.BooleanField(default=False, help_text='Also appears in Nøytral list'),
        ),
        migrations.AddField(
            model_name='qccontact',
            name='is_annen',
            field=models.BooleanField(default=False, help_text='Also appears in Andre henvendelser list'),
        ),
        migrations.AddField(
            model_name='qccontact',
            name='is_positiv',
            field=models.BooleanField(default=False, help_text='Also appears in Positiv/Ros list'),
        ),
        migrations.AddField(
            model_name='qccontact',
            name='is_reservert',
            field=models.BooleanField(default=False, help_text='Also appears in Reservert list'),
        ),
    ]
