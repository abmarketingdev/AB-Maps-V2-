"""
QC Admin Analytics — GET /api/admin/analytics/daily

Implements the contract in DOCS/QC_ADMIN_ANALYTICS_DAILY_API_PLAN.md.
"""
from __future__ import annotations

import hashlib
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from django.core.cache import cache
from django.db.models import QuerySet
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from qc_system.models import QCHistory
from qc_system.permissions import IsQCAdmin

# Calendar boundaries for from/to (Norway business day).
QC_ANALYTICS_TZ = ZoneInfo('Europe/Oslo')

# Max inclusive date range (days).
MAX_RANGE_DAYS = 366

# Cache TTL (seconds).
CACHE_TTL = 60

CATEGORY_KEYS = [
    'SVARTE',
    'IKKE_SVAR',
    'OPPRINGING_2',
    'SI_OPP',
    'NOYTRAL',
    'POSITIV',
    'NEGATIV',
    'ANDRE_HENVENDELSER',
    'GIVERINNSPILL',
    'RESERVERT',
]


def _empty_by_category() -> dict[str, int]:
    return {k: 0 for k in CATEGORY_KEYS}


def _parse_ymd(s: str) -> date:
    return datetime.strptime(s.strip(), '%Y-%m-%d').date()


def _local_date(dt: datetime) -> date:
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    return dt.astimezone(QC_ANALYTICS_TZ).date()


def _range_to_datetimes(from_d: date, to_d: date) -> tuple[datetime, datetime]:
    start = datetime.combine(from_d, time.min, tzinfo=QC_ANALYTICS_TZ)
    end = datetime.combine(to_d, time.max, tzinfo=QC_ANALYTICS_TZ)
    return start, end


def _daterange_inclusive(from_d: date, to_d: date) -> list[date]:
    out = []
    cur = from_d
    while cur <= to_d:
        out.append(cur)
        cur += timedelta(days=1)
    return out


def _build_second_ikke_svar_ids(qs: QuerySet) -> set:
    """History row ids that are the 2nd 'Ikke svar' for their contact (ordered by time)."""
    pairs = list(
        qs.filter(qc_result='Ikke svar')
        .order_by('contact_id', 'created_at')
        .values_list('contact_id', 'id')
    )
    second_ids: set = set()
    current_cid = None
    idx = 0
    for contact_id, hid in pairs:
        if contact_id != current_cid:
            current_cid = contact_id
            idx = 0
        idx += 1
        if idx == 2:
            second_ids.add(hid)
    return second_ids


def _classify_row(
    qc_result: str,
    svarte_category: str | None,
    si_opp: str | None,
    history_id: Any,
    second_ikke_ids: set,
) -> str:
    """Single mutually exclusive bucket per history row."""
    if si_opp == 'JA':
        return 'SI_OPP'
    if qc_result == 'Svarte':
        sc = (svarte_category or '').strip()
        mapping = {
            'noeytral': 'NOYTRAL',
            'positiv': 'POSITIV',
            'negativ': 'NEGATIV',
            'annen': 'ANDRE_HENVENDELSER',
            'giverinspill': 'GIVERINNSPILL',
            'reservert': 'RESERVERT',
        }
        if sc in mapping:
            return mapping[sc]
        return 'SVARTE'
    if qc_result == 'Ikke svar':
        if history_id in second_ikke_ids:
            return 'OPPRINGING_2'
        return 'IKKE_SVAR'
    if qc_result == 'Opptatt':
        return 'IKKE_SVAR'
    return 'SVARTE'


def _agent_display_name(user) -> str:
    fn = (getattr(user, 'first_name', None) or '').strip()
    ln = (getattr(user, 'last_name', None) or '').strip()
    full = f'{fn} {ln}'.strip()
    return full or getattr(user, 'username', '') or str(user.pk)


def _parse_params(request) -> tuple[dict[str, Any] | None, Response | None]:
    """Returns (params_dict, error_response)."""
    today = timezone.now().astimezone(QC_ANALYTICS_TZ).date()
    default_from = today - timedelta(days=30)

    raw_from = request.query_params.get('from')
    raw_to = request.query_params.get('to')
    raw_campaign = request.query_params.get('campaign_id', 'all')
    raw_agent = request.query_params.get('agent_id', 'all')

    try:
        from_d = _parse_ymd(raw_from) if raw_from else default_from
        to_d = _parse_ymd(raw_to) if raw_to else today
    except ValueError:
        return None, Response(
            {'success': False, 'error': 'Invalid from/to date. Use YYYY-MM-DD.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if from_d > to_d:
        return None, Response(
            {'success': False, 'error': 'from must be on or before to.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    span = (to_d - from_d).days + 1
    if span > MAX_RANGE_DAYS:
        return None, Response(
            {
                'success': False,
                'error': f'Date range too large (max {MAX_RANGE_DAYS} days inclusive).',
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    campaign_id = raw_campaign.strip() if raw_campaign else 'all'
    agent_id = raw_agent.strip() if raw_agent else 'all'

    params = {
        'from_d': from_d,
        'to_d': to_d,
        'campaign_id': campaign_id,
        'agent_id': agent_id,
    }
    return params, None


def _base_history_qs(
    start: datetime,
    end: datetime,
    campaign_id: str,
    agent_id: str,
) -> QuerySet:
    qs = QCHistory.objects.filter(created_at__gte=start, created_at__lte=end)
    if campaign_id and campaign_id.lower() != 'all':
        qs = qs.filter(contact__campaign_id=campaign_id)
    if agent_id and agent_id.lower() != 'all':
        qs = qs.filter(qc_agent_id=agent_id)
    return qs.select_related('contact', 'qc_agent')


def build_analytics_payload(
    from_d: date,
    to_d: date,
    campaign_id: str,
    agent_id: str,
) -> dict[str, Any]:
    start, end = _range_to_datetimes(from_d, to_d)
    qs = _base_history_qs(start, end, campaign_id, agent_id)

    second_ikke_ids = _build_second_ikke_svar_ids(qs)

    by_category = _empty_by_category()
    # daily: date -> metrics
    daily_calls: dict[date, int] = defaultdict(int)
    daily_contacts: dict[date, set] = defaultdict(set)
    daily_completed: dict[date, set] = defaultdict(set)
    daily_si: dict[date, set] = defaultdict(set)

    # by_agent: agent_uuid -> aggregates
    agent_calls: dict[Any, int] = defaultdict(int)
    agent_contacts: dict[Any, set] = defaultdict(set)
    agent_completed: dict[Any, set] = defaultdict(set)
    agent_si: dict[Any, set] = defaultdict(set)
    agent_svarte: dict[Any, int] = defaultdict(int)
    total_calls = 0
    svarte_count = 0
    all_contact_ids: set = set()
    completion_contact_ids: set = set()
    si_contact_ids: set = set()

    rows = qs.values(
        'id',
        'contact_id',
        'created_at',
        'qc_result',
        'svarte_category',
        'si_opp',
        'qc_agent_id',
        'contact__is_oppsigelse',
    ).iterator(chunk_size=2000)

    for row in rows:
        total_calls += 1
        hid = row['id']
        cid = row['contact_id']
        created = row['created_at']
        qc_result = row['qc_result'] or ''
        svarte_category = row['svarte_category']
        si_opp = row['si_opp']
        aid = row['qc_agent_id']

        d = _local_date(created)
        if qc_result == 'Svarte':
            svarte_count += 1

        bucket = _classify_row(
            qc_result, svarte_category, si_opp, hid, second_ikke_ids
        )
        by_category[bucket] += 1

        daily_calls[d] += 1
        daily_contacts[d].add(cid)
        all_contact_ids.add(cid)

        is_completion = (
            qc_result == 'Svarte'
            and svarte_category
            and str(svarte_category).strip() != ''
        )
        if is_completion:
            completion_contact_ids.add(cid)
            daily_completed[d].add(cid)

        if si_opp == 'JA' or row['contact__is_oppsigelse']:
            si_contact_ids.add(cid)
            daily_si[d].add(cid)

        if aid:
            agent_calls[aid] += 1
            agent_contacts[aid].add(cid)
            if is_completion:
                agent_completed[aid].add(cid)
            if si_opp == 'JA' or row['contact__is_oppsigelse']:
                agent_si[aid].add(cid)
            if qc_result == 'Svarte':
                agent_svarte[aid] += 1

    total_contacts = len(all_contact_ids)
    total_completed = len(completion_contact_ids)
    total_si_opp = len(si_contact_ids)

    answer_rate = (svarte_count / total_calls) if total_calls else 0.0
    completion_rate = (total_completed / total_contacts) if total_contacts else 0.0

    # Fill daily_series
    all_days = _daterange_inclusive(from_d, to_d)
    daily_series = []
    for day in all_days:
        daily_series.append(
            {
                'date': day.isoformat(),
                'calls': daily_calls.get(day, 0),
                'contacts': len(daily_contacts.get(day, set())),
                'completed': len(daily_completed.get(day, set())),
                'si_opp': len(daily_si.get(day, set())),
                'avg_duration': None,
            }
        )

    # by_agent (only when agent_id is "all")
    by_agent_list: list[dict[str, Any]] = []
    if not agent_id or agent_id.lower() == 'all':
        from django.contrib.auth import get_user_model

        User = get_user_model()
        agent_ids_sorted = sorted(agent_calls.keys(), key=lambda x: agent_calls[x], reverse=True)
        for aid in agent_ids_sorted:
            u = User.objects.filter(pk=aid).first()
            if not u:
                continue
            c = agent_calls[aid]
            sv = agent_svarte[aid]
            by_agent_list.append(
                {
                    'agent_id': str(aid),
                    'agent_name': _agent_display_name(u),
                    'calls': c,
                    'contacts': len(agent_contacts[aid]),
                    'completed': len(agent_completed[aid]),
                    'si_opp': len(agent_si[aid]),
                    'avg_duration': None,
                    'answer_rate': (sv / c) if c else 0.0,
                }
            )

    filters_applied = {
        'from': from_d.isoformat(),
        'to': to_d.isoformat(),
        'campaign_id': campaign_id if campaign_id else 'all',
        'agent_id': agent_id if agent_id else 'all',
    }

    return {
        'summary': {
            'total_calls': total_calls,
            'total_contacts': total_contacts,
            'total_completed': total_completed,
            'total_si_opp': total_si_opp,
            'avg_call_duration_seconds': None,
            'answer_rate': answer_rate,
            'completion_rate': completion_rate,
        },
        'daily_series': daily_series,
        'by_agent': by_agent_list,
        'by_category': by_category,
        'filters_applied': filters_applied,
    }


def _cache_key(from_d: date, to_d: date, campaign_id: str, agent_id: str) -> str:
    canonical = f'{from_d.isoformat()}|{to_d.isoformat()}|{campaign_id}|{agent_id}'
    h = hashlib.sha256(canonical.encode('utf-8')).hexdigest()[:32]
    return f'qc_admin_analytics_daily:{h}'


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsQCAdmin])
def admin_analytics_daily_view(request):
    params, err = _parse_params(request)
    if err:
        return err

    assert params is not None
    from_d = params['from_d']
    to_d = params['to_d']
    campaign_id = params['campaign_id']
    agent_id = params['agent_id']

    cache_key = _cache_key(from_d, to_d, campaign_id, agent_id)
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    payload = build_analytics_payload(from_d, to_d, campaign_id, agent_id)
    cache.set(cache_key, payload, timeout=CACHE_TTL)
    return Response(payload)
