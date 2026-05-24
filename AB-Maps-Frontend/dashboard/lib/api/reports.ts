// Rapport — live adapters (Module 5, §5.4). NOTE: param is `campaign_ids` (CSV).

import { getJSON } from '@/lib/auth/fetchWithAuth';

export interface UserSummary {
  user_id: string;
  name: string;
  role: 'employee' | 'manager';
  total_responses: number;
  total_cities: number;
  ja_percentage: number;
  nei_percentage: number;
  ikke_hjemme_percentage: number;
}
export interface SummaryData {
  total_users: number;
  total_responses: number;
  total_cities: number;
  date_range: { start_date: string | null; end_date: string | null };
  campaigns: { campaign_id: string; campaign_name: string }[];
}
export interface TableDataResponse { users: UserSummary[]; summary: SummaryData }

export interface AddressDetail {
  address_id: string | null;
  address_text: string;
  base_address: string;
  apartment_number: string | null;
  status: string;
  position: { lat: number; lng: number } | null;
  tags: Record<string, string>;
  recorded_at: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
}
export interface CityDetail {
  city_name: string;
  total: number;
  ja_count: number; nei_count: number; ikke_hjemme_count: number;
  ja_percentage: number; nei_percentage: number; ikke_hjemme_percentage: number;
  addresses: AddressDetail[];
}
export interface UserAddressResponse {
  user_id: string;
  user_name: string;
  user_role: string;
  total_responses: number;
  cities: CityDetail[];
}

const qp = (params: Record<string, string | undefined>): string => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, v); });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

export function fetchReportTable(p: { campaignIds: string[]; startDate?: string; endDate?: string }): Promise<TableDataResponse> {
  return getJSON<TableDataResponse>(`/api/reports/table/${qp({
    campaign_ids: p.campaignIds.join(','), start_date: p.startDate, end_date: p.endDate,
  })}`);
}

export function fetchUserAddresses(p: { userId: string; campaignIds: string[]; startDate?: string; endDate?: string }): Promise<UserAddressResponse> {
  return getJSON<UserAddressResponse>(`/api/reports/user-addresses/${qp({
    user_id: p.userId, campaign_ids: p.campaignIds.join(','), start_date: p.startDate, end_date: p.endDate,
  })}`);
}
