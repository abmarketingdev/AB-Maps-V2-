from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0012_importrecord_list_name_importrecord_list_slug_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SalesChiefNotifyLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('sent_by_name', models.CharField(blank=True, help_text='Snapshot of sender name', max_length=255)),
                ('sales_chief_name', models.CharField(blank=True, max_length=255)),
                ('sales_chief_email', models.EmailField(blank=True, help_text='Snapshot of recipient email at send time', max_length=254)),
                ('contact_count', models.IntegerField(default=0)),
                ('contacts_snapshot', models.JSONField(default=list, help_text='Snapshot list of contact dicts at send time')),
                ('sent_at', models.DateTimeField(auto_now_add=True)),
                ('sent_by', models.ForeignKey(
                    blank=True,
                    help_text='QC admin who triggered the email',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='qc_notify_logs_sent',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('sales_chief', models.ForeignKey(
                    blank=True,
                    help_text='Sales chief the email was sent to',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='qc_notify_logs_received',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Sales Chief Notify Log',
                'verbose_name_plural': 'Sales Chief Notify Logs',
                'db_table': 'qc_sales_chief_notify_log',
                'ordering': ['-sent_at'],
            },
        ),
        migrations.AddIndex(
            model_name='saleschiefnotifylog',
            index=models.Index(fields=['sent_by', 'sent_at'], name='qc_notify_log_sent_by_at'),
        ),
        migrations.AddIndex(
            model_name='saleschiefnotifylog',
            index=models.Index(fields=['sales_chief', 'sent_at'], name='qc_notify_log_chief_at'),
        ),
        migrations.AddIndex(
            model_name='saleschiefnotifylog',
            index=models.Index(fields=['sent_at'], name='qc_notify_log_sent_at'),
        ),
    ]
