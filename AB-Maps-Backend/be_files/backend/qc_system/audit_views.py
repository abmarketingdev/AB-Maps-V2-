"""
QC Audit Trail API
==================
GET  /api/qc/admin/audit-log/         — paginated, filterable audit event list
GET  /api/qc/admin/audit-log/export/  — CSV export of filtered results
GET  /api/qc/admin/agents/            — all QC agents for the filter dropdown
"""
import csv
from datetime import datetime, time

from django.db.models import Q, Count, Case, When, IntegerField
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from users.models import User
from .models import AuditEvent
from .permissions import IsQCAdmin

# ── Human-readable labels for action_type slugs ──────────────────────────────
ACTION_LABEL = {
    'call_outcome':     'Samtaleresultat',
    'si_opp_flag':      'Si opp flagget',
    'utmeldt_flag':     'Utmeldt flagget',
    'comment_edit':     'Kommentar redigert',
    'bulk_transfer':    'Bulk overføring',
    'urgent_set':       'Haster satt',
    'urgent_cleared':   'Haster fjernet',
    'login':            'Innlogging',
    'logout':           'Utlogging',
    'import_started':   'Import startet',
    'import_completed': 'Import fullført',
    'settings_changed': 'Innstillinger endret',
}

# Max page_size allowed
MAX_PAGE_SIZE = 100
DEFAULT_PAGE_SIZE = 25


def _serialize_event(ev):
    """Serialize one AuditEvent to the API response dict."""
    campaign_name = None
    if ev.campaign_id and ev.campaign:
        campaign_name = ev.campaign.name

    return {
        'id': str(ev.id),
        'timestamp': ev.timestamp.isoformat(),
        'action_type': ev.action_type,
        'action_label': ACTION_LABEL.get(ev.action_type, ev.action_type),
        'status': ev.status,
        'agent': {
            'id': str(ev.agent_id) if ev.agent_id else None,
            'name': ev.agent_name,
            'agent_id_code': ev.agent_id_code,
        },
        'contact_id': str(ev.contact_id) if ev.contact_id else None,
        'customer_name': ev.customer_name or None,
        'phone_number': ev.phone_number or None,
        'campaign_name': campaign_name,
        'details': ev.details,
    }


def _build_qs(params):
    """Apply all query-param filters and return an ordered queryset."""
    qs = AuditEvent.objects.select_related('campaign').all()

    agent_id = params.get('agent_id', '').strip()
    if agent_id:
        qs = qs.filter(agent_id=agent_id)

    action_types = [a.strip() for a in params.get('action_type', '').split(',') if a.strip()]
    if action_types:
        qs = qs.filter(action_type__in=action_types)

    date_from = params.get('date_from', '').strip()
    if date_from:
        try:
            d = datetime.strptime(date_from, '%Y-%m-%d').date()
            qs = qs.filter(timestamp__gte=datetime.combine(d, time.min, tzinfo=timezone.utc))
        except ValueError:
            pass

    date_to = params.get('date_to', '').strip()
    if date_to:
        try:
            d = datetime.strptime(date_to, '%Y-%m-%d').date()
            qs = qs.filter(timestamp__lte=datetime.combine(d, time.max, tzinfo=timezone.utc))
        except ValueError:
            pass

    search = params.get('search', '').strip()
    if search:
        qs = qs.filter(
            Q(customer_name__icontains=search) |
            Q(phone_number__icontains=search) |
            Q(agent_name__icontains=search)
        )

    campaign_id = params.get('campaign', '').strip()
    if campaign_id:
        qs = qs.filter(campaign_id=campaign_id)

    ev_status = params.get('status', '').strip()
    if ev_status:
        qs = qs.filter(status=ev_status)

    return qs.order_by('-timestamp')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsQCAdmin])
def audit_log_list(request):
    """
    GET /api/qc/admin/audit-log/

    Paginated, filterable audit event list. QC admin only.
    """
    qs = _build_qs(request.query_params)

    # --- summary counts (always for today, regardless of filters) ---
    today = timezone.now().date()
    today_qs = AuditEvent.objects.filter(timestamp__date=today)
    summary = {
        'total_actions_today': today_qs.count(),
        'active_agents_today': today_qs.exclude(agent__isnull=True)
                                       .values('agent_id').distinct().count(),
        'flagged_count_today': today_qs.filter(status='flagged').count(),
    }

    # --- pagination ---
    try:
        page = max(1, int(request.query_params.get('page', 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        page_size = min(MAX_PAGE_SIZE, max(1, int(request.query_params.get('page_size', DEFAULT_PAGE_SIZE))))
    except (ValueError, TypeError):
        page_size = DEFAULT_PAGE_SIZE

    total = qs.count()
    offset = (page - 1) * page_size
    events = list(qs[offset: offset + page_size])

    base_url = request.build_absolute_uri(request.path)

    def _page_url(p):
        params = request.query_params.copy()
        params['page'] = str(p)
        params['page_size'] = str(page_size)
        return f"{base_url}?{'&'.join(f'{k}={v}' for k, v in params.items())}"

    total_pages = max(1, (total + page_size - 1) // page_size)
    next_url = _page_url(page + 1) if page < total_pages else None
    prev_url = _page_url(page - 1) if page > 1 else None

    return Response({
        'count': total,
        'next': next_url,
        'previous': prev_url,
        'summary': summary,
        'data': [_serialize_event(e) for e in events],
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsQCAdmin])
def audit_log_export(request):
    """
    GET /api/qc/admin/audit-log/export/

    CSV export of filtered audit events. Same filters as the list endpoint.
    """
    qs = _build_qs(request.query_params)

    filename = f"qc_audit_log_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    response.write('\ufeff')  # UTF-8 BOM so Excel opens correctly

    writer = csv.writer(response)
    writer.writerow([
        'Tidspunkt', 'Agent', 'Agent-ID',
        'Handlingstype', 'Kunde', 'Telefon',
        'Kampanje', 'Detaljer', 'Status',
    ])

    for ev in qs.select_related('campaign').iterator():
        campaign_name = ev.campaign.name if ev.campaign_id and ev.campaign else ''
        details_str = '; '.join(f'{k}={v}' for k, v in ev.details.items()) if ev.details else ''
        writer.writerow([
            ev.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            ev.agent_name,
            ev.agent_id_code,
            ACTION_LABEL.get(ev.action_type, ev.action_type),
            ev.customer_name,
            ev.phone_number,
            campaign_name,
            details_str,
            ev.status,
        ])

    return response


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated, IsQCAdmin])
def audit_agents_list(request):
    """
    GET /api/qc/admin/agents/

    All QC users (employees + admins) for the agent filter dropdown.
    """
    users = (
        User.objects.filter(
            Q(employee_type='qc_emp') | Q(admin_type='qc_admin', is_superuser=True)
        )
        .order_by('first_name', 'last_name')
    )

    data = []
    for u in users:
        name = f"{u.first_name} {u.last_name}".strip() or u.username
        user_type = 'qc_admin' if (u.admin_type == 'qc_admin' and u.is_superuser) else 'qc_employee'
        data.append({
            'id': str(u.id),
            'name': name,
            'agent_id_code': u.ab_person_id or '',
            'email': u.email or '',
            'user_type': user_type,
            'is_active': u.is_active,
        })

    return Response({
        'success': True,
        'count': len(data),
        'data': data,
    })
