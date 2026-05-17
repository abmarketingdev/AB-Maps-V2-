"""
Core gamification services for QC users.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from qc_system.models import Badge, UserBadge, UserGamification, XPEvent

QC_GAMIFICATION_TZ = ZoneInfo('Europe/Oslo')

XP_RULES: dict[str, int] = {
    'call_answered': 10,
    'call_no_answer': 5,
    'call_busy': 5,
    'si_opp_flagged': 15,
    'outcome_positiv': 12,
    'outcome_negativ': 10,
    'outcome_noytral': 10,
    'comment_added': 3,
    'streak_5_calls': 20,
    'daily_goal_50pct': 25,
    'daily_goal_100pct': 50,
    'full_list_cleared': 30,
    'daily_streak': 10,
}

LEVEL_THRESHOLDS = [0, 200, 500, 1000, 2000, 3500, 5000]
LEVEL_NAMES = {
    1: 'Lærling',
    2: 'Ringer',
    3: 'Pro Ringer',
    4: 'Senior Agent',
    5: 'QC Spesialist',
    6: 'QC Ekspert',
    7: 'Legende',
}

CALL_EVENT_TYPES = {'call_answered', 'call_no_answer', 'call_busy'}


@dataclass
class XPEventResult:
    xp_awarded: int
    total_xp: int
    today_xp: int
    level: int
    level_name: str
    level_up: bool
    previous_level: int
    badge_unlocked: dict[str, str] | None
    streak_days: int
    xp_to_next_level: int


def compute_level(total_xp: int) -> tuple[int, str]:
    level = 1
    for idx, threshold in enumerate(LEVEL_THRESHOLDS, start=1):
        if total_xp >= threshold:
            level = idx
    return level, LEVEL_NAMES[level]


def xp_to_next_level(total_xp: int) -> int:
    for threshold in LEVEL_THRESHOLDS:
        if total_xp < threshold:
            return threshold - total_xp
    return 0


def compute_today_xp(user) -> int:
    now_local = timezone.now().astimezone(QC_GAMIFICATION_TZ)
    today = now_local.date()
    start = timezone.make_aware(
        datetime.combine(today, time.min),
        QC_GAMIFICATION_TZ,
    )
    end = start + timedelta(days=1)
    total = (
        XPEvent.objects.filter(user=user, created_at__gte=start, created_at__lt=end)
        .aggregate(s=Sum('xp_amount'))
        .get('s')
        or 0
    )
    return int(total)


def recompute_user_snapshot(user) -> UserGamification:
    snapshot, _ = UserGamification.objects.get_or_create(user=user)
    total_xp = XPEvent.objects.filter(user=user).aggregate(s=Sum('xp_amount')).get('s') or 0
    level, _ = compute_level(int(total_xp))
    snapshot.total_xp = int(total_xp)
    snapshot.level = level
    snapshot.save(update_fields=['total_xp', 'level', 'updated_at'])
    return snapshot


def _unlock_badge(user, code: str) -> dict[str, str] | None:
    badge = Badge.objects.filter(code=code).first()
    if not badge:
        return None
    _, created = UserBadge.objects.get_or_create(user=user, badge=badge)
    if not created:
        return None
    return {'id': badge.code, 'name': badge.name}


def check_badges_for_event(user, event_type: str, streak_days: int) -> dict[str, str] | None:
    # Returns first newly unlocked badge for this trigger, else None.
    if event_type in CALL_EVENT_TYPES:
        total_calls = XPEvent.objects.filter(user=user, event_type__in=CALL_EVENT_TYPES).count()
        if total_calls >= 1000:
            unlocked = _unlock_badge(user, 'calls_1000')
            if unlocked:
                return unlocked
        if total_calls >= 100:
            unlocked = _unlock_badge(user, 'calls_100')
            if unlocked:
                return unlocked

    if event_type == 'call_answered':
        answered_count = XPEvent.objects.filter(user=user, event_type='call_answered').count()
        if answered_count == 1:
            unlocked = _unlock_badge(user, 'first_call_answered')
            if unlocked:
                return unlocked

    if event_type == 'si_opp_flagged':
        now_local = timezone.now().astimezone(QC_GAMIFICATION_TZ)
        week_start = now_local.date() - timedelta(days=now_local.weekday())
        start = timezone.make_aware(
            datetime.combine(week_start, time.min),
            QC_GAMIFICATION_TZ,
        )
        cnt = XPEvent.objects.filter(
            user=user, event_type='si_opp_flagged', created_at__gte=start
        ).count()
        if cnt >= 10:
            unlocked = _unlock_badge(user, 'weekly_si_opp_10')
            if unlocked:
                return unlocked

    if event_type == 'outcome_positiv':
        now_local = timezone.now().astimezone(QC_GAMIFICATION_TZ)
        week_start = now_local.date() - timedelta(days=now_local.weekday())
        start = timezone.make_aware(
            datetime.combine(week_start, time.min),
            QC_GAMIFICATION_TZ,
        )
        cnt = XPEvent.objects.filter(
            user=user, event_type='outcome_positiv', created_at__gte=start
        ).count()
        if cnt >= 10:
            unlocked = _unlock_badge(user, 'weekly_positiv_10')
            if unlocked:
                return unlocked

    if event_type == 'full_list_cleared':
        unlocked = _unlock_badge(user, 'full_list_cleared')
        if unlocked:
            return unlocked

    if event_type == 'daily_streak' and streak_days >= 7:
        unlocked = _unlock_badge(user, 'streak_7')
        if unlocked:
            return unlocked

    return None


@transaction.atomic
def award_xp_event(
    *,
    user,
    event_type: str,
    contact_id=None,
    metadata: dict[str, Any] | None = None,
) -> XPEventResult:
    if event_type not in XP_RULES:
        raise ValueError(f'Unknown event_type: {event_type}')

    snapshot, _ = UserGamification.objects.select_for_update().get_or_create(user=user)
    previous_level = snapshot.level
    xp_amount = XP_RULES[event_type]

    XPEvent.objects.create(
        user=user,
        event_type=event_type,
        xp_amount=xp_amount,
        contact_id=contact_id,
        metadata=metadata or {},
    )

    # Recompute denormalized snapshot from append-only log.
    snapshot = recompute_user_snapshot(user)
    total_xp = snapshot.total_xp
    level, level_name = compute_level(total_xp)

    today_local = timezone.now().astimezone(QC_GAMIFICATION_TZ).date()
    last_active = snapshot.last_active_date
    if last_active == today_local:
        new_streak = snapshot.streak_days
    elif last_active == (today_local - timedelta(days=1)):
        new_streak = snapshot.streak_days + 1
    else:
        new_streak = 1
    snapshot.streak_days = new_streak
    snapshot.last_active_date = today_local
    snapshot.level = level
    snapshot.save(update_fields=['streak_days', 'last_active_date', 'level', 'updated_at'])

    badge = check_badges_for_event(user, event_type, new_streak)
    today_xp = compute_today_xp(user)

    return XPEventResult(
        xp_awarded=xp_amount,
        total_xp=total_xp,
        today_xp=today_xp,
        level=level,
        level_name=level_name,
        level_up=(level > previous_level),
        previous_level=previous_level,
        badge_unlocked=badge,
        streak_days=new_streak,
        xp_to_next_level=xp_to_next_level(total_xp),
    )


def _award_with_retry_guard(*, user, event_type: str, contact_id, metadata: dict[str, Any]) -> XPEventResult | None:
    """
    Deduplicate awards for the same approve history event.
    """
    history_id = str(metadata.get('history_id') or '')
    if history_id:
        exists = XPEvent.objects.filter(
            user=user,
            event_type=event_type,
            contact_id=contact_id,
            metadata__history_id=history_id,
        ).exists()
        if exists:
            return None
    return award_xp_event(
        user=user,
        event_type=event_type,
        contact_id=contact_id,
        metadata=metadata,
    )


def award_events_for_qc_approve(
    *,
    user,
    contact,
    history_entry,
    qc_result: str,
    svarte_category: str | None,
    si_opp: str | None,
    comment: str | None,
) -> list[XPEventResult]:
    """
    Backend-driven gamification awards for QC approve outcomes.
    """
    metadata_base = {
        'source': 'qc_approve',
        'history_id': str(history_entry.id),
    }
    results: list[XPEventResult] = []

    event_types: list[str] = []
    if qc_result == 'Svarte':
        event_types.append('call_answered')
    elif qc_result == 'Ikke svar':
        event_types.append('call_no_answer')
    elif qc_result == 'Opptatt':
        event_types.append('call_busy')

    if si_opp == 'JA':
        event_types.append('si_opp_flagged')

    if svarte_category == 'positiv':
        event_types.append('outcome_positiv')
    elif svarte_category == 'negativ':
        event_types.append('outcome_negativ')
    elif svarte_category == 'noeytral':
        event_types.append('outcome_noytral')

    if (comment or '').strip():
        event_types.append('comment_added')

    for event_type in event_types:
        res = _award_with_retry_guard(
            user=user,
            event_type=event_type,
            contact_id=contact.id,
            metadata=metadata_base,
        )
        if res:
            results.append(res)
    return results
