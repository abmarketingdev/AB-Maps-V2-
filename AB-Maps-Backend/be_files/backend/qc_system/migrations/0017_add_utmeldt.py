from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0016_rename_qc_check_off_user_scope_idx_qc_check_of_user_id_bf284c_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='qccontact',
            name='is_utmeldt',
            field=models.BooleanField(default=False, help_text='Also appears in Utmeldt list'),
        ),
        migrations.AlterField(
            model_name='qccontact',
            name='status',
            field=models.CharField(
                choices=[
                    ('til_behandling', 'To be processed'),
                    ('forste_oppring', 'First call attempt'),
                    ('andre_oppring', 'Second call attempt'),
                    ('tredje_oppring', 'Third call attempt'),
                    ('si_opp', 'Cancellation requested'),
                    ('negativ_tilbakemelding', 'Negative feedback'),
                    ('positiv_tilbakemelding', 'Positive feedback'),
                    ('other_inquiries', 'Other inquiries'),
                    ('noeytral_tilbakemelding', 'Neutral'),
                    ('giverinspill', 'Giverinspill'),
                    ('reservert', 'Reserved'),
                    ('utmeldt', 'Unsubscribed / cancelled themselves'),
                ],
                db_index=True,
                default='til_behandling',
                help_text='Current workflow status',
                max_length=50,
            ),
        ),
    ]
