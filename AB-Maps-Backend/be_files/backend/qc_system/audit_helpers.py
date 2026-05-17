"""
audit_helpers.py — thin wrapper around AuditEvent.objects.create()

Import this at each trigger point in views.py:
    from .audit_helpers import record_audit

Never raises — audit failures must never block the main flow.
"""
import logging

logger = logging.getLogger(__name__)


def record_audit(*, action_type, user=None, contact=None, details=None, status='success'):
    """
    Write one AuditEvent row.

    Parameters
    ----------
    action_type : str   — one of AuditEvent.ACTION_TYPES slugs
    user        : User  — the acting user (None for system actions)
    contact     : QCContact | None
    details     : dict  — arbitrary JSON payload for this action_type
    status      : str   — 'success' | 'error' | 'flagged'
    """
    from .models import AuditEvent  # local import avoids circular imports

    try:
        agent_name = ''
        agent_id_code = ''
        if user is not None:
            agent_name = f"{user.first_name} {user.last_name}".strip() or user.username
            agent_id_code = user.ab_person_id or ''

        customer_name = ''
        phone_number = ''
        campaign = None
        if contact is not None:
            full = f"{contact.first_name or ''} {contact.last_name or ''}".strip()
            customer_name = full or contact.customer_name or ''
            phone_number = contact.phone_number or ''
            campaign = contact.campaign

        AuditEvent.objects.create(
            action_type=action_type,
            status=status,
            agent=user,
            agent_name=agent_name,
            agent_id_code=agent_id_code,
            contact=contact,
            customer_name=customer_name,
            phone_number=phone_number,
            campaign=campaign,
            details=details or {},
        )
    except Exception:
        # Audit must never crash the calling view
        logger.exception(
            "Failed to write audit event: action_type=%s user=%s",
            action_type,
            getattr(user, 'username', None),
        )
