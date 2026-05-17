"use client"

import { TableHeader } from "@/components/ui/table"

import { useState, useEffect } from "react"
import { Search, MoreHorizontal, Download, ListFilter } from "lucide-react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetchFilteredActivities, fetchCampaigns, setSelectedCampaign, getSelectedCampaign, clearInvalidCampaignData, Activity, FilteredActivitiesResponse } from "./services/activitiesService"
import { fetchActivities as fetchLegacyActivities, Activity as LegacyActivity } from "./services/activityService"
import { authService } from "./lib/auth/authService"
import LoginPrompt from "./components/LoginPrompt"

export default function SalesScreen() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [legacyActivities, setLegacyActivities] = useState<LegacyActivity[]>([])
  const [activeTab, setActiveTab] = useState("sales")
  const [startDate, setStartDate] = useState("") // Empty by default - shows all data
  const [endDate, setEndDate] = useState("") // Empty by default - shows all data
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCampaign, setSelectedCampaignState] = useState("all")
  const [showStarted, setShowStarted] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([])
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (authService.isAuthenticated()) {
          await authService.verifyToken()
          setIsAuthenticated(true)
        }
      } catch (error) {
        console.error('Authentication check failed:', error)
        setIsAuthenticated(false)
      }
    }
    
    checkAuth()
  }, [])

  // Clear invalid campaign data on mount
  useEffect(() => {
    clearInvalidCampaignData()
  }, [])

  // Load campaigns on component mount
  useEffect(() => {
    const loadCampaigns = async () => {
      try {
        console.log('Loading campaigns...')
        const campaignsData = await fetchCampaigns()
        console.log('Campaigns loaded:', campaignsData)
        
        if (!Array.isArray(campaignsData)) {
          console.error('Campaigns data is not an array:', campaignsData)
          setError('Invalid campaigns data received from server.')
          return
        }
        
        setCampaigns(campaignsData)
        
        if (campaignsData.length === 0) {
          setError('No campaigns available. Please create campaigns first.')
          return
        }
        
        // Set default campaign if none selected
        const currentCampaign = getSelectedCampaign()
        if (!currentCampaign && campaignsData.length > 0) {
          // Prefer "NGO Campaign" if available, otherwise use first campaign
          const preferredCampaign = campaignsData.find(c => c.name === "NGO Campaign") || campaignsData[0]
          setSelectedCampaign(preferredCampaign)
          setSelectedCampaignState(preferredCampaign.name)
        } else if (currentCampaign) {
          // Validate that the stored campaign still exists
          const campaignExists = campaignsData.find(c => c.id === currentCampaign.id)
          if (campaignExists) {
            setSelectedCampaignState(currentCampaign.name)
          } else {
            // Use preferred campaign if stored one doesn't exist
            const preferredCampaign = campaignsData.find(c => c.name === "NGO Campaign") || campaignsData[0]
            setSelectedCampaign(preferredCampaign)
            setSelectedCampaignState(preferredCampaign.name)
          }
        }
      } catch (error) {
        console.error('Error loading campaigns:', error)
        setError('Failed to load campaigns. Please check your connection.')
      }
    }
    
    if (isAuthenticated) {
      loadCampaigns()
    }
  }, [isAuthenticated])

  // Load activities data
  const loadActivitiesData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const currentCampaign = getSelectedCampaign()
      console.log('Current campaign:', currentCampaign)
      
      if (!currentCampaign) {
        // Don't show error - just show empty state or let user select from navbar
        setActivities([])
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalCount: 0
        })
        setLoading(false)
        return
      }

      const statusFilter = showStarted ? 'ja,nei,ikke_hjemme' : 'ja'
      console.log('Loading activities with filters:', {
        campaignId: currentCampaign.id,
        campaignName: currentCampaign.name,
        startDate,
        endDate,
        statusFilter,
        searchTerm,
        page: pagination.currentPage
      })
      
      const response: FilteredActivitiesResponse = await fetchFilteredActivities({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: statusFilter,
        search: searchTerm,
        page: pagination.currentPage,
        pageSize: 50
      })
      
      console.log('Activities API response:', {
        totalCount: response.total_count,
        resultsCount: response.results.length,
        page: response.page,
        totalPages: response.total_pages
      })
      
      setActivities(response.results)
      setPagination({
        currentPage: response.page,
        totalPages: response.total_pages,
        totalCount: response.total_count
      })
    } catch (error) {
      console.error('Error loading activities:', error)
      setError(error instanceof Error ? error.message : 'Failed to load activities data')
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  // Load data when filters change
  useEffect(() => {
    if (isAuthenticated && campaigns.length > 0) {
      loadActivitiesData()
    }
  }, [startDate, endDate, searchTerm, showStarted, pagination.currentPage, isAuthenticated, campaigns, selectedCampaign])

  // Load legacy activities (keeping existing functionality)
  useEffect(() => {
    fetchLegacyActivities().then(setLegacyActivities)
  }, [])

  // Handle campaign selection
  const handleCampaignChange = async (campaignName: string) => {
    if (campaignName === "all") {
      setSelectedCampaignState("all")
      // Reset to default campaign from localStorage when "all" is selected
      const defaultCampaign = getSelectedCampaign()
      if (defaultCampaign) {
        setSelectedCampaign(defaultCampaign)
        setSelectedCampaignState(defaultCampaign.name)
        await loadActivitiesData()
      }
      return
    }
    
    const campaign = campaigns.find(c => c.name === campaignName)
    if (campaign) {
      setSelectedCampaign(campaign)
      setSelectedCampaignState(campaignName)
      // Immediately load activities for the selected campaign
      await loadActivitiesData()
    }
  }

  const filteredActivities = legacyActivities.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.mobile.includes(searchTerm)
    const matchesCampaign = selectedCampaign === "all" || item.campaign === selectedCampaign
    return matchesSearch && matchesCampaign
  })

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <LoginPrompt 
        onLoginSuccess={() => setIsAuthenticated(true)} 
      />
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <div className="flex-1 space-y-4 p-4 md:p-8">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Mine Salg</h2>
            <p className="text-muted-foreground">Administrer dine salg og aktiviteter på tvers av kampanjer</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" className="h-8">
              <Download className="mr-2 h-3.5 w-3.5" />
              Eksporter
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Mine Salg</CardTitle>
                  <CardDescription>Administrer dine salg og aktiviteter på tvers av kampanjer</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-end gap-2">
                    <div className="flex flex-col gap-1">
                      <label htmlFor="start-date" className="text-xs font-medium text-muted-foreground">
                        Fra dato
                      </label>
                      <Input
                        id="start-date"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full sm:w-auto"
                        placeholder="Start date"
                      />
                    </div>
                    <div className="flex items-center text-muted-foreground text-sm font-medium">
                      til
                    </div>
                    <div className="flex flex-col gap-1">
                      <label htmlFor="end-date" className="text-xs font-medium text-muted-foreground">
                        Til dato
                      </label>
                      <Input
                        id="end-date"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full sm:w-auto"
                        placeholder="End date"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Kampanje
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-10">
                          <ListFilter className="mr-2 h-4 w-4" />
                          {selectedCampaign === "all" ? "Alle Kampanjer" : selectedCampaign}
                        </Button>
                      </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleCampaignChange("all")}>Alle Kampanjer</DropdownMenuItem>
                      {campaigns.map((campaign) => (
                        <DropdownMenuItem key={campaign.id} onClick={() => handleCampaignChange(campaign.name)}>
                          {campaign.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-xs font-medium text-muted-foreground">
                      Søk
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Søk etter navn..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="sales">Salg</TabsTrigger>
                  <TabsTrigger value="activities">Aktiviteter</TabsTrigger>
                </TabsList>

                <TabsContent value="sales" className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-sm text-muted-foreground">
                      Filtrer resultater
                    </div>
                    <div className="flex items-center space-x-2">
                      <label htmlFor="show-started" className="text-sm font-medium cursor-pointer">
                        Vis alle resultater
                      </label>
                      <input
                        id="show-started"
                        type="checkbox"
                        checked={showStarted}
                        onChange={() => setShowStarted(!showStarted)}
                        className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                      />
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dato</TableHead>
                        <TableHead>Navn</TableHead>
                        <TableHead>Mobil</TableHead>
                        <TableHead>Resultat</TableHead>
                        <TableHead>Kampanje</TableHead>
                        <TableHead>Ansatt</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <div className="flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                              <span className="ml-2">Laster data...</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : error ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-red-500">
                            {error}
                          </TableCell>
                        </TableRow>
                      ) : activities.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            Ingen aktiviteter funnet for valgt periode
                          </TableCell>
                        </TableRow>
                      ) : (
                        activities.map((item: Activity) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.date}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.mobile}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  item.outcome === "ja"
                                    ? "secondary"
                                    : item.outcome === "nei"
                                      ? "outline"
                                      : "default"
                                }
                              >
                                {item.outcome}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.campaign}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Åpne meny</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Se detaljer</DropdownMenuItem>
                                  <DropdownMenuItem>Ring tilbake</DropdownMenuItem>
                                  <DropdownMenuItem>Merk som fullført</DropdownMenuItem>
                                  <DropdownMenuItem>Rediger</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="activities" className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dato</TableHead>
                        <TableHead>Aktivitet</TableHead>
                        <TableHead>Kampanje</TableHead>
                        <TableHead>Navn</TableHead>
                        <TableHead>Mobil</TableHead>
                        <TableHead>Resultat</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActivities.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.activity}</TableCell>
                          <TableCell>{item.campaign}</TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.mobile}</TableCell>
                          <TableCell>{item.outcome}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Åpne meny</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Se detaljer</DropdownMenuItem>
                                <DropdownMenuItem>Rediger aktivitet</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Viser {activities.length} av {pagination.totalCount} resultater
              </div>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.currentPage <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                >
                  Forrige
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={pagination.currentPage >= pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                >
                  Neste
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
