"""
Reaper for WorkSession rows whose WebSocket went away without a clean disconnect.

Run periodically via cron (example: every 5 minutes).
Sets ended_at = last_heartbeat_at (NOT now()) so reaped sessions do not inflate
working time by the timeout window.
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import F
from django.utils import timezone

from tracking.models import WorkSession


class Command(BaseCommand):
    help = 'Close stale open WorkSession rows (no heartbeat for --timeout minutes)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--timeout',
            type=int,
            default=10,
            help='Minutes of heartbeat silence before a session is closed (default: 10)'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be closed without changing anything'
        )

    def handle(self, *args, **options):
        timeout_minutes = options['timeout']
        dry_run = options['dry_run']

        cutoff = timezone.now() - timedelta(minutes=timeout_minutes)
        stale = WorkSession.objects.filter(
            ended_at__isnull=True,
            last_heartbeat_at__lt=cutoff,
        )

        count = stale.count()
        self.stdout.write(f"Heartbeat cutoff: {cutoff.isoformat()} ({timeout_minutes} min)")
        self.stdout.write(f"Open stale sessions: {count}")

        if count == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to close.'))
            return

        # Show a sample (up to 10) for visibility
        for s in stale.order_by('last_heartbeat_at')[:10]:
            kind = s.actor_kind()
            self.stdout.write(
                f"  {s.id} [{kind}={s.actor_id()}] "
                f"started={s.started_at.isoformat()} "
                f"last_heartbeat={s.last_heartbeat_at.isoformat()}"
            )

        if dry_run:
            self.stdout.write(self.style.WARNING(f'DRY RUN: would close {count} session(s)'))
            return

        updated = stale.update(
            ended_at=F('last_heartbeat_at'),
            source='reaper_closed',
        )
        self.stdout.write(self.style.SUCCESS(f'Closed {updated} session(s)'))
