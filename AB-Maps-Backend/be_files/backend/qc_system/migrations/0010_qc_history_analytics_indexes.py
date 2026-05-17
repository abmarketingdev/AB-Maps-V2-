# Generated manually for QC admin analytics queries.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0009_qctransferrequest_qctransferrequestitem_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='qchistory',
            index=models.Index(
                fields=['contact', 'created_at'],
                name='qc_history_contact_created',
            ),
        ),
        migrations.AddIndex(
            model_name='qchistory',
            index=models.Index(
                fields=['qc_agent', 'created_at'],
                name='qc_history_agent_created',
            ),
        ),
    ]
