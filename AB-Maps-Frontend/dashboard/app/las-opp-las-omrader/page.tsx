'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ProtectedRoute } from '@/lib/auth/ProtectedRoute';
import ClientLayout from '../ClientLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Map, Users, Home, Search, Filter, ArrowRight, BarChart3, Clock, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { lockedAreasService, AreaStatistics, SearchResult } from '@/services/lockedAreasService';

const LasOppLasOmraderPage: React.FC = () => {
  const [statistics, setStatistics] = useState<AreaStatistics | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const router = useRouter();

  // Helper function to fetch statistics
  const fetchStatistics = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get campaign from localStorage
      const storedCampaign = localStorage.getItem('currentCampaign');
      let campaignId = null;
      
      if (storedCampaign) {
        try {
          const campaign = JSON.parse(storedCampaign);
          campaignId = campaign.id;
          console.log('Using campaign from localStorage:', campaign.name, campaignId);
        } catch (e) {
          console.error('Error parsing campaign from localStorage:', e);
        }
      }
      
      if (campaignId) {
        // Use campaign-specific statistics
        const campaignStats = await lockedAreasService.getCampaignStatistics(campaignId);
        
        // Convert CampaignStatistics to AreaStatistics format
        const areaStats: AreaStatistics = {
          total_areas: campaignStats.total_available_areas,
          locked_areas: campaignStats.total_locked_areas,
          unlocked_areas: campaignStats.total_available_areas - campaignStats.total_locked_areas,
          recently_locked: 0, // Not available in campaign stats API
          recently_unlocked: 0, // Not available in campaign stats API
        };
        
        setStatistics(areaStats);
      } else {
        // No campaign selected, show empty stats
        console.warn('No campaign found in localStorage, showing empty statistics');
        setStatistics({
          total_areas: 0,
          locked_areas: 0,
          unlocked_areas: 0,
          recently_locked: 0,
          recently_unlocked: 0,
        });
        toast({
          title: 'Ingen kampanje valgt',
          description: 'Velg en kampanje for å se statistikk over låste områder.',
          variant: 'default',
        });
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast({
        title: 'Feil',
        description: 'Kunne ikke laste inn statistikk. Vennligst prøv igjen.',
        variant: 'destructive',
      });
      // Set empty stats on error
      setStatistics({
        total_areas: 0,
        locked_areas: 0,
        unlocked_areas: 0,
        recently_locked: 0,
        recently_unlocked: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch statistics on component mount
  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  // Listen for campaign changes in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'currentCampaign') {
        console.log('Campaign changed in localStorage, refreshing statistics');
        fetchStatistics();
      }
    };

    // Listen for cross-tab storage events
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for same-tab changes (custom event)
    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail?.key === 'currentCampaign') {
        console.log('Campaign changed (custom event), refreshing statistics');
        fetchStatistics();
      }
    };
    
    window.addEventListener('localStorageChange', handleCustomStorageChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange', handleCustomStorageChange as EventListener);
    };
  }, [fetchStatistics]);

  // Handle search with debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const results = await lockedAreasService.searchAreas(searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching areas:', error);
        toast({
          title: 'Feil',
          description: 'Kunne ikke søke etter områder. Vennligst prøv igjen.',
          variant: 'destructive',
        });
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, toast]);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  if (loading) {
    return (
      <ProtectedRoute requiredUserType="manager">
        <ClientLayout>
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Laster statistikk...</p>
            </div>
          </div>
        </ClientLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredUserType="manager">
      <ClientLayout>
        <div className="container mx-auto p-4 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Lås opp/lås områder</h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Administrer tilgang til områder for ansatte. Velg mellom å låse nye områder eller administrere eksisterende låste områder.
            </p>
          </div>

          {/* Statistics Cards */}
          {statistics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Totalt områder</p>
                      <p className="text-2xl font-bold text-gray-900">{statistics.total_areas}</p>
                    </div>
                    <Map className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Låste områder</p>
                      <p className="text-2xl font-bold text-red-600">{statistics.locked_areas}</p>
                    </div>
                    <Lock className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Låst opp områder</p>
                      <p className="text-2xl font-bold text-green-600">{statistics.unlocked_areas}</p>
                    </div>
                    <Unlock className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Nylig låst (7 dager)</p>
                      <p className="text-2xl font-bold text-orange-600">{statistics.recently_locked}</p>
                    </div>
                    <Clock className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Navigation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Lock New Areas Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group" 
                  onClick={() => handleNavigation('/las-opp-las-omrader/lock-areas')}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <Lock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Lås nye områder</CardTitle>
                    <CardDescription>
                      Velg og lås områder fra fylker, kommuner eller grunnkretser
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Map className="h-4 w-4 mr-2" />
                    <span>Hierarkisk områdevalg</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Search className="h-4 w-4 mr-2" />
                    <span>Søk og filtrer områder</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Shield className="h-4 w-4 mr-2" />
                    <span>Lås på alle nivåer</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-blue-600 font-medium group-hover:text-blue-700">
                  <span>Start låsing</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>

            {/* Manage Locked Areas Card */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer group"
                  onClick={() => handleNavigation('/las-opp-las-omrader/unlock-areas')}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <Unlock className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Administrer låste områder</CardTitle>
                    <CardDescription>
                      Se og administrer alle områder som er låst for ansatte
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    <span>Oversikt over låste områder</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    <span>Bulk-operasjoner</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="h-4 w-4 mr-2" />
                    <span>Låsehistorikk</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-green-600 font-medium group-hover:text-green-700">
                  <span>Administrer</span>
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Search Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Hurtigsøk
              </CardTitle>
              <CardDescription>
                Søk etter områder på tvers av alle nivåer (fylke, kommune, grunnkrets)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Søk etter områder..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </div>

                {/* Search Results */}
                {searchResults && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-700">
                        {searchResults.total_count} områder funnet
                      </p>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {searchResults.areas.slice(0, 10).map((area, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{area.name}</p>
                            <p className="text-sm text-gray-600">
                              {area.area_key} • {area.area_km2} km²
                            </p>
                          </div>
                          <Badge variant={area.is_locked ? "destructive" : "default"}>
                            {area.is_locked ? "Låst" : "Åpen"}
                          </Badge>
                        </div>
                      ))}
                      {searchResults.areas.length > 10 && (
                        <p className="text-sm text-gray-500 text-center py-2">
                          ... og {searchResults.areas.length - 10} flere
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {searchQuery && searchResults && searchResults.areas.length === 0 && !searchLoading && (
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Ingen områder funnet
                    </h3>
                    <p className="text-gray-600">
                      Prøv å søke med et annet søkeord eller sjekk stavemåten.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Hurtighandlinger</CardTitle>
              <CardDescription>
                Vanlige oppgaver og snarveier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => handleNavigation('/las-opp-las-omrader/lock-areas')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-4 w-4" />
                    <span className="font-medium">Lås alle i fylke</span>
                  </div>
                  <span className="text-sm text-gray-600">Lås alle grunnkretser i et fylke</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => handleNavigation('/las-opp-las-omrader/unlock-areas')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Unlock className="h-4 w-4" />
                    <span className="font-medium">Lås opp alle</span>
                  </div>
                  <span className="text-sm text-gray-600">Lås opp alle låste områder</span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-4 flex flex-col items-start"
                  onClick={() => handleNavigation('/las-opp-las-omrader/unlock-areas')}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="font-medium">Se statistikk</span>
                  </div>
                  <span className="text-sm text-gray-600">Detaljert oversikt over låste områder</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ClientLayout>
    </ProtectedRoute>
  );
};

export default LasOppLasOmraderPage;
