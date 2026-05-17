'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Lock, Unlock, Map, TrendingUp, Loader2 } from 'lucide-react';
import { CampaignStatistics } from '@/services/lockedAreasService';

interface StatisticsCardProps {
  statistics: CampaignStatistics | null;
  loading: boolean;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ statistics, loading }) => {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campaign Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!statistics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campaign Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <BarChart3 className="h-8 w-8 mx-auto mb-2" />
            <p>No statistics available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Campaign Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campaign Info */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-1">Campaign</h3>
          <p className="text-blue-800">{statistics.campaign_name}</p>
        </div>

        {/* Main Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Map className="h-5 w-5 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {statistics.total_available_areas.toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">Total Available</p>
          </div>
          
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Lock className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-red-900">
              {statistics.total_locked_areas}
            </p>
            <p className="text-sm text-red-600">Locked Areas</p>
          </div>
        </div>

        {/* Lock Percentage */}
        <div className="text-center p-3 bg-yellow-50 rounded-lg">
          <div className="flex items-center justify-center mb-2">
            <TrendingUp className="h-5 w-5 text-yellow-600" />
          </div>
          <p className="text-2xl font-bold text-yellow-900">
            {statistics.lock_percentage.toFixed(2)}%
          </p>
          <p className="text-sm text-yellow-600">Lock Percentage</p>
        </div>

        {/* Breakdown by Type */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Breakdown by Type</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  Fylke
                </Badge>
                <span className="text-sm text-gray-700">Counties</span>
              </div>
              <span className="font-semibold text-blue-900">
                {statistics.locked_by_type.fylke}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  Kommune
                </Badge>
                <span className="text-sm text-gray-700">Municipalities</span>
              </div>
              <span className="font-semibold text-green-900">
                {statistics.locked_by_type.kommune}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-2 bg-purple-50 rounded">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-100 text-purple-800">
                  Grunnkrets
                </Badge>
                <span className="text-sm text-gray-700">Basic Districts</span>
              </div>
              <span className="font-semibold text-purple-900">
                {statistics.locked_by_type.grunnkrets}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatisticsCard;
