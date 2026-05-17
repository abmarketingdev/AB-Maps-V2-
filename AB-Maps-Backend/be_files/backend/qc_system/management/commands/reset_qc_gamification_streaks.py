from __future__ import annotations

from datetime import date
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.utils import ProgrammingError, OperationalError
from django.db.models import Count, Q
from django.utils import timezone

from qc_system.models import QCHistory, QCSettings, UserGamification
from users.models import User


class Command(BaseCommand):
    help = (
        "Nightly streak reset for QC gamification. "
        "Run at 23:59 on working days."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--date',
            type=str,
            default=None,
            help='Override local date (YYYY-MM-DD) for manual backfill/testing.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Run even on weekends.',
        )

    def _today_local(self, override: str | None) -> date:
        tz_name = getattr(settings, 'QC_GAMIFICATION_TIMEZONE', 'Europe/Oslo')
        tz = ZoneInfo(tz_name)
        if override:
            return date.fromisoformat(override)
        return timezone.now().astimezone(tz).date()

    def _is_working_day(self, d: date) -> bool:
        # Fallback rule per plan: skip Saturday/Sunday when no business calendar exists.
        # If project later provides a working-day calendar service, hook it here.
        return d.weekday() < 5

    @transaction.atomic
    def handle(self, *args, **options):
        target_date = self._today_local(options.get('date'))
        force = bool(options.get('force'))

        if not force and not self._is_working_day(target_date):
            self.stdout.write(
                self.style.WARNING(
                    f'Skipping streak reset on non-working day: {target_date.isoformat()}'
                )
            )
            return

        # QC users only.
        users_qs = User.objects.filter(
            is_active=True,
        ).filter(
            Q(employee_type='qc_emp') | Q(admin_type='qc_admin', is_superuser=True)
        )

        # Build daily goals map.
        goals = {
            s.user_id: s.daily_goal
            for s in QCSettings.objects.filter(user_id__in=users_qs.values_list('id', flat=True))
        }

        calls_today = {
            row['qc_agent_id']: row['c']
            for row in (
                QCHistory.objects.filter(date=target_date, qc_agent_id__in=users_qs.values_list('id', flat=True))
                .values('qc_agent_id')
                .annotate(c=Count('id'))
            )
        }

        reset_ids: list = []
        try:
            for ug in UserGamification.objects.select_for_update().filter(user_id__in=users_qs.values_list('id', flat=True)):
                if ug.last_active_date and ug.last_active_date >= target_date:
                    continue

                goal = goals.get(ug.user_id, 100)
                done = calls_today.get(ug.user_id, 0)
                if done < goal and ug.streak_days != 0:
                    ug.streak_days = 0
                    ug.save(update_fields=['streak_days', 'updated_at'])
                    reset_ids.append(ug.user_id)
        except (ProgrammingError, OperationalError):
            self.stdout.write(
                self.style.ERROR(
                    "Gamification tables not available yet. Run: python manage.py migrate qc_system"
                )
            )
            return

        self.stdout.write(
            self.style.SUCCESS(
                f'Nightly streak reset complete for {target_date.isoformat()}: '
                f'reset={len(reset_ids)}'
            )
        )
