// P5 (09.11): area lists newest first. The server already sends them in this order
// (assigned_to_me / my_areas / nearby), this is a safety net for any other source.
// «Newest» = when the area was assigned to me (assigned_at), else when it was created.
export const NEW_AREA_DAYS = 3;

const ts = (a) => {
  const t = Date.parse((a && (a.assigned_at || a.created_at)) || '');
  return Number.isNaN(t) ? 0 : t;
};

export const sortAreasNewestFirst = (areas) =>
  [...(areas || [])].sort((a, b) =>
    ts(b) - ts(a) || String(a?.name || '').localeCompare(String(b?.name || ''), 'nb'));

// The server's is_new wins; fall back to the same 3-day rule for older payloads.
export const isNewArea = (a) => {
  if (!a) return false;
  if (typeof a.is_new === 'boolean') return a.is_new;
  const t = ts(a);
  return t > 0 && Date.now() - t <= NEW_AREA_DAYS * 24 * 60 * 60 * 1000;
};
