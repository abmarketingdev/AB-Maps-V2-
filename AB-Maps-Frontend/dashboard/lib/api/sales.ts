// Sales activity — live adapters (Module 5, §5.3). Manager/admin, team-scoped.

import { getJSON } from '@/lib/auth/fetchWithAuth';

export type SalesStatus = 'ja' | 'nei' | 'ikke_hjemme' | 'folg_opp';

export interface Reg {
  id: string;
  ts: string;            // ISO
  employee_id: string;
  employee: string;
  campaign_id: string | null;
  status: SalesStatus;
  city: string | null;
  postal_code: string | null;
}

export interface SalesPage { results: Reg[]; total_count: number; page: number; page_size: number; total_pages: number }

export interface SalesSummary {
  by_status: { ja: number; nei: number; ikke_hjemme: number };
  by_hour: { hour: number; ja: number; nei: number; ikke_hjemme: number }[];
  by_day: { date: string; ja: number; nei: number; ikke_hjemme: number }[];
  by_employee_lane: { employee_id: string; employee: string; beads: { ts: string; status: SalesStatus }[] }[];
}

export interface SalesFilters {
  campaignId?: string;
  employeeId?: string;
  status?: string;       // CSV
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const qp = (f: SalesFilters): string => {
  const qs = new URLSearchParams();
  const map: Record<string, string | number | undefined> = {
    campaign_id: f.campaignId, employee_id: f.employeeId, status: f.status,
    start_date: f.startDate, end_date: f.endDate, search: f.search,
    page: f.page, page_size: f.pageSize,
  };
  Object.entries(map).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

export function fetchSales(filters: SalesFilters = {}): Promise<SalesPage> {
  return getJSON<SalesPage>(`/api/dashboard/v2/sales/${qp(filters)}`);
}

/**
 * Fetch *every* registration matching the filters by walking all pages.
 * The backend caps page_size at 100, so a wide date range can span hundreds of
 * pages — page 1 is fetched first to learn total_pages, then the rest are
 * fetched in bounded-concurrency batches and concatenated in page order.
 */
export async function fetchAllSales(
  filters: SalesFilters = {},
  opts: { concurrency?: number; maxPages?: number } = {},
): Promise<SalesPage> {
  const concurrency = opts.concurrency ?? 12;
  const maxPages = opts.maxPages ?? 2000; // hard safety ceiling
  const pageSize = filters.pageSize ?? 100;

  const first = await fetchSales({ ...filters, page: 1, pageSize });
  const totalPages = Math.min(first.total_pages || 1, maxPages);
  if (totalPages <= 1) return { ...first, results: [...first.results] };

  // Pages 2..totalPages, fetched in concurrency-limited batches, kept in order.
  const pageNumbers: number[] = [];
  for (let p = 2; p <= totalPages; p++) pageNumbers.push(p);

  const byPage: Reg[][] = new Array(totalPages + 1);
  byPage[1] = first.results;

  for (let i = 0; i < pageNumbers.length; i += concurrency) {
    const batch = pageNumbers.slice(i, i + concurrency);
    const pages = await Promise.all(
      batch.map((p) =>
        fetchSales({ ...filters, page: p, pageSize })
          .then((res) => ({ p, results: res.results }))
          .catch(() => ({ p, results: [] as Reg[] })),
      ),
    );
    pages.forEach(({ p, results }) => { byPage[p] = results; });
  }

  const results: Reg[] = [];
  for (let p = 1; p <= totalPages; p++) if (byPage[p]) results.push(...byPage[p]);

  return {
    results,
    total_count: first.total_count,
    page: 1,
    page_size: results.length,
    total_pages: totalPages,
  };
}

export function fetchSalesSummary(filters: SalesFilters = {}): Promise<SalesSummary> {
  return getJSON<SalesSummary>(`/api/dashboard/v2/sales/summary/${qp(filters)}`);
}
