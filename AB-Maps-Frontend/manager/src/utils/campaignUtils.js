/**
 * Campaign helpers — Nei subcategory / Talkmore gating.
 */

/**
 * Parse campaign object from localStorage.
 * Accepts JSON object string under `currentCampaign` / `selectedCampaign`,
 * and falls back to `{ id: <raw> }` if raw value is not JSON.
 *
 * @returns {object|null}
 */
export function readCampaignFromStorage() {
  const raw =
    localStorage.getItem('currentCampaign') ||
    localStorage.getItem('selectedCampaign');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {
    return { id: raw };
  }

  return null;
}

/**
 * Prefer in-memory campaign, fallback to localStorage campaign.
 * @param {object|null|undefined} campaign
 * @returns {object|null}
 */
export function resolveCampaign(campaign) {
  if (campaign && typeof campaign === 'object') return campaign;
  return readCampaignFromStorage();
}

/**
 * @param {object|null|undefined} campaign - Campaign object with `name`.
 * @returns {boolean} True if campaign name includes "talkmore" (case-insensitive).
 */
export function isTalkmoreCampaign(campaign) {
  const resolved = resolveCampaign(campaign);
  const name = resolved?.name;
  if (typeof name !== 'string') return false;
  return name.toLowerCase().includes('talkmore');
}

/**
 * Runs talkmore detection and logs a structured line for debugging.
 * @param {object|null|undefined} campaign
 * @param {string} [source='app']
 * @returns {boolean}
 */
export function logIsTalkmoreCampaign(campaign, source = 'app') {
  const resolved = resolveCampaign(campaign);
  const usesNeiSubcategories = isTalkmoreCampaign(resolved);

  console.log('[TalkmoreCampaign][isTalkmoreCampaign]', {
    app: 'manager',
    source,
    campaignId: resolved?.id ?? null,
    campaignName: resolved?.name ?? null,
    usesNeiSubcategories,
    usedStorageFallback: !campaign && !!resolved,
  });

  return usesNeiSubcategories;
}
