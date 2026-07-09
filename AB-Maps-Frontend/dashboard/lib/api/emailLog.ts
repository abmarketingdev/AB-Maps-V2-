// Email-Log — sent deviation-alert / digest / weekly-report history. Superuser/admin only.
// Two-tier: light list, detail on click. Reads /api/dashboard/email-log/.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export type EmailKind = 'deviation_alert' | 'deviation_digest' | 'weekly_report';

export interface EmailLogRow {
  id: string;
  kind: EmailKind | string;
  kind_label: string;
  recipient_name: string;
  recipient_email: string;
  status: 'sent' | 'failed' | string;
  sent_at: string | null;
  created_at: string | null;
  team_count: number;
  flagged_count: number;
}

export interface EmailLogFlagged {
  person_id: string;
  name: string;
  person_kind: 'employee' | 'manager' | string;
  today_doors?: number;
  personal_average?: number;
  baseline?: number;
  shortfall_pct?: number;
  streak_len?: number;
  streak_days?: { day: string; doors: number }[];
}

export interface EmailLogDetail extends Omit<EmailLogRow, 'team_count' | 'flagged_count'> {
  error_message: string;
  pdf_size_bytes: number | null;
  teams: { team_id: string; name: string }[];
  flagged: EmailLogFlagged[];
}

const qp = (p: Record<string, string | undefined>): string => {
  const qs = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v) qs.set(k, v); });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

export function fetchEmailLog(opts: { startDate?: string; endDate?: string; salesChiefId?: string; kind?: string } = {}):
  Promise<{ count: number; results: EmailLogRow[] }> {
  return getJSON(`/api/dashboard/email-log/${qp({ start_date: opts.startDate, end_date: opts.endDate, sales_chief_id: opts.salesChiefId, kind: opts.kind })}`);
}

export function fetchEmailLogDetail(id: string): Promise<EmailLogDetail> {
  return getJSON(`/api/dashboard/email-log/${id}/`);
}
