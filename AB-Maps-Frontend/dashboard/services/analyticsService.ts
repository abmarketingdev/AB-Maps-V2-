/**
 * Analytics API Service
 *
 * Service for interacting with the Analytics API endpoints:
 *   - Threshold CRUD  (GET / POST / PATCH / DELETE)
 *   - Preview         (GET  – JSON analytics data)
 *   - Download        (GET  – PDF blob)
 *   - Trigger         (POST – send weekly email report)
 *
 * All endpoints live under /api/dashboard/analytics/
 */

import { authService } from '@/lib/auth/authService';
import { fetchWithAuth } from '@/lib/auth/fetchWithAuth';
import { API_CONFIG } from '@/lib/config/apiConfig';

const ANALYTICS_BASE = `${API_CONFIG.BASE_URL}/api/dashboard/analytics`;

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

const getAuthHeaders = async (): Promise<HeadersInit> => {
  const token = authService.getAccessToken();
  if (!token) throw new Error('Authentication required. Please log in.');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const getAuthHeadersForBlob = async (): Promise<HeadersInit> => {
  const token = authService.getAccessToken();
  if (!token) throw new Error('Authentication required. Please log in.');
  return {
    Authorization: `Bearer ${token}`,
  };
};

// ---------------------------------------------------------------------------
// Error handling (same pattern as dashboardService)
// ---------------------------------------------------------------------------

const handleApiError = async (
  response: Response,
  endpoint: string,
): Promise<never> => {
  let errorMessage = `API error: ${response.statusText}`;
  let errorDetails: any = null;

  try {
    const errorData = await response.json();
    errorDetails = errorData;
    // The backend may return { error: "..." }, { detail: "..." }, or field-level errors
    if (typeof errorData === 'object') {
      errorMessage =
        errorData.error ||
        errorData.detail ||
        errorData.message ||
        JSON.stringify(errorData);
    }
  } catch {
    // Response is not JSON – use status text
    try {
      const text = await response.text();
      if (text) {
        errorMessage = text;
      }
    } catch {
      // Ignore
    }
  }

  if (response.status === 401) {
    errorMessage = 'Authentication required. Please log in.';
  } else if (response.status === 403) {
    errorMessage = 'You do not have permission to perform this action.';
  } else if (response.status === 400) {
    // For 400 errors, include more details
    if (errorDetails) {
      const fieldErrors = Object.entries(errorDetails)
        .filter(([key]) => key !== 'error' && key !== 'detail' && key !== 'message')
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
        .join('; ');
      if (fieldErrors) {
        errorMessage = `Invalid request: ${fieldErrors}`;
      } else {
        errorMessage = `Invalid request: ${errorMessage}`;
      }
    } else {
      errorMessage = `Invalid request: ${errorMessage}`;
    }
  } else if (response.status === 500) {
    // For 500 errors, include the actual error message if available
    if (errorDetails?.error || errorDetails?.detail) {
      errorMessage = errorDetails.error || errorDetails.detail;
    } else {
      errorMessage = 'Server error. Please try again later.';
    }
  }

  throw new Error(`${endpoint} – ${errorMessage}`);
};

// ---------------------------------------------------------------------------
// Query-string builder
// ---------------------------------------------------------------------------

const buildQueryString = (params: Record<string, unknown>): string => {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (Array.isArray(value) && value.length > 0) {
      query.append(key, value.join(','));
    } else if (!Array.isArray(value)) {
      query.append(key, String(value));
    }
  });

  return query.toString();
};

// ---------------------------------------------------------------------------
// Types – Threshold CRUD
// ---------------------------------------------------------------------------

export type ThresholdScope = 'global' | 'manager' | 'campaign' | 'employee';

export interface Threshold {
  id: string;
  scope: ThresholdScope;
  // Backend (analytics microservice) keys targets by *_id; scope_display/target_name
  // are not returned by this service, so they're optional.
  scope_display?: string;
  target_name?: string;
  manager_id: string | null;
  campaign_id: string | null;
  employee_id: string | null;
  min_doors_per_day: number;
  min_doors_per_week: number;
  min_yes_rate_percent: number;
  max_no_rate_percent: number;
  min_contact_rate_percent: number;
  consecutive_days_threshold: number;
  performance_drop_alert_percent: number;
  max_inactive_hours: number;
  // Personal-baseline deviation model (Feature 2).
  baseline_window_days: number;
  min_history_days: number;
  normal_variation_band_pct: number;
  deviation_threshold_pct: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateThresholdData {
  scope: ThresholdScope;
  manager_id?: string;
  campaign_id?: string;
  employee_id?: string;
  min_doors_per_day?: number;
  min_doors_per_week?: number;
  min_yes_rate_percent?: number;
  max_no_rate_percent?: number;
  min_contact_rate_percent?: number;
  consecutive_days_threshold?: number;
  performance_drop_alert_percent?: number;
  max_inactive_hours?: number;
  baseline_window_days?: number;
  min_history_days?: number;
  normal_variation_band_pct?: number;
  deviation_threshold_pct?: number;
  is_active?: boolean;
}

export type UpdateThresholdData = Partial<CreateThresholdData>;

// ---------------------------------------------------------------------------
// Types – Preview / Analytics data
// ---------------------------------------------------------------------------

export interface AnalyticsPreviewParams {
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  campaign_ids?: string[];
  employee_ids?: string[];
  manager_id?: string;
}

export interface AnalyticsSummary {
  total_doors: number;
  doors_per_day: number;
  status_counts: {
    ja: number;
    nei: number;
    ikke_hjemme: number;
    folg_opp: number;
  };
  ja: number;
  nei: number;
  ikke_hjemme: number;
  folg_opp: number;
  yes_rate: number;
  no_rate: number;
  not_home_rate: number;
  follow_up_rate: number;
  contact_rate: number;
  unique_employees: number;
  avg_doors_per_employee: number;
  period_days: number;
}

export interface ComparisonMetric {
  current: number;
  previous: number;
  change: number;
  change_pct: number;
}

export interface Comparisons {
  total_doors: ComparisonMetric;
  yes_rate: ComparisonMetric;
  no_rate: ComparisonMetric;
  contact_rate: ComparisonMetric;
  doors_per_day: ComparisonMetric;
}

export interface NeiBreakdown {
  ikke_interessert: number;
  darlig_erfaring: number;
  bindingstid: number;
  bedrift: number;
  pris: number;
  eksisterende_kunde: number;
  unspecified: number;
}

export interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  total_doors: number;
  ja: number;
  nei: number;
  ikke_hjemme: number;
  folg_opp: number;
  yes_rate: number;
  no_rate: number;
  not_home_rate: number;
  follow_up_rate: number;
  contact_rate: number;
  num_employees: number;
  is_talkmore: boolean;
  nei_breakdown?: NeiBreakdown;
}

export interface EmployeeAnalytics {
  employee_id: string;
  employee_name: string;
  total_doors: number;
  doors_per_day: number;
  ja: number;
  nei: number;
  ikke_hjemme: number;
  folg_opp: number;
  yes_rate: number;
  no_rate: number;
  not_home_rate: number;
  follow_up_rate: number;
  contact_rate: number;
  daily_door_counts: Record<string, number>;
  consistency_score: number;
}

export interface DailyBreakdown {
  date: string;
  total_doors: number;
  ja: number;
  nei: number;
  ikke_hjemme: number;
  folg_opp: number;
  yes_rate: number;
}

export interface HourlyBreakdown {
  hour: number;
  total_doors: number;
  ja: number;
  yes_rate: number;
}

export interface TopPerformerEntry {
  employee_id: string;
  employee_name: string;
  value: number;
}

export interface TopPerformers {
  top_yes_rate: TopPerformerEntry;
  top_doors: TopPerformerEntry;
  bottom_yes_rate: TopPerformerEntry;
  bottom_doors: TopPerformerEntry;
}

export interface AlertDailyDetail {
  date: string;
  doors: number;
  ja: number;
  yes_rate: number;
  below_doors_threshold: boolean;
  below_yes_rate_threshold: boolean;
}

export interface Alert {
  severity: 'critical' | 'warning' | 'info';
  type: string;
  employee_id: string;
  employee_name: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  consecutive_days?: number;
  daily_details?: AlertDailyDetail[];
}

export interface AnalyticsPreviewResponse {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  summary: AnalyticsSummary;
  previous_period_summary?: AnalyticsSummary;
  comparisons?: Comparisons;
  campaigns: CampaignAnalytics[];
  employees: EmployeeAnalytics[];
  daily_breakdown: DailyBreakdown[];
  hourly_breakdown: HourlyBreakdown[];
  top_performers: TopPerformers;
  alerts: Alert[];
  work_time_summary?: WorkTimeSummary;
}

// ---------------------------------------------------------------------------
// Types – Report triggers
// ---------------------------------------------------------------------------

export interface TriggerReportResponse {
  status: string;
  message: string;
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_doors: number;
    alerts_count: number;
  };
}

// ---------------------------------------------------------------------------
// Types – Work-time stats
// ---------------------------------------------------------------------------

export interface WorkTimeSummaryGroup {
  total: number;
  active_count: number;
  active_pct: number;
  avg_daily_seconds: number;
  avg_daily_minutes: number;
}

export interface WorkTimeSummary {
  period_days: number;
  active_threshold_seconds: number;
  employees: WorkTimeSummaryGroup;
  managers: WorkTimeSummaryGroup;
  combined: WorkTimeSummaryGroup;
}

export interface WorkTimePersonEntry {
  id: string;
  name: string;
  total_seconds: number;
  total_minutes: number;
  avg_daily_seconds: number;
  avg_daily_minutes: number;
  is_active: boolean;
}

export interface WorkTimeStatsResponse {
  period: { start_date: string; end_date: string; days: number };
  active_threshold_seconds: number;
  aggregate: {
    employees: WorkTimeSummaryGroup;
    managers: WorkTimeSummaryGroup;
    combined: WorkTimeSummaryGroup;
  };
  employees: WorkTimePersonEntry[];
  managers: WorkTimePersonEntry[];
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const analyticsService = {
  // ----- Thresholds --------------------------------------------------------

  async getThresholds(): Promise<Threshold[]> {
    const response = await fetchWithAuth(`${ANALYTICS_BASE}/thresholds/`);
    if (!response.ok) await handleApiError(response, 'Thresholds list');
    return response.json();
  },

  async createThreshold(data: CreateThresholdData): Promise<Threshold> {
    const response = await fetchWithAuth(`${ANALYTICS_BASE}/thresholds/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) await handleApiError(response, 'Create threshold');
    return response.json();
  },

  async updateThreshold(id: string, data: UpdateThresholdData): Promise<Threshold> {
    const response = await fetchWithAuth(`${ANALYTICS_BASE}/thresholds/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) await handleApiError(response, 'Update threshold');
    return response.json();
  },

  async deleteThreshold(id: string): Promise<void> {
    const response = await fetchWithAuth(`${ANALYTICS_BASE}/thresholds/${id}/`, {
      method: 'DELETE',
    });
    if (!response.ok) await handleApiError(response, 'Delete threshold');
  },

  // ----- Preview -----------------------------------------------------------

  /**
   * Fetch analytics preview (JSON).
   * Supports date-range, campaign, employee, and manager filters.
   */
  async getAnalyticsPreview(
    params: AnalyticsPreviewParams,
  ): Promise<AnalyticsPreviewResponse> {
    const qs = buildQueryString({
      start_date: params.start_date,
      end_date: params.end_date,
      campaign_ids: params.campaign_ids,
      employee_ids: params.employee_ids,
      manager_id: params.manager_id,
    });

    const url = `${ANALYTICS_BASE}/preview/?${qs}`;
    console.log('[Analytics API] Fetching preview from:', url);

    const response = await fetchWithAuth(url);
    if (!response.ok) await handleApiError(response, 'Analytics preview');

    const data = await response.json();
    console.log('[Analytics API] Preview response received');

    // Transform alerts: map API field names to our interface
    if (data.alerts && Array.isArray(data.alerts)) {
      data.alerts = data.alerts.map((alert: any) => {
        // Derive metric from alert_type if not provided
        const deriveMetric = (alertType: string): string => {
          if (alertType.includes('doors')) return 'doors_per_day';
          if (alertType.includes('yes_rate') || alertType.includes('yes')) return 'yes_rate';
          if (alertType.includes('no_rate') || alertType.includes('no')) return 'no_rate';
          if (alertType.includes('contact')) return 'contact_rate';
          return alertType;
        };

        return {
          ...alert,
          type: alert.alert_type || alert.type || 'unknown',
          value: alert.current_value ?? alert.value ?? 0,
          threshold: alert.threshold_value ?? alert.threshold ?? 0,
          metric: alert.metric || deriveMetric(alert.alert_type || alert.type || ''),
        };
      });
    }

    return data;
  },

  // ----- Download PDF ------------------------------------------------------

  /**
   * Download a PDF report.
   * Fetches the blob, creates an object URL and triggers a browser download.
   */
  async downloadReport(params: AnalyticsPreviewParams): Promise<void> {
    const qs = buildQueryString({
      start_date: params.start_date,
      end_date: params.end_date,
      campaign_ids: params.campaign_ids,
      employee_ids: params.employee_ids,
      manager_id: params.manager_id,
    });

    const url = `${ANALYTICS_BASE}/download/?${qs}`;
    console.log('[Analytics API] Downloading report from:', url);

    const response = await fetchWithAuth(url);
    if (!response.ok) await handleApiError(response, 'Download report');

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = `AB_Maps_Analytics_${params.start_date}_${params.end_date}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(blobUrl);
    document.body.removeChild(anchor);
  },

  // ----- Trigger email report ----------------------------------------------

  /**
   * Manually trigger the weekly email report (Admin only).
   * The backend calculates the last 7 days automatically.
   * @param recipient_emails Array of email addresses to send the report to
   */
  async triggerReport(recipient_emails: string[]): Promise<TriggerReportResponse> {
    const requestBody = { recipient_emails };
    
    console.log('[analyticsService] Triggering report with emails:', recipient_emails);
    
    const response = await fetchWithAuth(`${ANALYTICS_BASE}/trigger/`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      // Clone response to read body without consuming it
      const responseClone = response.clone();
      try {
        const errorData = await responseClone.json();
        console.error('[analyticsService] Trigger report failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          requestBody,
        });
      } catch {
        const errorText = await responseClone.text();
        console.error('[analyticsService] Trigger report failed (non-JSON):', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
          requestBody,
        });
      }
      await handleApiError(response, 'Trigger report');
    }
    
    return response.json();
  },

  async getWorkTimeStats(params: { start_date: string; end_date: string; campaign_ids?: string[] }): Promise<WorkTimeStatsResponse> {
    const qs = buildQueryString({ start_date: params.start_date, end_date: params.end_date, campaign_ids: params.campaign_ids });
    const url = `${ANALYTICS_BASE}/work-time-stats/?${qs}`;
    const response = await fetchWithAuth(url);
    if (!response.ok) await handleApiError(response, 'Work-time stats');
    return response.json();
  },
};

export default analyticsService;
