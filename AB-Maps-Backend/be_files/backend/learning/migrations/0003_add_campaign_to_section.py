from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('campaigns', '0004_campaignemployee'),
        ('learning', '0002_initial'),
    ]

    operations = [
        # Add nullable campaign FK (NULL = General Training)
        migrations.AddField(
            model_name='section',
            name='campaign',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='learning_sections',
                to='campaigns.campaign',
                help_text='Campaign this section belongs to. NULL = General Training',
            ),
        ),

        # Remove global unique constraint on slug by redefining field without unique
        migrations.AlterField(
            model_name='section',
            name='slug',
            field=models.SlugField(blank=True),
        ),

        # Update order field help text
        migrations.AlterField(
            model_name='section',
            name='order',
            field=models.PositiveIntegerField(
                db_index=True,
                blank=True,
                help_text='Display order within campaign (1,2,3..)'
            ),
        ),

        # Apply per-campaign uniqueness
        migrations.AlterUniqueTogether(
            name='section',
            unique_together={('campaign', 'slug'), ('campaign', 'order')},
        ),

        # Update default ordering (Meta)
        migrations.AlterModelOptions(
            name='section',
            options={
                'db_table': 'learning_section',
                'ordering': ['campaign', 'order'],
                'verbose_name': 'Learning Section',
                'verbose_name_plural': 'Learning Sections',
            },
        ),

        # Add composite indexes for campaign-aware queries
        migrations.AddIndex(
            model_name='section',
            index=models.Index(
                fields=['campaign', 'is_active', 'order'],
                name='learning_sec_campaign_active_order',
            ),
        ),
        migrations.AddIndex(
            model_name='section',
            index=models.Index(
                fields=['campaign', 'slug'],
                name='learning_sec_campaign_slug',
            ),
        ),
        migrations.AddIndex(
            model_name='section',
            index=models.Index(
                fields=['is_active'],
                name='learning_sec_active',
            ),
        ),
    ]


