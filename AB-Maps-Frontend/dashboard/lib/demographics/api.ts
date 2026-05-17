// lib/demographics/api.ts
// API fetchers with client-side caching for demographics data

import type { GrunnkretsStatsResponse } from './types';

// API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Cache TTL: 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Cache entry with timestamp
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Module-level cache for grunnkrets stats
 * Persists across component rerenders
 */
const statsCache = new Map<string, CacheEntry<GrunnkretsStatsResponse>>();

/**
 * Fetch grunnkrets statistics with caching
 * 
 * @param code - Grunnkrets code
 * @param year - Year for statistics (default: 2025)
 * @returns Promise<GrunnkretsStatsResponse>
 * 
 * Caching strategy:
 * - First call: fetches from API, stores in cache
 * - Subsequent calls: returns cached data if within TTL
 * - After TTL: refetches and updates cache
 */
export async function fetchGrunnkretsStats(
  code: string,
  year: number = 2025
): Promise<GrunnkretsStatsResponse> {
  const cacheKey = `${code}-${year}`;

  // Check cache first
  const cached = statsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[api] Cache hit for grunnkrets ${code}`);
    return cached.data;
  }

  console.log(`[api] Fetching stats for grunnkrets ${code}`);

  // Fetch from API
  const url = `${API_BASE_URL}/api/locked-areas/grunnkrets/${code}/stats?year=${year}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch grunnkrets stats: ${response.status} ${response.statusText}`);
  }

  const data: GrunnkretsStatsResponse = await response.json();

  // Store in cache
  statsCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });

  console.log(`[api] Cached stats for grunnkrets ${code}`);

  return data;
}

/**
 * Clear cache for a specific grunnkrets
 */
export function clearGrunnkretsCache(code: string, year: number = 2025): void {
  const cacheKey = `${code}-${year}`;
  statsCache.delete(cacheKey);
}

/**
 * Clear all cached data
 */
export function clearAllCache(): void {
  statsCache.clear();
}

/**
 * Get cache size (for debugging)
 */
export function getCacheSize(): number {
  return statsCache.size;
}

/**
 * Check if data is cached for a grunnkrets
 */
export function isCached(code: string, year: number = 2025): boolean {
  const cacheKey = `${code}-${year}`;
  const cached = statsCache.get(cacheKey);
  return cached !== undefined && Date.now() - cached.timestamp < CACHE_TTL;
}

