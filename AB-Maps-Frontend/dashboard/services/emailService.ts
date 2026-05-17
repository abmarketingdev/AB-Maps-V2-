import { adminAuthService } from "@/lib/auth/adminAuthService";

export interface SendWelcomeEmailRequest {
  receiver_email: string;
  password: string;
  user_type: "superuser" | "employee" | "manager";
  user_name: string;
}

export interface SendWelcomeEmailResponse {
  status: "success" | "error";
  message: string;
}

/**
 * Send welcome email to newly created user
 */
export const sendWelcomeEmail = async (payload: SendWelcomeEmailRequest): Promise<SendWelcomeEmailResponse> => {
  try {
    const token = adminAuthService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/send-welcome-email/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || `Failed to send welcome email: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error sending welcome email:', error);
    throw error;
  }
}; 