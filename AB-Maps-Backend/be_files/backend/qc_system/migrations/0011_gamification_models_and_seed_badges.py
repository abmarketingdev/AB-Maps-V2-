# Generated manually for QC gamification Phase 1.

import uuid
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


def seed_badges(apps, schema_editor):
    Badge = apps.get_model('qc_system', 'Badge')
    badges = [
        ('calls_100', '100 Calls Milestone', 'total_calls', 100),
        ('calls_1000', '1000 Calls Legend', 'total_calls', 1000),
        ('first_call_answered', 'First Answered Call', 'first_answered_call', 1),
        ('weekly_si_opp_10', 'SI Opp Specialist', 'weekly_si_opp', 10),
        ('weekly_positiv_10', 'Positiv Master', 'weekly_positiv', 10),
        ('full_list_cleared', 'Ren Liste', 'full_list_cleared', 1),
        ('streak_7', '7 Day Streak', 'streak_days', 7),
    ]
    for code, name, condition_type, condition_value in badges:
        Badge.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'condition_type': condition_type,
                'condition_value': condition_value,
            },
        )


def unseed_badges(apps, schema_editor):
    Badge = apps.get_model('qc_system', 'Badge')
    Badge.objects.filter(
        code__in=[
            'calls_100',
            'calls_1000',
            'first_call_answered',
            'weekly_si_opp_10',
            'weekly_positiv_10',
            'full_list_cleared',
            'streak_7',
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('qc_system', '0010_qc_history_analytics_indexes'),
        ('users', '0006_user_admin_type'),
    ]

    operations = [
        migrations.CreateModel(
            name='Badge',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('code', models.CharField(db_index=True, max_length=64, unique=True)),
                ('name', models.CharField(max_length=120)),
                ('condition_type', models.CharField(db_index=True, max_length=64)),
                ('condition_value', models.IntegerField(default=0)),
            ],
            options={
                'verbose_name': 'QC Badge',
                'verbose_name_plural': 'QC Badges',
                'db_table': 'qc_badge',
                'ordering': ['name'],
            },
        ),
        migrations.CreateModel(
            name='XPEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event_type', models.CharField(db_index=True, max_length=64)),
                ('xp_amount', models.IntegerField(default=0)),
                ('contact_id', models.UUIDField(blank=True, db_index=True, null=True)),
                ('metadata', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='qc_xp_events', to='users.user')),
            ],
            options={
                'verbose_name': 'QC XP Event',
                'verbose_name_plural': 'QC XP Events',
                'db_table': 'qc_xp_event',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='UserGamification',
            fields=[
                ('total_xp', models.IntegerField(default=0)),
                ('level', models.IntegerField(default=1, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(7)])),
                ('streak_days', models.IntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)])),
                ('last_active_date', models.DateField(blank=True, null=True)),
                ('leaderboard_opt_out', models.BooleanField(default=False)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, primary_key=True, related_name='qc_gamification', serialize=False, to='users.user')),
            ],
            options={
                'verbose_name': 'QC User Gamification',
                'verbose_name_plural': 'QC User Gamification',
                'db_table': 'qc_user_gamification',
            },
        ),
        migrations.CreateModel(
            name='UserBadge',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('unlocked_at', models.DateTimeField(auto_now_add=True)),
                ('badge', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='unlocked_by', to='qc_system.badge')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='qc_user_badges', to='users.user')),
            ],
            options={
                'verbose_name': 'QC User Badge',
                'verbose_name_plural': 'QC User Badges',
                'db_table': 'qc_user_badge',
                'ordering': ['-unlocked_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='userbadge',
            constraint=models.UniqueConstraint(fields=('user', 'badge'), name='qc_user_badge_unique'),
        ),
        migrations.AddIndex(
            model_name='userbadge',
            index=models.Index(fields=['user', 'unlocked_at'], name='qc_user_badge_user_unlocked'),
        ),
        migrations.AddIndex(
            model_name='xpevent',
            index=models.Index(fields=['user', 'created_at'], name='qc_xp_user_created'),
        ),
        migrations.AddIndex(
            model_name='xpevent',
            index=models.Index(fields=['created_at'], name='qc_xp_created'),
        ),
        migrations.AddIndex(
            model_name='xpevent',
            index=models.Index(fields=['user', 'event_type', 'created_at'], name='qc_xp_user_type_created'),
        ),
        migrations.RunPython(seed_badges, unseed_badges),
    ]
