"""
Services for the tracking app.

Working-time helpers — compute per-day working seconds and `is_active_today`
for an actor (Employee or Manager), based on WorkSession intervals.

The "today" window is defined in Europe/Oslo local time (business is based in
Norway). Do not change global TIME_ZONE to avoid shifting other semantics.
"""
from zoneinfo import ZoneInfo
from datetime import timezone as dt_timezone

from django.db.models import Q
from django.utils import timezone

from .models import WorkSession


OSLO = ZoneInfo('Europe/Oslo')
ACTIVE_THRESHOLD_SECONDS = 15 * 60  # 900


def _oslo_day_start_utc():
    """Return the UTC datetime corresponding to today's 00:00 in Europe/Oslo."""
    now_local = timezone.now().astimezone(OSLO)
    start_local = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_local.astimezone(dt_timezone.utc)


def _actor_filter(*, employee=None, manager=None) -> Q:
    if employee is not None:
        return Q(employee=employee)
    if manager is not None:
        return Q(manager=manager)
    raise ValueError("Must pass either employee or manager")


def get_working_seconds_today(*, employee=None, manager=None) -> int:
    """Sum of session durations overlapping today (Europe/Oslo) for an actor."""
    start_utc = _oslo_day_start_utc()
    now = timezone.now()
    qs = WorkSession.objects.filter(_actor_filter(employee=employee, manager=manager)).filter(
        Q(started_at__gte=start_utc) | Q(ended_at__isnull=True) | Q(ended_at__gte=start_utc)
    )
    total = 0
    for s in qs:
        seg_start = max(s.started_at, start_utc)
        seg_end = s.ended_at or now
        if seg_end <= seg_start:
            continue
        total += int((seg_end - seg_start).total_seconds())
    return max(0, total)


def is_active_today(*, employee=None, manager=None) -> bool:
    return get_working_seconds_today(employee=employee, manager=manager) > ACTIVE_THRESHOLD_SECONDS


def _date_to_oslo_utc(d, end_of_day: bool = False):
    """Convert a date object to UTC datetime using Europe/Oslo midnight.
    If end_of_day=True, returns the start of the NEXT Oslo day (exclusive upper bound)."""
    from datetime import datetime
    local_dt = datetime(d.year, d.month, d.day, tzinfo=OSLO)
    if end_of_day:
        from datetime import timedelta
        local_dt = local_dt + timedelta(days=1)
    return local_dt.astimezone(dt_timezone.utc)


def get_working_seconds_for_period(start_date, end_date, *, employee=None, manager=None) -> int:
    """Sum of WorkSession seconds overlapping [start_date, end_date] (Europe/Oslo dates)."""
    start_utc = _date_to_oslo_utc(start_date)
    end_utc = _date_to_oslo_utc(end_date, end_of_day=True)
    now = timezone.now()

    qs = WorkSession.objects.filter(_actor_filter(employee=employee, manager=manager)).filter(
        Q(started_at__lt=end_utc),
    ).filter(
        Q(ended_at__isnull=True) | Q(ended_at__gt=start_utc)
    )

    total = 0
    for s in qs:
        seg_start = max(s.started_at, start_utc)
        seg_end = min(s.ended_at or now, end_utc)
        if seg_end <= seg_start:
            continue
        total += int((seg_end - seg_start).total_seconds())
    return max(0, total)
