"""
QC campaign-specific rules (3rd call attempt for Blå Kors, etc.).
"""
from django.conf import settings


def campaign_allows_third_attempt(campaign):
    """
    True when this campaign uses the third call-attempt column (tredje_oppring).
    Matched by UUID in QC_THIRD_ATTEMPT_CAMPAIGN_IDS or name substring in
    QC_THIRD_ATTEMPT_NAME_SUBSTRINGS.
    """
    if not campaign:
        return False
    ids = getattr(settings, 'QC_THIRD_ATTEMPT_CAMPAIGN_IDS', None) or []
    if ids and str(campaign.id) in ids:
        return True
    name = (campaign.name or '').lower().strip()
    for sub in getattr(settings, 'QC_THIRD_ATTEMPT_NAME_SUBSTRINGS', None) or []:
        if sub and sub.lower() in name:
            return True
    return False


def active_columns_for_campaign(campaign):
    """Column order for get_next / dashboard active_columns for this campaign."""
    base = ['til_behandling', 'forste_oppring', 'andre_oppring']
    if campaign_allows_third_attempt(campaign):
        return base + ['tredje_oppring']
    return list(base)


def default_active_columns_union():
    """Fallback when no single campaign (e.g. mixed); includes 3rd for any possible match."""
    return ['til_behandling', 'forste_oppring', 'andre_oppring', 'tredje_oppring']


def campaign_ids_for_third_attempt():
    """DB campaign PKs that use the third call-attempt workflow."""
    from django.db.models import Q
    from campaigns.models import Campaign

    ids = list(getattr(settings, 'QC_THIRD_ATTEMPT_CAMPAIGN_IDS', None) or [])
    substrings = getattr(settings, 'QC_THIRD_ATTEMPT_NAME_SUBSTRINGS', None) or []
    q = Q(pk__in=ids) if ids else Q(pk__in=[])
    for sub in substrings:
        if sub:
            q |= Q(name__icontains=sub)
    if not ids and not any(substrings):
        return []
    return list(Campaign.objects.filter(q).values_list('id', flat=True))
