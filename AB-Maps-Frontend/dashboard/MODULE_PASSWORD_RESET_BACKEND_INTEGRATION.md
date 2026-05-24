# Forgot Password — Backend Integration Guide

> **For the frontend Claude.** Self-service password reset via a time-limited
> email link. Two **public** endpoints (no auth). All user-facing copy is in
> Norwegian. Base URL as usual (`{NEXT_PUBLIC_API_URL}/api/...`).

## Why a link (not "email me my password")
Passwords are stored hashed and cannot be retrieved. The flow is: request → we
email a reset **link** → the user sets a new password on a frontend page.

## Endpoints

### 1. Request a reset
```
POST /api/users/auth/password-reset/
Body: { "email": "user@example.com" }
→ 200 { "message": "Hvis det finnes en konto med den e-posten, er en lenke for tilbakestilling sendt." }
```
- **Always 200** with that generic message, whether or not the email exists (no
  account enumeration). Just show: *"Sjekk innboksen din."*
- If the email matches multiple accounts (email isn't unique), each gets its own
  link.
- Rate-limited to **5/hour per IP** → may return **429** (show "prøv igjen senere").
- `400` only if `email` is missing.

The email contains a button + link to:
```
{FRONTEND_URL}/reset-password?uid=<uid>&token=<token>
```
`FRONTEND_URL` is configured per environment on the backend, so the link points
at the right host.

### 2. Confirm (set new password)
Build a page at **`/reset-password`** that reads `uid` and `token` from the query
string and submits the new password:
```
POST /api/users/auth/password-reset/confirm/
Body: { "uid": "<from query>", "token": "<from query>", "new_password": "..." }
→ 200 { "message": "Passordet er oppdatert. Du kan nå logge inn." }
→ 400 { "error": "Ugyldig eller utløpt lenke." }
→ 400 { "error": "Passordet er for svakt.", "fields": { "new_password": ["…"] } }
```
- On `200` → redirect to the login page with a success toast.
- On `400` → show `error`; if `fields.new_password` is present, show those
  validation messages under the password input.
- The link is valid for **48 hours** and becomes invalid once used (or once the
  password changes). Expired/used → the `400 "Ugyldig eller utløpt lenke."`.

## UX to wire
- **Login page:** add a **"Glemt passord?"** link → a small form that collects the
  email and calls endpoint #1, then shows "Sjekk innboksen din."
- **New route `/reset-password`:** reads `uid`+`token` from the URL, shows a
  "nytt passord" + "bekreft passord" form, calls endpoint #2. Handle the 200 /
  400(invalid link) / 400(weak password) cases above.
- Both endpoints are **public** — no auth header needed.

---

## Copy-paste prompt for the frontend Claude

> **Implement the forgot-password UI (Norwegian).** Backend is live with two
> public endpoints:
>
> 1. `POST /api/users/auth/password-reset/` `{ email }` → always `200` with a
>    generic message (never reveals if the account exists); may return `429`
>    (rate-limited 5/hour). Add a **"Glemt passord?"** link on the login page that
>    opens a simple email form; on submit call this and show *"Sjekk innboksen
>    din om en lenke for å tilbakestille passordet."*
> 2. Create a route **`/reset-password`** that reads `uid` and `token` from the
>    query string (the email link is `{FRONTEND_URL}/reset-password?uid=…&token=…`).
>    Show a form with "Nytt passord" + "Bekreft passord". On submit call
>    `POST /api/users/auth/password-reset/confirm/` `{ uid, token, new_password }`.
>    - `200` → redirect to login with a success toast *"Passordet er oppdatert."*
>    - `400 { error: "Ugyldig eller utløpt lenke." }` → show that the link is
>      invalid/expired with a button to request a new one.
>    - `400 { error: "Passordet er for svakt.", fields: { new_password: [...] } }`
>      → show the field messages under the password input.
>
> Both endpoints are public (no Authorization header). All copy in Norwegian. The
> link is valid 48 hours and one-time use. Match the existing auth-page styling.
