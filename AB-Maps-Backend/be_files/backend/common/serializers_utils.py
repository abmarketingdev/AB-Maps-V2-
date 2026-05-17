from django.utils import timezone

STATUS_COLORS = {
    "ja": "#28a745",
    "ikke_hjemme": "#ffc107",
    "nei": "#dc3545",
    "folg_opp": "#007bff",
}

def isoz(dt):
    """Convert datetime to ISO format with 'Z' suffix for UTC."""
    if not dt:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.utc)
    else:
        dt = dt.astimezone(timezone.utc)
    s = dt.isoformat()
    return s.replace("+00:00", "Z")

def to_point(lon, lat):
    """Convert longitude and latitude to GeoJSON Point."""
    if lon is None or lat is None:
        return None
    return {"type": "Point", "coordinates": [float(lon), float(lat)]}

def normalize_tags(tags):
    """Normalize tags to a consistent list format."""
    if tags is None:
        return []
    if isinstance(tags, list):
        return [str(t) for t in tags]
    if isinstance(tags, dict):
        truthy = [k for k, v in tags.items() if v]
        return [str(x) for x in (truthy or list(tags.keys()))]
    return []
