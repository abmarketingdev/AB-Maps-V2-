/**
 * Build a user-visible message from Django REST framework-style JSON error bodies.
 * @param {unknown} data - Parsed JSON from error response
 * @param {number} [status] - HTTP status fallback
 * @returns {string}
 */
export function formatDrfErrorBody(data, status) {
  if (data == null) {
    return status ? `Feil (${status})` : 'Noe gikk galt';
  }
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);

  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => (typeof d === 'string' ? d : d?.string || JSON.stringify(d)))
      .join(' ');
  }

  const parts = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === 'detail') continue;
    if (val == null) continue;
    const label =
      key === 'nei_subcategory'
        ? 'Årsak (Nei)'
        : key === 'non_field_errors'
          ? ''
          : key.replace(/_/g, ' ');
    const msgs = Array.isArray(val)
      ? val.map((m) => (typeof m === 'string' ? m : String(m)))
      : [typeof val === 'string' ? val : String(val)];
    const line = label ? `${label}: ${msgs.join(', ')}` : msgs.join(', ');
    if (line) parts.push(line);
  }
  if (parts.length) return parts.join(' — ');
  if (typeof data.message === 'string') return data.message;
  return status ? `Feil (${status})` : 'Validering feilet';
}

/**
 * @param {Response} response
 * @returns {Promise<string>}
 */
export async function messageFromErrorResponse(response) {
  const status = response?.status;
  try {
    const text = await response.text();
    if (!text) return status ? `Feil (${status})` : 'Forespørsel feilet';
    try {
      return formatDrfErrorBody(JSON.parse(text), status);
    } catch {
      return text.length > 200 ? `${text.slice(0, 200)}…` : text;
    }
  } catch {
    return status ? `Feil (${status})` : 'Forespørsel feilet';
  }
}
