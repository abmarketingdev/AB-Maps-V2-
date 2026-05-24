// Forgot-password — two PUBLIC endpoints (no auth). Norwegian copy.
import { buildApiUrl } from '@/lib/config/apiConfig';

const GENERIC = 'Hvis det finnes en konto med den e-posten, er en lenke for tilbakestilling sendt.';

export interface RequestResult { ok: boolean; rateLimited: boolean; message: string }

// POST /password-reset/ — always 200 with a generic message (no enumeration); may 429.
export async function requestPasswordReset(email: string): Promise<RequestResult> {
  try {
    const res = await fetch(buildApiUrl('/api/users/auth/password-reset/'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
    });
    if (res.status === 429) return { ok: false, rateLimited: true, message: 'For mange forsøk. Vennligst prøv igjen senere.' };
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    return { ok: res.ok, rateLimited: false, message: (data.message as string) || GENERIC };
  } catch {
    return { ok: false, rateLimited: false, message: 'Noe gikk galt. Sjekk nettverket og prøv igjen.' };
  }
}

export interface ConfirmResult {
  ok: boolean; status: number; message?: string; error?: string; fieldErrors?: string[];
}

// POST /password-reset/confirm/ — { uid, token, new_password }.
export async function confirmPasswordReset(body: { uid: string; token: string; new_password: string }): Promise<ConfirmResult> {
  try {
    const res = await fetch(buildApiUrl('/api/users/auth/password-reset/confirm/'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (res.ok) return { ok: true, status: res.status, message: (data.message as string) || 'Passordet er oppdatert. Du kan nå logge inn.' };
    const fields = data.fields as { new_password?: string[] } | undefined;
    return {
      ok: false, status: res.status,
      error: (data.error as string) || 'Noe gikk galt. Prøv igjen.',
      fieldErrors: fields?.new_password,
    };
  } catch {
    return { ok: false, status: 0, error: 'Noe gikk galt. Sjekk nettverket og prøv igjen.' };
  }
}
