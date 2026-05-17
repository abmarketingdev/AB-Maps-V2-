'use client';

import React, { useState } from 'react';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import ClientLayout from '../../ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Unlock, Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useUnlockAreas } from '../hooks/useUnlockAreas';
import StatisticsCard from '../components/StatisticsCard';
import LockedAreaCard from '../components/LockedAreaCard';
import BulkUnlockActionBar from '../components/BulkUnlockActionBar';
import BulkUnlockConfirmationModal from '../components/BulkUnlockConfirmationModal';

const UnlockAreasPage: React.FC = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [showBulkUnlockModal, setShowBulkUnlockModal] = useState(false);
  
  const {
    lockedAreas,
    statistics,
    checkedAreas,
    loading,
    search,
    campaignId,
    toggleAreaCheck,
    clearCheckedAreas,
    getCheckedAreas,
    bulkUnlockAreas,
    updateSearch,
    loadLockedAreas,
    loadStatistics,
  } = useUnlockAreas();

  const handleBulkUnlock = () => {
    setShowBulkUnlockModal(true);
  };

  const handleConfirmBulkUnlock = async () => {
    await bulkUnlockAreas();
    setShowBulkUnlockModal(false);
  };

  const handleRefresh = async () => {
    await Promise.all([loadLockedAreas(), loadStatistics()]);
    toast({
      title: 'Success',
      description: 'Data refreshed successfully',
      variant: 'default',
    });
  };

  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <div className="container mx-auto p-4 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Unlock Areas</h1>
              <p className="text-gray-600">Manage locked areas for your campaign</p>
            </div>
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading.areas || loading.statistics}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${(loading.areas || loading.statistics) ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Statistics */}
          <StatisticsCard 
            statistics={statistics} 
            loading={loading.statistics} 
          />

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search Locked Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by area name, key, or type..."
                  value={search}
                  onChange={(e) => updateSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Locked Areas List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Unlock className="h-5 w-5" />
                Locked Areas ({lockedAreas.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading.areas ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">Loading locked areas...</span>
                </div>
              ) : lockedAreas.length > 0 ? (
                <div className="space-y-3">
                  {lockedAreas.map((area) => (
                    <LockedAreaCard
                      key={area.id}
                      area={area}
                      isChecked={checkedAreas.has(area.area_key)}
                      onCheck={(checked) => toggleAreaCheck(area.area_key, checked)}
                      loading={loading.bulkUnlock}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Unlock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium mb-2">No locked areas found</h3>
                  <p className="text-sm">
                    {search ? 'Try adjusting your search criteria' : 'No areas are currently locked for this campaign'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bulk Action Bar */}
          <BulkUnlockActionBar
            selectedCount={checkedAreas.size}
            onBulkUnlock={handleBulkUnlock}
            onClearSelection={clearCheckedAreas}
            campaignName={statistics?.campaign_name}
            disabled={loading.bulkUnlock}
          />

          {/* Bulk Unlock Confirmation Modal */}
          <BulkUnlockConfirmationModal
            open={showBulkUnlockModal}
            onClose={() => setShowBulkUnlockModal(false)}
            onConfirm={handleConfirmBulkUnlock}
            selectedAreas={getCheckedAreas()}
            campaignName={statistics?.campaign_name || 'Unknown Campaign'}
            loading={loading.bulkUnlock}
          />
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
};

export default UnlockAreasPage;