"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, ArrowLeft, Home } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';

const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center max-w-md mx-auto p-8">
        <div className="mb-6">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">
            You don't have permission to access this resource.
          </p>
        </div>

        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            {user?.user_type === 'employee' 
              ? "This area is restricted to managers only. Please contact your manager if you need access."
              : "You don't have the necessary permissions to view this content."
            }
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link href="javascript:history.back()">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Link>
          </Button>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>Current user: {user?.username}</p>
          <p>Role: {user?.user_type}</p>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage; 