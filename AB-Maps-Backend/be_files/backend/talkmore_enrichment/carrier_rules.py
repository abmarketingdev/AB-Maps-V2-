"""
Talkmore enrichment: which carrier names count as allowed for marking.

An address is marked ONLY if EVERY distinct carrier at that address is allowed.
Any other carrier (ONECALL, Ice, Unknown, etc.) excludes the address.
"""
from __future__ import annotations


def carrier_is_allowed_for_marker(carrier_name: str) -> bool:
    """
    Allowed: Talkmore, Telenor (incl. Telenor Norge AS), Unifon, Phonero.
    Not allowed: Unknown, Ice, OneCall, Telia, etc.
    """
    if carrier_name is None:
        return False
    u = str(carrier_name).upper().strip()
    if not u or u == "UNKNOWN":
        return False
    if u == "TALKMORE" or u.startswith("TALKMORE "):
        return True
    if "UNIFON" in u:
        return True
    if "PHONERO" in u:
        return True
    if "TELENOR" in u:
        return True
    return False


def address_show_marker_from_carrier_summary(carrier_summary: dict) -> bool:
    """
    True iff carrier_summary is non-empty and every carrier key is allowed.
    """
    if not carrier_summary:
        return False
    for key in carrier_summary.keys():
        if key is None:
            return False
        if not carrier_is_allowed_for_marker(str(key)):
            return False
    return True


def carrier_is_telenor_or_talkmore_only(carrier_name: str) -> bool:
    """Subset check: Telenor or Talkmore (no Unifon/Phonero). For apartment UI labels."""
    if carrier_name is None:
        return False
    u = str(carrier_name).upper().strip()
    if not u or u == "UNKNOWN":
        return False
    if u == "TALKMORE" or u.startswith("TALKMORE "):
        return True
    if "TELENOR" in u:
        return True
    return False


def carrier_is_business_allowed(carrier_name: str) -> bool:
    if carrier_name is None:
        return False
    u = str(carrier_name).upper().strip()
    return "UNIFON" in u or "PHONERO" in u


def apartment_carrier_status(carrier_summary: dict) -> str:
    """
    Returns status string for building/apartment APIs when carrier_summary is non-empty.
    """
    if not carrier_summary:
        return "not_enriched"
    if not address_show_marker_from_carrier_summary(carrier_summary):
        return "other_carriers"
    keys = [str(k) for k in carrier_summary.keys() if k]
    has_business = any(carrier_is_business_allowed(k) for k in keys)
    only_tt = all(carrier_is_telenor_or_talkmore_only(k) for k in keys)
    if only_tt:
        return "telenor_talkmore_available"
    if has_business:
        return "business_carrier"
    return "other_carriers"
