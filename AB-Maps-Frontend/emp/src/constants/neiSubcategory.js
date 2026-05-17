/**
 * Nei visit-outcome subcategory — API contract matches backend serializer.
 * @see prompts_org/employee_maps/FRONTEND_HANDOFF_NEI_SUBCATEGORY.md
 */

/** @typedef {'ikke_interessert'|'darlig_erfaring'|'bindingstid'|'bedrift'|'pris'|'eksisterende_kunde'} NeiSubcategory */

/** @type {readonly NeiSubcategory[]} */
export const NEI_SUBCATEGORY_VALUES = Object.freeze([
  'ikke_interessert',
  'darlig_erfaring',
  'bindingstid',
  'bedrift',
  'pris',
  'eksisterende_kunde',
]);

/** Display labels (Norwegian UI). API uses ASCII values (e.g. darlig_erfaring). */
/** @type {Readonly<Record<NeiSubcategory, string>>} */
export const NEI_SUBCATEGORY_LABELS = Object.freeze({
  ikke_interessert: 'Ikke interessert',
  darlig_erfaring: 'Dårlig erfaring',
  bindingstid: 'Bindingstid',
  bedrift: 'Bedrift',
  pris: 'Pris',
  eksisterende_kunde: 'Eksisterende kunde',
});

/** Label when user does not pick a reason (maps to null / omit per endpoint). */
export const NEI_SUBCATEGORY_UNSPECIFIED_LABEL = 'Ikke spesifisert';

/**
 * @param {string|null|undefined} value
 * @returns {value is NeiSubcategory}
 */
export function isNeiSubcategory(value) {
  return typeof value === 'string' && NEI_SUBCATEGORY_VALUES.includes(/** @type {NeiSubcategory} */ (value));
}

/**
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function labelForNeiSubcategory(value) {
  if (value == null || value === '') return NEI_SUBCATEGORY_UNSPECIFIED_LABEL;
  return NEI_SUBCATEGORY_LABELS[/** @type {NeiSubcategory} */ (value)] ?? String(value);
}

/**
 * Drop nei_subcategory when status is explicitly set to something other than nei.
 * (Do not strip when status is omitted — e.g. PATCH only nei_subcategory on existing Nei.)
 * @param {Record<string, unknown>} payload
 * @returns {Record<string, unknown>}
 */
export function sanitizeAddressWritePayload(payload) {
  const out = { ...payload };
  if (Object.prototype.hasOwnProperty.call(out, 'status') && out.status !== 'nei') {
    delete out.nei_subcategory;
  }
  return out;
}
