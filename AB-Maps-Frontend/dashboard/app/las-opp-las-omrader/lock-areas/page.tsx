'use client';

import React from 'react';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import ClientLayout from '../../ClientLayout';
import AreaHierarchy from '../components/AreaHierarchy';

const LockAreasPage: React.FC = () => {
  return (
    <ProtectedRoute allow={({ isSuperuser, isSalesChief }) => isSuperuser || isSalesChief}>
      <ClientLayout>
        <div className="container mx-auto p-4">
          <AreaHierarchy />
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
};

export default LockAreasPage;
