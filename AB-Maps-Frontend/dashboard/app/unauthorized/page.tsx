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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tilgang nektet</h1>
          <p className="text-gray-600">
            Du har ikke tillatelse til å få tilgang til denne ressursen.
          </p>
        </div>

        <Alert variant="destructive" className="mb-6">
          <AlertDescription>
            {user?.user_type === 'employee' 
              ? "Dette området er begrenset til ledere kun. Vennligst kontakt din leder hvis du trenger tilgang."
              : "Du har ikke de nødvendige tillatelsene til å se dette innholdet."
            }
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Gå til Dashboard
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="w-full">
            <Link href="javascript:history.back()">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Gå tilbake
            </Link>
          </Button>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>Nåværende bruker: {user?.username}</p>
          <p>Rolle: {user?.user_type}</p>
        </div>
      </div>
    </div>
  );
};

export default UnauthorizedPage; 