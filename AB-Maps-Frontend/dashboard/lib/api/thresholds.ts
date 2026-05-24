// Effective threshold — live backend adapter (Module 1, guide §5).
// GET /api/dashboard/analytics/thresholds/effective/?employee_id=&campaign_id=
// Returns the single resolved Threshold (most-specific wins). For an employee
// token, employee_id is overridden server-side to their own id.

import { getJSON } from '@/lib/auth/fetchWithAuth';
import type { Threshold } from '@/services/analyticsService';
import type { PerfThreshold } from '@/components/dashboard/v2/employee/employeeLogic';

export function mapThreshold(t: Threshold): PerfThreshold {
  return {
    doorsDay: t.min_doors_per_day,
    doorsWeek: t.min_doors_per_week,
    minJa: t.min_yes_rate_percent,
    maxNei: t.max_no_rate_percent,
    minContact: t.min_contact_rate_percent,
    consecutiveDays: t.consecutive_days_threshold,
    dropAlert: t.performance_drop_alert_percent,
    maxInactiveHours: t.max_inactive_hours,
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
