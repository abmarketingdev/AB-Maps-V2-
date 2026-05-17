import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0017_add_utmeldt'),
        ('campaigns', '__first__'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('timestamp', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('action_type', models.CharField(
                    choices=[
                        ('call_outcome',     'Call Outcome'),
                        ('si_opp_flag',      'Si Opp Flagged'),
                        ('utmeldt_flag',     'Utmeldt Flagged'),
                        ('comment_edit',     'Comment Edited'),
                        ('bulk_transfer',    'Bulk Transfer'),
                        ('urgent_set',       'Urgent Flag Set'),
                        ('urgent_cleared',   'Urgent Flag Cleared'),
                        ('login',            'Login'),
                        ('logout',           'Logout'),
                        ('import_started',   'Import Started'),
                        ('import_completed', 'Import Completed'),
                        ('settings_changed', 'Settings Changed'),
                    ],
                    db_index=True,
                    max_length=32,
                )),
                ('status', models.CharField(
                    choices=[('success', 'Success'), ('error', 'Error'), ('flagged', 'Flagged')],
                    default='success',
                    max_length=16,
                )),
                ('agent_name', models.CharField(blank=True, max_length=128)),
                ('agent_id_code', models.CharField(blank=True, max_length=32)),
                ('customer_name', models.CharField(blank=True, max_length=256)),
                ('phone_number', models.CharField(blank=True, max_length=32)),
                ('details', models.JSONField(default=dict)),
                ('agent', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='audit_events',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('contact', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='audit_events',
                    to='qc_system.qccontact',
                )),
                ('campaign', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='audit_events',
                    to='campaigns.campaign',
                )),
            ],
            options={
                'verbose_name': 'Audit Event',
                'verbose_name_plural': 'Audit Events',
                'db_table': 'qc_audit_event',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='auditevent',
            index=models.Index(fields=['agent', 'timestamp'], name='qc_audit_agent_ts'),
        ),
        migrations.AddIndex(
            model_name='auditevent',
            index=models.Index(fields=['action_type', 'timestamp'], name='qc_audit_type_ts'),
        ),
        migrations.AddIndex(
            model_name='auditevent',
            index=models.Index(fields=['contact', 'timestamp'], name='qc_audit_contact_ts'),
        ),
        migrations.AddIndex(
            model_name='auditevent',
            index=models.Index(fields=['campaign', 'timestamp'], name='qc_audit_campaign_ts'),
        ),
    ]
