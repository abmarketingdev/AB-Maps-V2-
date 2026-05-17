"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth/AuthContext";

const LoginPage: React.FC = () => {
  const [userType, setUserType] = useState<"manager" | "employee">("manager");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (user.user_type === "employee") {
        router.push("/emp");
      } else {
        router.push("/");
      }
    }
  }, [isAuthenticated, authLoading, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const loginResponse = await login({
        username: username.trim(),
        password: password.trim(),
        user_type: userType,
      });
      // Login successful, redirect based on user_type
      if (loginResponse.user_type === "employee") {
        router.push("/employee");
      } else {
        router.push("/");
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      
      // Handle different types of errors
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        setError("Invalid username or password. Please try again.");
      } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        setError("Access denied. Please check your permissions.");
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        setError("Unable to connect to the server. Please check your internet connection.");
      } else {
        setError(error.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Show loading if auth is being checked
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Logg inn</h1>
          <p className="mt-2 text-sm text-gray-600">
            Få tilgang til AB Maps dashbordet ditt
          </p>
        </div>

        {/* User Type Selection */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Kontotype
          </label>
          <div className="flex space-x-2">
            <Button
              type="button"
              variant={userType === "manager" ? "default" : "outline"}
              onClick={() => setUserType("manager")}
              className="flex-1"
              disabled={loading}
            >
              Leder
            </Button>
            <Button
              type="button"
              variant={userType === "employee" ? "default" : "outline"}
              onClick={() => setUserType("employee")}
              className="flex-1"
              disabled={loading}
            >
              Ansatt
            </Button>
          </div>
        </div>

        {/* Username Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Brukernavn
          </label>
          <Input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Skriv inn brukernavn"
            disabled={loading}
            autoFocus
            required
          />
        </div>

        {/* Password Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Passord
          </label>
          <Input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Skriv inn passord"
            disabled={loading}
            required
          />
        </div>

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        <Button 
          type="submit" 
          className="w-full" 
          disabled={loading || !username.trim() || !password.trim()}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Logger inn...</span>
            </div>
          ) : (
            "Logg inn"
          )}
        </Button>

        {/* Development Note */}
        <div className="text-xs text-gray-500 text-center">
          <p>
            Har du problemer? Kontakt systemadministratoren din.
          </p>
        </div>
      </form>
    </div>
  );
};

export default LoginPage; 