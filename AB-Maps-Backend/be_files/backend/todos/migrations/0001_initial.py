# Generated manually for todos app

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('addresses', '0006_add_notes_field'),
        ('campaigns', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Todo',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(help_text='Task title', max_length=255)),
                ('description', models.TextField(blank=True, help_text='Detailed description (optional)')),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('in_progress', 'In Progress'),
                        ('completed', 'Completed')
                    ],
                    default='pending',
                    max_length=20
                )),
                ('priority', models.CharField(
                    choices=[
                        ('low', 'Low'),
                        ('medium', 'Medium'),
                        ('high', 'High')
                    ],
                    default='medium',
                    max_length=20
                )),
                ('deadline', models.DateTimeField(blank=True, help_text='Task deadline (optional)', null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('related_address', models.ForeignKey(
                    blank=True,
                    help_text='Optional: Address this task relates to',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='todos',
                    to='addresses.address'
                )),
                ('related_campaign', models.ForeignKey(
                    blank=True,
                    help_text='Optional: Campaign this task relates to',
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='todos',
                    to='campaigns.campaign'
                )),
                ('user', models.ForeignKey(
                    help_text='User who owns this task',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='todos',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Todo',
                'verbose_name_plural': 'Todos',
                'db_table': 'todo',
                'ordering': ['-priority', 'deadline', '-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='todo',
            index=models.Index(fields=['user', 'status'], name='todo_user_id_f0c5da_idx'),
        ),
        migrations.AddIndex(
            model_name='todo',
            index=models.Index(fields=['user', 'deadline'], name='todo_user_id_336b8d_idx'),
        ),
        migrations.AddIndex(
            model_name='todo',
            index=models.Index(fields=['status', 'deadline'], name='todo_status_b5b9c4_idx'),
        ),
    ]

