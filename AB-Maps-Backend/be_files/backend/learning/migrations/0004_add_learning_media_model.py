"""
Migration for adding LearningMedia model for rich text content media uploads.
Supports external storage via 0CodeKit API for images and videos.
"""
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('learning', '0003_add_campaign_to_section'),
    ]

    operations = [
        migrations.CreateModel(
            name='LearningMedia',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                # Storage type indicator
                ('storage_type', models.CharField(
                    choices=[('LOCAL', 'Local Storage'), ('ZEROCODEKIT', '0CodeKit External Storage')],
                    default='ZEROCODEKIT',
                    max_length=20,
                    help_text='Where the file is stored'
                )),
                # External storage fields (0CodeKit)
                ('external_url', models.URLField(
                    blank=True,
                    max_length=2000,
                    null=True,
                    help_text='Permanent URL from 0CodeKit storage'
                )),
                ('external_file_id', models.CharField(
                    blank=True,
                    max_length=255,
                    null=True,
                    help_text='File ID from 0CodeKit for management'
                )),
                # Media metadata
                ('media_type', models.CharField(
                    choices=[('IMAGE', 'Image'), ('VIDEO', 'Video'), ('DOCUMENT', 'Document')],
                    default='IMAGE',
                    max_length=20
                )),
                ('original_filename', models.CharField(max_length=255)),
                ('file_size', models.PositiveIntegerField(default=0, help_text='File size in bytes')),
                ('mime_type', models.CharField(blank=True, max_length=100)),
                ('width', models.PositiveIntegerField(blank=True, help_text='Image/video width in pixels', null=True)),
                ('height', models.PositiveIntegerField(blank=True, help_text='Image/video height in pixels', null=True)),
                ('duration_seconds', models.PositiveIntegerField(blank=True, help_text='Video duration in seconds', null=True)),
                ('alt_text', models.CharField(blank=True, help_text='Alt text for accessibility', max_length=500)),
                # Content reference
                ('content_type', models.CharField(blank=True, help_text="e.g., 'section', 'lesson'", max_length=50)),
                ('content_id', models.PositiveIntegerField(blank=True, null=True)),
                # Timestamps
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                # User reference
                ('uploaded_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='learning_media_uploads',
                    to=settings.AUTH_USER_MODEL
                )),
            ],
            options={
                'verbose_name': 'Learning Media',
                'verbose_name_plural': 'Learning Media',
                'db_table': 'learning_media',
            },
        ),
        # Add indexes for common queries
        migrations.AddIndex(
            model_name='learningmedia',
            index=models.Index(fields=['content_type', 'content_id'], name='learning_me_content_ce9c8a_idx'),
        ),
        migrations.AddIndex(
            model_name='learningmedia',
            index=models.Index(fields=['uploaded_by', 'created_at'], name='learning_me_uploade_af4f52_idx'),
        ),
        migrations.AddIndex(
            model_name='learningmedia',
            index=models.Index(fields=['media_type'], name='learning_me_media_t_b7d8a1_idx'),
        ),
        migrations.AddIndex(
            model_name='learningmedia',
            index=models.Index(fields=['storage_type'], name='learning_me_storage_type_idx'),
        ),
        migrations.AddIndex(
            model_name='learningmedia',
            index=models.Index(fields=['external_file_id'], name='learning_me_ext_file_id_idx'),
        ),
    ]
