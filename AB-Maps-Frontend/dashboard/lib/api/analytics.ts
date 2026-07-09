// Analytics — live adapter for /api/dashboard/analytics/ (preview, work-time-stats).
// Manager/admin, team-scoped. preview enforces a max 90-day range.

import { getJSON, fetchWithAuth } from '@/lib/auth/fetchWithAuth';

export interface AnSummary {
  total_doors: number; doors_per_day: number;
  ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  yes_rate: number; no_rate: number; not_home_rate: number; follow_up_rate: number; contact_rate: number;
  unique_employees: number; avg_doors_per_employee: number; period_days: number;
}
export interface AnComparison { current: number; previous: number; change: number; change_pct: number }
// Talkmore-only rejection-reason breakdown (set when campaign.is_talkmore).
export interface NeiBreakdown {
  ikke_interessert: number; darlig_erfaring: number; bindingstid: number;
  bedrift: number; pris: number; eksisterende_kunde: number; unspecified: number;
}
export interface AnCampaign {
  campaign_id: string; campaign_name: string;
  total_doors: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  yes_rate: number; no_rate: number; not_home_rate: number; follow_up_rate: number; contact_rate: number;
  num_employees: number;
  is_talkmore?: boolean;
  nei_breakdown?: NeiBreakdown;
}
export interface AnEmployee {
  employee_id: string; employee_name: string; worker_type: 'manager' | 'employee';
  total_doors: number; doors_per_day: number;
  ja: number; nei: number; ikke_hjemme: number; folg_opp: number;
  yes_rate: number; no_rate: number; not_home_rate: number; follow_up_rate: number; contact_rate: number;
  daily_door_counts: Record<string, number>; consistency_score: number;
}
export interface AnDaily { date: string; total_doors: number; ja: number; nei: number; ikke_hjemme: number; folg_opp: number; yes_rate: number }
export interface AnHourly { hour: number; total_doors: number; ja: number; yes_rate: number }
export interface AnPerfEntry { employee_id: string; employee_name: string; value: number }
export interface AnTopPerformers { top_yes_rate: AnPerfEntry; top_doors: AnPerfEntry; bottom_yes_rate: AnPerfEntry; bottom_doors: AnPerfEntry }
export interface AnAlertDaily {
  date: string; doors?: number; ja?: number; yes_rate?: number; value?: number;
  below_doors_threshold?: boolean; below_yes_rate_threshold?: boolean;
  classification?: 'full' | 'non_full' | 'off';
}
// Effective workday-classification thresholds (echoed by the preview API).
export interface DayClassification {
  full_day_doors: number; half_day_doors: number; day_tolerance_pct: number; full_day_cutoff: number;
}
export interface AnAlert {
  alert_type: string; severity: 'critical' | 'warning' | string;
  employee_id: string; employee_name: string; campaign_id: string | null; campaign_name: string | null;
  current_value: number; threshold_value: number; consecutive_days: number; message: string;
  daily_details: AnAlertDaily[];
}
export interface AnWorkGroup { total: number; active_count: number; active_pct: number; avg_daily_seconds: number; avg_daily_minutes: number }
export interface AnWorkTimeSummary { period_days: number; active_threshold_seconds: number; employees: AnWorkGroup; managers: AnWorkGroup; combined: AnWorkGroup }

export interface AnalyticsPreview {
  period: { start_date: string; end_date: string; days: number };
  summary: AnSummary;
  previous_period_summary: AnSummary;
  comparisons: { total_doors: AnComparison; yes_rate: AnComparison; no_rate: AnComparison; contact_rate: AnComparison; doors_per_day: AnComparison };
  campaigns: AnCampaign[];
  employees: AnEmployee[];
  daily_breakdown: AnDaily[];
  hourly_breakdown: AnHourly[];
  top_performers: AnTopPerformers;
  work_time_summary: AnWorkTimeSummary;
  alerts: AnAlert[];
  day_classification?: DayClassification;
}

export interface WorkTimePerson { id: string; name: string; total_seconds: number; total_minutes: number; avg_daily_seconds: number; avg_daily_minutes: number; is_active: boolean }
export interface WorkTimeStats {
  period: { start_date: string; end_date: string; days: number };
  active_threshold_seconds: number;
  aggregate: { employees: AnWorkGroup; managers: AnWorkGroup; combined: AnWorkGroup };
  employees: WorkTimePerson[];
  managers: WorkTimePerson[];
}

export interface AnalyticsParams { startDate: string; endDate: string; campaignIds?: string[]; employeeIds?: string[]; thresholdId?: string }

function qp(p: AnalyticsParams): string {
  const qs = new URLSearchParams();
  qs.set('start_date', p.startDate);
  qs.set('end_date', p.endDate);
  if (p.campaignIds && p.campaignIds.length) qs.set('campaign_ids', p.campaignIds.join(','));
  // Sales-chief scoping passes the team members' employee ids (backend accepts CSV).
  if (p.employeeIds && p.employeeIds.length) qs.set('employee_ids', p.employeeIds.join(','));
  // Apply-Thresholds "what-if": recompute the whole view against this threshold set (view-only).
  if (p.thresholdId) qs.set('threshold_id', p.thresholdId);
  return qs.toString();
}

export function fetchAnalyticsPreview(p: AnalyticsParams): Promise<AnalyticsPreview> {
  return getJSON<AnalyticsPreview>(`/api/dashboard/analytics/preview/?${qp(p)}`);
}
export function fetchWorkTimeStats(p: AnalyticsParams): Promise<WorkTimeStats> {
  return getJSON<WorkTimeStats>(`/api/dashboard/analytics/work-time-stats/?${qp(p)}`);
}

// Download the analytics PDF (same filters as preview). Returns the binary blob
// + the server-provided filename. Manager/admin only.
export async function downloadAnalyticsPdf(p: AnalyticsParams): Promise<{ blob: Blob; filename: string }> {
  const res = await fetchWithAuth(`/api/dashboard/analytics/download/?${qp(p)}`, { method: 'GET' });
  if (!res.ok) throw new Error(`Nedlasting feilet (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') ?? '';
  const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const filename = m ? decodeURIComponent(m[1]) : `AB_Maps_Analytics_${p.startDate}_${p.endDate}.pdf`;
  return { blob, filename };
}

export interface TriggerEmailResponse { status: string; message: string; period?: unknown; report_id?: string }

// Generate the last-7-days report and email it as a PDF. Admin only. No date range.
export async function triggerAnalyticsEmail(emails: string[]): Promise<TriggerEmailResponse> {
  const res = await fetchWithAuth('/api/dashboard/analytics/trigger/', {
    method: 'POST',
    body: JSON.stringify({ recipient_emails: emails }),
  });
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok) {
    const msg = (data as { message?: string; detail?: string }).message
      ?? (data as { detail?: string }).detail
      ?? `Sending feilet (${res.status})`;
    throw new Error(msg);
  }
  return data as TriggerEmailResponse;
}

// minutes helper
export function fmtMin(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return `${h}t ${m}m`;
}
