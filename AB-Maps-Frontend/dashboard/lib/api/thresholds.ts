// Effective threshold — live backend adapter (Module 1, guide §5).
// GET /api/dashboard/analytics/thresholds/effective/?employee_id=&campaign_id=
// Returns the single resolved Threshold (most-specific wins). For an employee
// token, employee_id is overridden server-side to their own id.

import { getJSON } from '@/lib/auth/fetchWithAuth';
import type { Threshold } from '@/services/analyticsService';
import type { PerfThreshold } from '@/components/dashboard/v2/employee/employeeLogic';

export function mapThreshold(t?: Threshold | null): PerfThreshold {
  // Tolerate a missing/partial threshold so a stats payload without one never throws
  // (was the cause of "Kunne ikke laste statistikken din").
  const s = (t ?? {}) as Partial<Threshold>;
  return {
    doorsDay: s.min_doors_per_day ?? 0,
    doorsWeek: s.min_doors_per_week ?? 0,
    minJa: s.min_yes_rate_percent ?? 0,
    maxNei: s.max_no_rate_percent ?? 0,
    minContact: s.min_contact_rate_percent ?? 0,
    consecutiveDays: s.consecutive_days_threshold ?? 0,
    dropAlert: s.performance_drop_alert_percent ?? 0,
    maxInactiveHours: s.max_inactive_hours ?? 0,
  };
}

/** Fetch + map the resolved effective threshold for the given scope. */
export async function fetchEffectiveThreshold(
  opts: { employeeId?: string; campaignId?: string } = {},
): Promise<PerfThreshold> {
  const qs = new URLSearchParams();
  if (opts.employeeId) qs.set('employee_id', opts.employeeId);
  if (opts.campaignId) qs.set('campaign_id', opts.campaignId);
  const q = qs.toString();
  const raw = await getJSON<Threshold>(
    `/api/dashboard/analytics/thresholds/effective/${q ? `?${q}` : ''}`,
  );
  return mapThreshold(raw);
}
