/**
 * useAnalytics – Custom hook for the Analytics Dashboard
 *
 * Provides reactive state, loading/error handling, and actions for:
 *   - Analytics preview data  (summary, campaigns, employees, charts, alerts)
 *   - Threshold CRUD
 *   - Report download / email trigger
 */

import { useState, useCallback } from 'react';
import {
  analyticsService,
  type AnalyticsPreviewParams,
  type AnalyticsPreviewResponse,
  type Threshold,
  type CreateThresholdData,
  type UpdateThresholdData,
  type TriggerReportResponse,
  type WorkTimeStatsResponse,
} from '@/services/analyticsService';

// ---------------------------------------------------------------------------
// Hook: useAnalyticsPreview
// ---------------------------------------------------------------------------

export function useAnalyticsPreview() {
  const [data, setData] = useState<AnalyticsPreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreview = useCallback(async (params: AnalyticsPreviewParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await analyticsService.getAnalyticsPreview(params);
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(message);
      console.error('[useAnalyticsPreview]', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, fetchPreview, reset };
}

// ---------------------------------------------------------------------------
// Hook: useAnalyticsThresholds
// ---------------------------------------------------------------------------

export function useAnalyticsThresholds() {
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchThresholds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsService.getThresholds();
      // Handle both plain array and paginated { results: [...] } responses
      const list = Array.isArray(data) ? data : (data as unknown as { results: Threshold[] }).results ?? [];
      setThresholds(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch thresholds';
      setError(message);
      console.error('[useAnalyticsThresholds]', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createThreshold = useCallback(
    async (data: CreateThresholdData): Promise<Threshold | null> => {
      setError(null);
      try {
        const created = await analyticsService.createThreshold(data);
        setThresholds((prev) => [...prev, created]);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create threshold';
        setError(message);
        console.error('[useAnalyticsThresholds]', message);
        return null;
      }
    },
    [],
  );

  const updateThreshold = useCallback(
    async (id: string, data: UpdateThresholdData): Promise<Threshold | null> => {
      setError(null);
      try {
        const updated = await analyticsService.updateThreshold(id, data);
        setThresholds((prev) =>
          prev.map((t) => (t.id === id ? updated : t)),
        );
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update threshold';
        setError(message);
        console.error('[useAnalyticsThresholds]', message);
        return null;
      }
    },
    [],
  );

  const deleteThreshold = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);
      try {
        await analyticsService.deleteThreshold(id);
        setThresholds((prev) => prev.filter((t) => t.id !== id));
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete threshold';
        setError(message);
        console.error('[useAnalyticsThresholds]', message);
        return false;
      }
    },
    [],
  );

  return {
    thresholds,
    loading,
    error,
    fetchThresholds,
    createThreshold,
    updateThreshold,
    deleteThreshold,
  };
}

// ---------------------------------------------------------------------------
// Hook: useAnalyticsReports
// ---------------------------------------------------------------------------

export function useAnalyticsReports() {
  const [downloading, setDownloading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<TriggerReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const downloadReport = useCallback(async (params: AnalyticsPreviewParams) => {
    setDownloading(true);
    setError(null);
    try {
      await analyticsService.downloadReport(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download report';
      setError(message);
      console.error('[useAnalyticsReports]', message);
    } finally {
      setDownloading(false);
    }
  }, []);

  const triggerReport = useCallback(async (recipient_emails: string[]) => {
    setTriggering(true);
    setError(null);
    setTriggerResult(null);
    try {
      const result = await analyticsService.triggerReport(recipient_emails);
      setTriggerResult(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger report';
      setError(message);
      console.error('[useAnalyticsReports]', message);
      return null;
    } finally {
      setTriggering(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    downloading,
    triggering,
    triggerResult,
    error,
    downloadReport,
    triggerReport,
    clearError,
  };
}

// ---------------------------------------------------------------------------
// Hook: useWorkTimeStats
// ---------------------------------------------------------------------------

export function useWorkTimeStats() {
  const [data, setData] = useState<WorkTimeStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkTimeStats = useCallback(async (params: { start_date: string; end_date: string; campaign_ids?: string[] }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await analyticsService.getWorkTimeStats(params);
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kunne ikke hente arbeidstidsdata';
      setError(message);
      console.error('[useWorkTimeStats]', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, fetchWorkTimeStats, reset };
}
