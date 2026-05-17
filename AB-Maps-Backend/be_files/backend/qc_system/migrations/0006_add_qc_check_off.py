# Per-user check-off of contacts for overview

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0005_multi_category_flags'),
    ]

    operations = [
        migrations.CreateModel(
            name='QCCheckOff',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('checked_at', models.DateTimeField(auto_now_add=True)),
                ('contact', models.ForeignKey(
                    help_text='Contact that was checked off',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='checked_off_by',
                    to='qc_system.qccontact',
                )),
                ('user', models.ForeignKey(
                    help_text='QC user who checked off this contact',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='qc_check_offs',
                    to='users.user',
                )),
            ],
            options={
                'verbose_name': 'QC Check-off',
                'verbose_name_plural': 'QC Check-offs',
                'db_table': 'qc_check_off',
                'ordering': ['-checked_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='qccheckoff',
            constraint=models.UniqueConstraint(
                fields=('user', 'contact'),
                name='qc_check_off_user_contact_unique',
            ),
        ),
        migrations.AddIndex(
            model_name='qccheckoff',
            index=models.Index(fields=['user'], name='qc_check_off_user_id_idx'),
        ),
        migrations.AddIndex(
            model_name='qccheckoff',
            index=models.Index(fields=['contact'], name='qc_check_off_contact_id_idx'),
        ),
    ]
