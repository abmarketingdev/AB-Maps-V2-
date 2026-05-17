from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from qc_system.gamification_serializers import XPEventRequestSerializer
from qc_system.gamification_services import (
    LEVEL_NAMES,
    LEVEL_THRESHOLDS,
    QC_GAMIFICATION_TZ,
    XPEventResult,
    award_xp_event,
    compute_level,
    compute_today_xp,
    xp_to_next_level,
)
from qc_system.models import UserBadge, UserGamification, XPEvent
from qc_system.permissions import IsQCUser


def _xp_in_current_level(total_xp: int) -> int:
    current_floor = 0
    for threshold in LEVEL_THRESHOLDS:
        if total_xp >= threshold:
            current_floor = threshold
    return total_xp - current_floor


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsQCUser])
def gamification_me(request):
    user = request.user
    snapshot, _ = UserGamification.objects.get_or_create(user=user)
    total_xp = snapshot.total_xp
    level, level_name = compute_level(total_xp)
    today_xp = compute_today_xp(user)

    badges = UserBadge.objects.filter(user=user).select_related('badge').order_by('-unlocked_at')
    badges_payload = [
        {
            'id': b.badge.code,
            'name': b.badge.name,
            'unlocked_at': b.unlocked_at.isoformat().replace('+00:00', 'Z'),
        }
        for b in badges
    ]

    return Response(
        {
            'user_id': str(user.id),
            'level': level,
            'level_name': level_name,
            'total_xp': total_xp,
            'today_xp': today_xp,
            'xp_to_next_level': xp_to_next_level(total_xp),
            'xp_in_current_level': _xp_in_current_level(total_xp),
            'streak_days': snapshot.streak_days,
            'last_active_date': snapshot.last_active_date.isoformat()
            if snapshot.last_active_date
            else None,
            'badges': badges_payload,
        }
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsQCUser])
def gamification_xp_event(request):
    serializer = XPEventRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'success': False, 'error': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    try:
        result: XPEventResult = award_xp_event(
            user=request.user,
            event_type=data['event_type'],
            contact_id=data.get('contact_id'),
            metadata=data.get('metadata') or {},
        )
    except ValueError as exc:
        return Response({'success': False, 'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(
        {
            'xp_awarded': result.xp_awarded,
            'total_xp': result.total_xp,
            'today_xp': result.today_xp,
            'level': result.level,
            'level_name': result.level_name,
            'level_up': result.level_up,
            'previous_level': result.previous_level,
            'badge_unlocked': result.badge_unlocked,
            'streak_days': result.streak_days,
            'xp_to_next_level': result.xp_to_next_level,
        }
    )


def _scope_window(scope: str) -> tuple[datetime | None, datetime | None]:
    now_local = timezone.now().astimezone(QC_GAMIFICATION_TZ)
    if scope == 'alltime':
        return None, None
    if scope == 'daily':
        start_local = datetime.combine(now_local.date(), time.min, tzinfo=QC_GAMIFICATION_TZ)
        return start_local, start_local + timedelta(days=1)
    # weekly default
    week_start = now_local.date() - timedelta(days=now_local.weekday())
    start_local = datetime.combine(week_start, time.min, tzinfo=QC_GAMIFICATION_TZ)
    return start_local, start_local + timedelta(days=7)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsQCUser])
def gamification_leaderboard(request):
    scope = (request.query_params.get('scope') or 'weekly').strip().lower()
    if scope not in ('weekly', 'daily', 'alltime'):
        return Response(
            {'success': False, 'error': "scope must be one of: weekly, daily, alltime"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    start, end = _scope_window(scope)
    qs = XPEvent.objects.exclude(user__qc_gamification__leaderboard_opt_out=True)
    if start is not None:
        qs = qs.filter(created_at__gte=start, created_at__lt=end)

    agg = (
        qs.values('user_id', 'user__username', 'user__first_name', 'user__last_name')
        .annotate(xp=Sum('xp_amount'))
        .order_by('-xp', 'user__username')[:20]
    )

    snapshots = {
        g.user_id: g
        for g in UserGamification.objects.filter(user_id__in=[a['user_id'] for a in agg])
    }

    rows = []
    rank = 1
    for item in agg:
        uid = item['user_id']
        xp = int(item['xp'] or 0)
        snap = snapshots.get(uid)
        if snap:
            level = snap.level
        else:
            level, _ = compute_level(
                int(XPEvent.objects.filter(user_id=uid).aggregate(s=Sum('xp_amount')).get('s') or 0)
            )

        full_name = f"{(item['user__first_name'] or '').strip()} {(item['user__last_name'] or '').strip()}".strip()
        rows.append(
            {
                'rank': rank,
                'user_id': str(uid),
                'display_name': full_name or item['user__username'],
                'xp': xp,
                'level': level,
                'level_name': LEVEL_NAMES[level],
                'streak_days': (snap.streak_days if snap else 0),
            }
        )
        rank += 1

    return Response({'scope': scope, 'rows': rows})

