import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, BarChart2, Clock, Phone, AlertCircle } from "lucide-react";
import { ActivitiesSummary } from "../services/activitiesService";
import { formatStatusCounts } from "../services/activitiesService";

interface DashboardCardsProps {
  activitiesSummary: ActivitiesSummary | null;
  selectedCampaign: { id: string; name: string } | null;
  loading: boolean;
  error: string | null;
}

export function DashboardCards({ 
  activitiesSummary, 
  selectedCampaign, 
  loading, 
  error 
}: DashboardCardsProps) {
  
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Loading...</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-primary">...</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Loading data...</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Failed to load data</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!activitiesSummary) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No Data</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-primary">0</div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Not enough data available</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statusCounts = formatStatusCounts(activitiesSummary.by_status);
  const { performance_metrics } = activitiesSummary;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Bestillinger (Orders) Card */}
      <Card className="bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Bestillinger</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold text-primary">
            {statusCounts.ja}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>{statusCounts.ja} Bekreftet</div>
            <div>{statusCounts.ja} Fullført</div>
            <div>0 kr Provisjon</div>
          </div>
        </CardContent>
      </Card>

      {/* Treffrate (Hit Rate) Card */}
      <Card className="bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Treffrate</CardTitle>
          <BarChart2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold text-primary">
            {activitiesSummary.hit_rate}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>{statusCounts.total} Totale samtaler</div>
            <div>{statusCounts.ja} Svarte ja</div>
            <div>{statusCounts.nei} Svarte nei</div>
            <div>0 Tilbakeringing</div>
            <div>{statusCounts.ikke_hjemme} Telefonsvarer</div>
          </div>
        </CardContent>
      </Card>

      {/* Logget Tid (Logged Time) Card */}
      <Card className="bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Logget Tid</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-2xl font-bold text-primary">
            {performance_metrics?.avg_per_day ? `${performance_metrics.avg_per_day}t` : '0t 0m'}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div>0t 0m Klar</div>
            <div>0t 0m Pause</div>
            <div>0t 0m Etterarbeid</div>
            <div>0t 0m Samtaletid</div>
          </div>
        </CardContent>
      </Card>

      {/* Aktiv Kampanje (Active Campaign) Card */}
      <Card className="bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Aktiv Kampanje</CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-lg font-bold text-primary">
            {selectedCampaign ? selectedCampaign.name : 'Ingen valgt'}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <Badge variant="outline" className={selectedCampaign ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"}>
                {selectedCampaign ? 'Aktiv' : 'Ingen'}
              </Badge>
            </div>
            {selectedCampaign && (
              <>
                <div>Mål: 30 samtaler/dag</div>
                <div>Fremgang: {statusCounts.total}/30 samtaler</div>
                {performance_metrics?.total_employees && (
                  <div>Aktive: {performance_metrics.total_employees} ansatte</div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 