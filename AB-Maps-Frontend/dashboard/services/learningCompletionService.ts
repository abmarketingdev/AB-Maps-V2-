import { buildApiUrl } from '@/lib/config/apiConfig';
import { makeAuthenticatedRequest } from '@/services/campaignAreaService';

/**
 * Incomplete section information from API response
 */
export interface IncompleteSection {
  section_id: string;
  section_title: string;
  section_order: number;
  progress_percent: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  completed_at: string | null;
}

/**
 * Campaign completion check API response
 */
export interface CampaignCompletionResponse {
  all_completed: boolean;
  campaign_id: string | null;
  campaign_name: string;
  total_sections: number;
  completed_sections: number;
  incomplete_sections: IncompleteSection[];
  is_assigned_to_campaign: boolean;
}

/**
 * Parameters for checking campaign completion
 */
export interface CheckCompletionParams {
  campaignId: string;
  userId: string;
  userType: 'employee' | 'manager';
}

/**
 * Cache for completion status
 */
interface CompletionCache {
  [key: string]: {
    data: CampaignCompletionResponse;
    timestamp: number;
  };
}

const completionCache: CompletionCache = {};
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes cache

/**
 * Generate cache key from parameters
 */
function getCacheKey(campaignId: string, userId: string, userType: 'employee' | 'manager'): string {
  return `completion_${userType}_${userId}_${campaignId}`;
}

/**
 * Check if a user has completed all sections for a specific campaign
 * 
 * @param params - Parameters containing campaignId, userId, and userType
 * @returns Promise resolving to completion response
 * @throws Error if API call fails or parameters are invalid
 */
export async function checkCampaignCompletion(
  params: CheckCompletionParams
): Promise<CampaignCompletionResponse> {
  const { campaignId, userId, userType } = params;

  // Validate parameters with user-friendly messages
  if (!campaignId || campaignId.trim() === '') {
    throw new Error('Kampanje-ID mangler. Vennligst velg en kampanje først.');
  }
  if (!userId || userId.trim() === '') {
    throw new Error(`Bruker-ID mangler. Vennligst logg inn på nytt.`);
  }

  // Check cache first
  const cacheKey = getCacheKey(campaignId, userId, userType);
  const cached = completionCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('[Completion Check] Using cached result');
    return cached.data;
  }

  try {
    // Build query parameters
    const queryParams = new URLSearchParams({
      campaign_id: campaignId,
      [`${userType}_id`]: userId,
    });

    // Build API URL
    const url = buildApiUrl(`/api/learning/campaign-completion-check/?${queryParams.toString()}`);

    console.log('[Completion Check] Calling API:', url);

    // Make authenticated request
    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.detail || `HTTP error! status: ${response.status}`);
    }

    const data: CampaignCompletionResponse = await response.json();

    // Cache the result
    completionCache[cacheKey] = {
      data,
      timestamp: Date.now(),
    };

    console.log('[Completion Check] Result:', {
      all_completed: data.all_completed,
      completed_sections: data.completed_sections,
      total_sections: data.total_sections,
      incomplete_count: data.incomplete_sections.length,
    });

    return data;
  } catch (error) {
    console.error('[Completion Check] Error:', error);
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Nettverksfeil: Kunne ikke koble til serveren. Sjekk internettforbindelsen din.');
    }
    
    // Handle HTTP errors with user-friendly messages
    if (error instanceof Error) {
      // Check for specific error messages
      if (error.message.includes('404')) {
        throw new Error('Kampanje eller bruker ikke funnet. Vennligst sjekk at kampanjen eksisterer og at du er tilknyttet den.');
      }
      if (error.message.includes('401') || error.message.includes('403')) {
        throw new Error('Autentiseringsfeil: Du har ikke tilgang til denne kampanjen. Vennligst logg inn på nytt.');
      }
      if (error.message.includes('500')) {
        throw new Error('Serverfeil: Noe gikk galt på serveren. Vennligst prøv igjen senere.');
      }
      if (error.message.includes('network') || error.message.includes('Network')) {
        throw new Error('Nettverksfeil: Kunne ikke koble til serveren. Sjekk internettforbindelsen din.');
      }
      
      // Return the error message if it's already user-friendly
      throw error;
    }
    
    throw new Error('Kunne ikke sjekke kursfullføring. Vennligst prøv igjen.');
  }
}

/**
 * Clear completion cache for a specific user and campaign
 * 
 * @param campaignId - Campaign ID
 * @param userId - User ID
 * @param userType - User type ('employee' or 'manager')
 */
export function clearCompletionCache(
  campaignId?: string,
  userId?: string,
  userType?: 'employee' | 'manager'
): void {
  if (campaignId && userId && userType) {
    // Clear specific cache entry
    const cacheKey = getCacheKey(campaignId, userId, userType);
    delete completionCache[cacheKey];
    console.log('[Completion Check] Cleared cache for:', cacheKey);
  } else {
    // Clear all cache
    Object.keys(completionCache).forEach(key => delete completionCache[key]);
    console.log('[Completion Check] Cleared all cache');
  }
}

/**
 * Get campaign ID from localStorage
 * 
 * @returns Campaign ID or null if not found
 */
export function getCampaignIdFromStorage(): string | null {
  try {
    const storedCampaign = localStorage.getItem('currentCampaign');
    if (!storedCampaign) {
      return null;
    }

    const campaign = JSON.parse(storedCampaign);
    return campaign?.id || null;
  } catch (error) {
    console.error('[Completion Check] Error parsing campaign from localStorage:', error);
    return null;
  }
}

/**
 * Check completion using campaign from localStorage
 * 
 * @param userId - User ID (employee_id or manager_id)
 * @param userType - User type ('employee' or 'manager')
 * @returns Promise resolving to completion response or null if no campaign selected
 */
export async function checkCompletionFromStorage(
  userId: string,
  userType: 'employee' | 'manager'
): Promise<CampaignCompletionResponse | null> {
  const campaignId = getCampaignIdFromStorage();
  
  if (!campaignId) {
    console.warn('[Completion Check] No campaign selected in localStorage');
    return null;
  }

  return checkCampaignCompletion({
    campaignId,
    userId,
    userType,
  });
}

