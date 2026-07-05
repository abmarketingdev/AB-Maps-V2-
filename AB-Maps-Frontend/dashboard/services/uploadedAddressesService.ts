import { authService } from "@/lib/auth/authService";

export interface UploadedAddress {
  id: string;
  address_text: string;
  added_at: string;
  latitude: number;
  longitude: number;
  is_geocoded: boolean;
  geocoded_at: string;
  coordinates: [number, number];
  manager: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    status: string;
    is_online: boolean;
    last_seen: string | null;
    created_at: string;
    updated_at: string;
  };
  campaign: {
    id: string;
    name: string;
    description: string;
    areas: Array<{ id: string }>;
    employees: Array<{ id: string; name: string }>;
    team_count: number;
    area_count: number;
    employee_count: number;
    created_at: string;
    updated_at: string;
  };
}

export interface UploadedAddressesResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UploadedAddress[];
}

// New interfaces for batch upload system
export interface BatchIdResponse {
  batch_id: string;
}

export interface UploadFileResponse {
  batch_id: string;
  total_addresses: number;
  status: string;
}

export interface UploadProgressResponse {
  batch_id: string;
  progress_percentage: number;
  total_addresses: number;
  processed_addresses: number;
  geocoded_addresses: number;
  failed_addresses: number;
  status: string;
}

// New interfaces for batch history and recovery
export interface BatchHistoryItem {
  batch_id: string;
  campaign_name: string;
  status: string;
  total_addresses: number;
  processed_addresses: number;
  geocoded_addresses: number;
  failed_addresses: number;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  file_name?: string;
}

export interface BatchHistoryResponse {
  upload_history: BatchHistoryItem[];
}

export const fetchUploadedAddresses = async (
  campaignId: string,
  managerId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<UploadedAddressesResponse> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/?campaign=${campaignId}&campaign_id=${campaignId}&manager=${managerId}&manager_id=${managerId}&page=${page}&page_size=${pageSize}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: UploadedAddressesResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching uploaded addresses:', error);
    throw error;
  }
};

// Get user's upload history (for recovery)
export const fetchUploadHistory = async (): Promise<BatchHistoryResponse> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/my-uploads/`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: BatchHistoryResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching upload history:', error);
    throw error;
  }
};

// Generate batch ID for new upload
export const generateBatchId = async (): Promise<BatchIdResponse> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/generate-batch-id/`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: BatchIdResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error generating batch ID:', error);
    throw error;
  }
};

// Upload CSV file with batch ID
export const uploadFile = async (
  file: File,
  campaignId: string,
  batchId: string
): Promise<UploadFileResponse> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaign_id', campaignId);
    formData.append('batch_id', batchId);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/upload-file/`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: UploadFileResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Track upload progress
export const getUploadProgress = async (batchId: string): Promise<UploadProgressResponse> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/upload-progress/?batch_id=${batchId}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: UploadProgressResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting upload progress:', error);
    throw error;
  }
};

export interface UpdateAddressTextResponse {
  message: string;
  address_id: string;
  old_address_text: string;
  new_address_text: string;
  geocoding_status: 'success' | 'failed';
  latitude?: number;
  longitude?: number;
  geocoded_at?: string;
  error?: string;
}

export interface CancelBatchResponse {
  message: string;
  batch_id: string;
  status: string;
}

export const updateAddressText = async (
  addressId: string,
  addressText: string
): Promise<UpdateAddressTextResponse> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/${addressId}/update-address-text/`,
      {
        method: 'PATCH',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          address_text: addressText,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: UpdateAddressTextResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating address text:', error);
    throw error;
  }
};

// Create a single uploaded address (manager inferred from token)
export const createUploadedAddress = async (
  addressText: string,
  campaignId: string
): Promise<UploadedAddress> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          address_text: addressText,
          campaign_id: campaignId,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as UploadedAddress;
  } catch (error) {
    console.error('Error creating uploaded address:', error);
    throw error;
  }
};

// Cancel an ongoing batch upload
export const cancelBatch = async (batchId: string): Promise<CancelBatchResponse> => {
  try {
    const token = authService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/uploaded-addresses/uploaded-addresses/cancel-batch/?batch_id=${batchId}`,
      {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data: CancelBatchResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error canceling batch:', error);
    throw error;
  }
}; 