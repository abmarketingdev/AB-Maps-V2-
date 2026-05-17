import { adminAuthService } from "@/lib/auth/adminAuthService";

export async function fetchManagers() {
  const token = adminAuthService.getAccessToken();
  const res = await fetch("https://ab-maps-backend-production.onrender.com/api/users/admin/managers/", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) throw new Error("Failed to fetch managers");
  return await res.json();
}

export async function fetchEmployees() {
  const token = adminAuthService.getAccessToken();
  const res = await fetch("https://ab-maps-backend-production.onrender.com/api/users/admin/employees/", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) throw new Error("Failed to fetch employees");
  return await res.json();
}

export async function updateManager(id: string, payload: { name: string; email: string; phone: string }) {
  const token = adminAuthService.getAccessToken();
  const res = await fetch(`https://ab-maps-backend-production.onrender.com/api/users/managers/${id}/`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) throw new Error("Failed to update manager");
  return await res.json();
}

export async function updateEmployee(id: string, payload: { name: string; email: string; phone: string }) {
  const token = adminAuthService.getAccessToken();
  const res = await fetch(`https://ab-maps-backend-production.onrender.com/api/users/employees/${id}/`, {
    method: "PATCH",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) throw new Error("Failed to update employee");
  return await res.json();
}

export async function deleteManager(id: string) {
  const token = adminAuthService.getAccessToken();
  const res = await fetch(`https://ab-maps-backend-production.onrender.com/api/users/managers/${id}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) throw new Error("Failed to delete manager");
  return res.status === 204; // DELETE typically returns 204 No Content
}

export async function deleteEmployee(id: string) {
  const token = adminAuthService.getAccessToken();
  const res = await fetch(`https://ab-maps-backend-production.onrender.com/api/users/employees/${id}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) throw new Error("Failed to delete employee");
  return res.status === 204; // DELETE typically returns 204 No Content
}

export async function registerUser(payload: any) {
  try {
    const res = await fetch("https://ab-maps-backend-production.onrender.com/api/users/auth/register/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data;
    let isJson = true;
    try {
      data = await res.json();
    } catch {
      isJson = false;
      const text = await res.text();
      if (text.includes("unique constraint") || text.includes("duplicate key")) {
        return { ok: false, data: { username: "Username already exists. Please choose another." } };
      }
      return { ok: false, data: { error: text || "Unknown error" } };
    }
    // Also check for unique constraint in data.error/message
    if (!res.ok && isJson && (data?.error || data?.message)) {
      const msg = data.error || data.message;
      if (msg && (msg.includes("unique constraint") || msg.includes("duplicate key"))) {
        return { ok: false, data: { username: "Username already exists. Please choose another." } };
      }
    }
    // If 500 and no JSON, treat as duplicate username if username in payload
    if (!res.ok && !isJson && res.status === 500 && payload.username) {
      return { ok: false, data: { username: "Username already exists. Please choose another." } };
    }
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, data: { error: "Network error. Please try again." } };
  }
} 