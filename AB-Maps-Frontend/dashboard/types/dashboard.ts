/**
 * Dashboard TypeScript Types
 * 
 * Type definitions for the new dashboard API endpoints.
 * All types match the API response structures from the backend.
 */

// ============================================================================
// Dashboard Stats API Types
// ============================================================================

export interface DashboardStatsFilters {
  campaign_ids: string[];
  start_date: string | null;
  end_date: string | null;
  all_campaigns: boolean;
  all_time: boolean;
}

export interface DashboardStatsSummary {
  total_responses: number;
  days_in_range: number;
  avg_per_day: number;
}

export interface DashboardStatusCounts {
  ja: number;
  nei: number;
  ikke_hjemme: number;
  folg_opp: number;
}

export interface DashboardStatusPercentages {
  ja: number;
  nei: number;
  ikke_hjemme: number;
  folg_opp: number;
}

export interface DashboardCalculatedMetrics {
  hit_rate: number;
  rejection_rate: number;
  no_answer_rate: number;
  follow_up_rate: number;
}

export interface DashboardStatsResponse {
  filters: DashboardStatsFilters;
  summary: DashboardStatsSummary;
  status_counts: DashboardStatusCounts;
  status_percentages: DashboardStatusPercentages;
  calculated_metrics: DashboardCalculatedMetrics;
}

// ============================================================================
// Dashboard Trends API Types
// ============================================================================

export interface DashboardTrendsFilters {
  campaign_ids: string[];
  start_date: string;
  end_date: string;
  group_by: string;
  all_campaigns: boolean;
  all_time: boolean;
}

export interface DashboardDateRange {
  start: string;
  end: string;
  periods: number;
}

export interface DashboardTrendDataPoint {
  date: string;
  count: number;
}

export interface DashboardTrendsData {
  ja: DashboardTrendDataPoint[];
  nei: DashboardTrendDataPoint[];
  ikke_hjemme: DashboardTrendDataPoint[];
  folg_opp: DashboardTrendDataPoint[];
}

export interface DashboardTrendsSummary {
  total_by_status: DashboardStatusCounts;
}

export interface DashboardTrendsResponse {
  filters: DashboardTrendsFilters;
  date_range: DashboardDateRange;
  trends: DashboardTrendsData;
  summary: DashboardTrendsSummary;
}

// ============================================================================
// Follow-ups API Types
// ============================================================================

export interface FollowUpPosition {
  type: string;
  coordinates: [number, number]; // [longitude, latitude]
}

export interface FollowUpCampaign {
  id: string;
  name: string;
}

export interface FollowUpAddress {
  id: string;
  address_text: string;
  status: string;
  status_display: string;
  position: FollowUpPosition;
  recorded_at: string;
  campaign: FollowUpCampaign;
  notes?: string;
}

export interface FollowUpsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: FollowUpAddress[];
}

// ============================================================================
// Recent Activities API Types
// ============================================================================

export interface RecentActivityCampaign {
  id: string;
  name: string;
}

export interface RecentActivityPosition {
  lat: number;
  lng: number;
}

export interface RecentActivityMetadata {
  status: string;
  address_text: string;
  position: RecentActivityPosition;
}

export interface RecentActivity {
  id: string;
  status: string;
  address_text: string;
  recorded_at: string;
  created_at: string;
  campaign: RecentActivityCampaign;
  metadata: RecentActivityMetadata;
}

export interface RecentActivitiesResponse {
  count: number;
  results: RecentActivity[];
}

// ============================================================================
// Dashboard Filter Types
// ============================================================================

export interface DashboardFilters {
  /**
   * Comma-separated campaign UUIDs or null for "All Campaigns"
   * Format: "uuid1,uuid2" or null
   */
  campaign_ids?: string | null;
  
  /**
   * Start date in YYYY-MM-DD format or null for "All Time"
   */
  start_date?: string | null;
  
  /**
   * End date in YYYY-MM-DD format or null for "All Time"
   */
  end_date?: string | null;
  
  /**
   * Maximum results per page (for paginated endpoints)
   */
  limit?: number;
  
  /**
   * Pagination offset (for paginated endpoints)
   */
  offset?: number;
  
  /**
   * Filter by status: "ja", "nei", "ikke_hjemme", "folg_opp"
   * Only used for recent-activities endpoint
   */
  status?: string;
  
  /**
   * Group by period: "day", "week", "month"
   * Only used for trends endpoint
   */
  group_by?: string;
  
  /**
   * Include percentage calculations (default: true)
   * Only used for stats endpoint
   */
  include_percentages?: boolean;
}

// ============================================================================
// Combined Dashboard Data Type
// ============================================================================

export interface DashboardData {
  stats: DashboardStatsResponse | null;
  trends: DashboardTrendsResponse | null;
  followUps: FollowUpsResponse | null;
  activities: RecentActivitiesResponse | null;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isDashboardStatsResponse(data: any): data is DashboardStatsResponse {
  return (
    data &&
    typeof data === 'object' &&
    'filters' in data &&
    'summary' in data &&
    'status_counts' in data &&
    'status_percentages' in data &&
    'calculated_metrics' in data
  );
}

export function isDashboardTrendsResponse(data: any): data is DashboardTrendsResponse {
  return (
    data &&
    typeof data === 'object' &&
    'filters' in data &&
    'date_range' in data &&
    'trends' in data &&
    'summary' in data
  );
}

export function isFollowUpsResponse(data: any): data is FollowUpsResponse {
  return (
    data &&
    typeof data === 'object' &&
    'count' in data &&
    'results' in data &&
    Array.isArray(data.results)
  );
}

export function isRecentActivitiesResponse(data: any): data is RecentActivitiesResponse {
  return (
    data &&
    typeof data === 'object' &&
    'count' in data &&
    'results' in data &&
    Array.isArray(data.results)
  );
}

