"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAuthService } from "@/lib/auth/adminAuthService";

const ADMIN_DASHBOARD_MAIN = "/admin-dashboard/admin-main-dashboard";

const AdminDashboardLogin: React.FC = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await adminAuthService.login({ username, password });
      router.push(ADMIN_DASHBOARD_MAIN);
    } catch (err: any) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Admin Sign In</h1>
          <p className="mt-2 text-sm text-gray-600">
            Access your AB Maps admin dashboard
          </p>
        </div>
        {/* Username Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Enter your username"
            disabled={loading}
            autoFocus
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {/* Password Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={loading}
            required
            className="w-full border rounded px-3 py-2"
          />
        </div>
        {/* Error Message */}
        {error && (
          <div className="bg-red-100 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}
        {/* Submit Button */}
        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded hover:bg-gray-900 transition"
          disabled={loading || !username.trim() || !password.trim()}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <div className="text-xs text-gray-500 text-center">
          <p>Having trouble? Contact your system administrator.</p>
        </div>
      </form>
    </div>
  );
};

export default AdminDashboardLogin; 