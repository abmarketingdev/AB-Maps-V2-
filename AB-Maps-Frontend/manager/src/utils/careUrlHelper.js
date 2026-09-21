/**
 * CARE campaign — when an address is marked "Ja", open the CARE portal in a new tab
 * and put the address on the clipboard so the seller can paste it into the form.
 *
 * Mirrors utils/nrcUrlHelper.js. Difference: the CARE portal is a plain login page
 * that takes no address parameters, so instead of building a query string we copy
 * the address text.
 *
 * ORDER MATTERS (both steps must stay inside the user's tap):
 *   1. copy  — synchronous, while the document still has focus. navigator.clipboard
 *              throws "Document is not focused" once a new tab takes over, so the
 *              synchronous execCommand path is the primary one here.
 *   2. open  — window.open must run before any `await`, or the browser blocks it.
 */
import { readCampaignFromStorage } from './campaignUtils';

export const CARE_CAMPAIGN_ID = 'e400d098-971b-4346-83b3-5ea9c42a1105';
export const CARE_URL = 'https://care.absystem.no/';

/**
 * True when the selected campaign is CARE.
 * `currentCampaign` is stored in three different shapes ({id,name} | {id} | raw uuid),
 * so we match on the id first (present in all of them) and only then on the name.
 */
export const isCareCampaign = () => {
  const campaign = readCampaignFromStorage();
  if (!campaign) return false;
  if (campaign.id && String(campaign.id) === CARE_CAMPAIGN_ID) return true;
  const name = typeof campaign.name === 'string' ? campaign.name.toLowerCase().trim() : '';
  return name === 'care';
};

/** Open the CARE portal. Falls back to a synthetic <a> click when popups are blocked. */
const openCareTab = () => {
  const opened = window.open(CARE_URL, '_blank', 'noopener,noreferrer');
  if (!opened || opened.closed || typeof opened.closed === 'undefined') {
    console.warn('[CARE] Popup blocked, falling back to a link click');
    const link = document.createElement('a');
    link.href = CARE_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

/** Copy synchronously so opening the tab afterwards cannot defeat it. */
const copyAddress = (text, showToast) => {
  let copied = false;
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length); // iOS needs an explicit range
    copied = document.execCommand('copy');
    document.body.removeChild(ta);
  } catch (err) {
    copied = false;
  }

  if (copied) {
    showToast?.(`Adressen er kopiert: ${text}`, 'success');
    return;
  }

  // Browsers that have dropped execCommand. This can still fail if the new tab has
  // taken focus, so report honestly instead of claiming success.
  try {
    navigator.clipboard
      ?.writeText(text)
      .then(() => showToast?.(`Adressen er kopiert: ${text}`, 'success'))
      .catch(() => showToast?.('Kunne ikke kopiere adressen – kopier den manuelt', 'warning'));
  } catch (err) {
    showToast?.('Kunne ikke kopiere adressen – kopier den manuelt', 'warning');
  }
};

/**
 * The whole CARE "Ja" side-effect. Call it FIRST in the click handler, before any await.
 *
 * @param {string} addressText          e.g. "Storgata 10, 0184 Oslo"
 * @param {object} [opts]
 * @param {string} [opts.apartmentNumber] appended when marking an apartment
 * @param {function} [opts.showToast]     (message, type) from useMapState
 */
export const handleCareJa = (addressText, { apartmentNumber, showToast } = {}) => {
  const full = [addressText, apartmentNumber].filter(Boolean).join(', ');
  console.log('[CARE] "Ja" on CARE campaign — copying address and opening portal:', full);
  copyAddress(full, showToast);
  openCareTab();
};
