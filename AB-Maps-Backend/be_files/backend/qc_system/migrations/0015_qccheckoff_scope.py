# Scoped QC check-off (default vs siopp_ah)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0014_alter_saleschiefnotifylog_contacts_snapshot'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='qccheckoff',
            name='qc_check_off_user_contact_unique',
        ),
        migrations.AddField(
            model_name='qccheckoff',
            name='scope',
            field=models.CharField(
                choices=[('default', 'Default overview'), ('siopp_ah', 'SI opp / AH overview')],
                db_index=True,
                default='default',
                help_text='Which board/context this check-off applies to',
                max_length=32,
            ),
        ),
        migrations.AddConstraint(
            model_name='qccheckoff',
            constraint=models.UniqueConstraint(
                fields=('user', 'contact', 'scope'),
                name='qc_check_off_user_contact_scope_unique',
            ),
        ),
        migrations.AddIndex(
            model_name='qccheckoff',
            index=models.Index(fields=['user', 'scope'], name='qc_check_off_user_scope_idx'),
        ),
    ]
