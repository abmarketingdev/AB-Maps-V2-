/**
 * Single source of truth for opening the AB Maps Leaflet apps from the dashboard.
 *
 * Routes by role and emits the token in the shape each map app parses:
 *  - manager/admin/superuser -> MANAGER app, `?token=<URL-encoded JSON {access,refresh}>`
 *    (manager `authService.getTokenFromUrl` JSON-parses this).
 *  - employee                 -> EMPLOYEE app, `?accessToken=<rawJWT>&refreshToken=<rawJWT>`
 *    (emp `App.js` reads accessToken/token + refreshToken). NEVER send a raw JWT under
 *    `token=` to the manager app — it would JSON.parse and fail.
 *
 * The token/validate -> location-permission -> verify handoff inside the map apps is unchanged;
 * this only builds the correct launch URL.
 */
import { isManagerLevel, type UserType } from "@/lib/auth/authService";

interface LaunchUser {
  user_type?: UserType;
  user_info?: { id?: string | null } | null;
}

interface LaunchOptions {
  /** Campaign to preselect in the map (falls back to none). */
  campaignId?: string | null;
  /** Force same-tab (default: employee same-tab, manager new-tab). */
  sameTab?: boolean;
}

function bail(message: string) {
  if (typeof window !== "undefined") {
    alert(message);
    window.location.href = "/login";
  }
}

/** Open the correct AB Maps app for the given user. Returns true if a URL was launched. */
export function launchMap(user: LaunchUser | null | undefined, opts: LaunchOptions = {}): boolean {
  if (typeof window === "undefined") return false;

  const raw = localStorage.getItem("auth_tokens");
  if (!raw) {
    bail("Ingen autentiseringstoken funnet. Vennligst logg inn igjen.");
    return false;
  }
  let tokens: { access?: string; refresh?: string };
  try {
    tokens = JSON.parse(raw);
  } catch {
    bail("Autentiseringsfeil. Vennligst logg inn igjen.");
    return false;
  }
  if (!tokens.access) {
    bail("Ugyldig autentiseringstoken. Vennligst logg inn igjen.");
    return false;
  }

  const isManager = isManagerLevel(user?.user_type);
  const campaignId = opts.campaignId ?? null;
  let url: string;

  if (isManager) {
    const base = process.env.NEXT_PUBLIC_AB_MAPS_MANAGER_URL;
    url = `${base}/?token=${encodeURIComponent(JSON.stringify(tokens))}`;
    if (campaignId) url += `&campaign_id=${encodeURIComponent(campaignId)}`;
  } else {
    const base = process.env.NEXT_PUBLIC_AB_MAPS_EMPLOYEE_URL;
    const employeeId = user?.user_info?.id;
    url = `${base}/?accessToken=${encodeURIComponent(tokens.access)}`;
    if (tokens.refresh) url += `&refreshToken=${encodeURIComponent(tokens.refresh)}`;
    if (employeeId) url += `&employee_id=${encodeURIComponent(employeeId)}`;
    if (campaignId) url += `&campaign_id=${encodeURIComponent(campaignId)}`;
  }

  // Manager opens in a new tab (dashboard stays put); employee navigates in place.
  const sameTab = opts.sameTab ?? !isManager;
  if (sameTab) window.location.href = url;
  else window.open(url, "_blank");
  return true;
}

/** Read the currently-selected campaign id from localStorage (`currentCampaign`). */
export function currentCampaignId(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("currentCampaign");
  if (!raw) return null;
  try {
    return JSON.parse(raw)?.id ?? null;
  } catch {
    return raw;
  }
}
