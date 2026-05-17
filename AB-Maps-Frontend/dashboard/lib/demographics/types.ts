// lib/demographics/types.ts
// TypeScript interfaces for demographics map feature

/**
 * Tooltip data displayed on hover over grunnkrets
 */
export interface TooltipData {
  x: number;
  y: number;
  name: string;
  code: string;
  population_total: number | null;
  donor_pool_stable: number | null;
  pop_67_plus: number | null;
  share_30_66: number | null;
  mean_age_est_total: number | null;
}

/**
 * Selected grunnkrets data for drawer
 */
export interface SelectedGrunnkrets {
  code: string;
  name: string;
}

/**
 * Metric definition for choropleth styling
 */
export interface MetricDefinition {
  id: string;
  label: string;
  property: string;
  thresholds: number[];
  colors: string[];
  format: (value: number) => string;
}

/**
 * Grunnkrets stats response from detail API
 * Matches actual API response structure
 */
export interface GrunnkretsStatsResponse {
  code: string;
  name: string;
  level: string;
  parents: {
    kommune_code: string;
    fylke_code: string;
  };
  year: number;
  updated_at: string;
  totals: {
    population_total: number;
    female_total: number;
    male_total: number;
  };
  bins: {
    age_groups: string[];
    female: number[];
    male: number[];
    total: number[];
  };
  donor_segments: {
    pop_0_15: number;
    pop_16_29: number;
    pop_30_66: number;
    pop_67_plus: number;
    donor_pool_adults: number;
    donor_pool_stable: number;
    donor_pool_seniors: number;
    share_30_66: number;
    share_67_plus: number;
  };
  shares: {
    female_share: number;
    male_share: number;
  };
  mean_age_estimates: {
    total: number;
    female: number;
    male: number;
  };
}

/**
 * MVT Feature properties for grunnkrets tiles
 */
export interface GrunnkretsFeatureProperties {
  code: string;
  name: string;
  population_total?: number;
  donor_pool_stable?: number;
  pop_67_plus?: number;
  share_30_66?: number;
  share_67_plus?: number;
  mean_age_est_total?: number;
  female_share?: number;
  male_share?: number;
}

/**
 * MVT Feature properties for kommune tiles
 */
export interface KommuneFeatureProperties {
  code: string;
  name: string;
  fylke_code?: string;
}

/**
 * MVT Feature properties for fylke tiles
 */
export interface FylkeFeatureProperties {
  code: string;
  name: string;
}

