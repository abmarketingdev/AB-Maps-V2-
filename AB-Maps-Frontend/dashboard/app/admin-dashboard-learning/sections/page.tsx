"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Copy, Move, MoreHorizontal, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "@/components/learning/MobileHeader";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { MobileSelect, MobileActionMenu, CommonActions, SectionEditorModal } from "@/components/admin";
import type { LearningSection, GroupedSectionsResponse } from "@/services/learningTypes";

const SectionManagement = () => {
  const [sections, setSections] = useState<LearningSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedSectionsResponse | null>(null);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionModalId, setSectionModalId] = useState<number | null>(null);
  const router = useRouter();
  const isMobile = useIsMobile(); // Must be called before any conditional returns

  // Check authentication and fetch data
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const authService = LearningAuthService.getInstance();
        const authenticated = await authService.isAuthenticated();
        
        if (!authenticated) {
          router.push("/learning-platform");
          return;
        }

        const isSuperuser = await authService.checkSuperuser();
        if (!isSuperuser) {
          router.push("/learning-dashboard");
          return;
        }

        await fetchSections();
        await fetchCampaigns();  // NEW: Fetch campaigns
      } catch (error) {
        console.error("Authentication error:", error);
        setError("Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchSections = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      
      // NEW: Use grouped sections endpoint
      const groupedSections = await adminService.getAdminGroupedSections();
      setGroupedData(groupedSections);
      
      // Flatten all sections for backward compatibility and operations
      const allSections = groupedSections.campaigns.flatMap(campaign => campaign.sections);
      setSections(allSections);
      
      console.log("Grouped sections loaded:", groupedSections);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setError("Failed to fetch sections");
    }
  };

  // NEW: Fetch campaigns list
  const fetchCampaigns = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/campaigns/`, {
        headers: {
          'Authorization': `Bearer ${JSON.parse(localStorage.getItem('auth_tokens') || '{}').access}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const campaignList = (data.results || data).map((c: any) => ({
          id: c.id,
          name: c.name
        }));
        setCampaigns(campaignList);
      }
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      // Non-critical error, continue without campaigns
    }
  };

  const handleDeleteSection = async (id: number) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.deleteSection(id);
      await fetchSections();
    } catch (error) {
      console.error("Error deleting section:", error);
      setError("Failed to delete section");
    }
  };

  const handleDuplicateSection = async (id: number) => {
    try {
      const adminService = LearningAdminService.getInstance();
      const result = await adminService.duplicateSection(id);
      // Show success message with new section ID
      alert(`Section duplicated successfully! New section ID: ${result.new_section_id}`);
      await fetchSections();
    } catch (error) {
      console.error("Error duplicating section:", error);
      setError("Failed to duplicate section");
    }
  };

  const handleBulkOperation = async (operation: string) => {
    if (selectedSections.length === 0) {
      alert("Please select sections first");
      return;
    }

    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.bulkOperations(operation, selectedSections);
      setSelectedSections([]);
      await fetchSections();
    } catch (error) {
      console.error("Error performing bulk operation:", error);
      setError("Failed to perform bulk operation");
    }
  };

  // UPDATED: Reorder logic with new format - only reorders sections from same campaign
  const handleReorderSections = async (campaignSections: LearningSection[]) => {
    try {
      const adminService = LearningAdminService.getInstance();
      
      // Create section_orders array with id and new order
      const sectionOrders = campaignSections.map((section, index) => ({
        id: section.id,
        order: index + 1
      }));
      
      await adminService.reorderSections(sectionOrders);
      await fetchSections();
      alert('Sections reordered successfully!');
    } catch (error: any) {
      console.error("Error reordering sections:", error);
      setError(error.message || "Failed to reorder sections");
      // Revert will happen on re-fetch
      await fetchSections();
    }
  };

  // Filter sections by campaign (for fallback flat display and operations)
  const filteredSections = selectedCampaignFilter === null
    ? sections
    : sections.filter(s => {
        if (selectedCampaignFilter === 'null') {
          return s.campaign === null || s.campaign_id === null;
        }
        return s.campaign === selectedCampaignFilter || s.campaign_id === selectedCampaignFilter;
      });

  if (loading) {
    return <LoadingState message="Loading sections..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load sections"
        message={error}
        onGoHome={() => router.push("/admin-dashboard-learning")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      {isMobile ? (
        <MobileHeader
          title="Section Management"
          userData={null}
          onLogout={() => {}}
          onBack={() => router.push("/admin-dashboard-learning")}
          showBack={true}
        />
      ) : (
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin-dashboard-learning" prefetch={true}>
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Admin Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Section Management</h1>
                <p className="text-gray-600">Manage learning sections</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                onClick={() => {
                  setSectionModalId(null);
                  setSectionModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Opprett seksjon
              </Button>
            </div>
          </div>
        </header>
      )}

      {/* Mobile Create Button */}
      {isMobile && (
        <div className="px-4 pt-4">
          <Button
            className="w-full h-12 min-h-[44px]"
            onClick={() => {
              setSectionModalId(null);
              setSectionModalOpen(true);
            }}
          >
            <Plus className="w-5 h-5 mr-2" />
            Opprett ny seksjon
          </Button>
        </div>
      )}

      <SectionEditorModal
        open={sectionModalOpen}
        onOpenChange={setSectionModalOpen}
        sectionId={sectionModalId}
        onSaved={fetchSections}
      />

      <div className={cn(
        "mx-auto",
        isMobile ? "px-4 py-4" : "max-w-7xl px-6 py-6"
      )}>
        {/* Campaign Filter */}
        <div className={cn("mb-6", isMobile && "mb-4")}>
          <div className={cn(
            "flex items-center gap-4",
            isMobile ? "flex-col gap-3 items-stretch" : "flex-row"
          )}>
            <div className={cn("flex-1", isMobile && "w-full")}>
              <label className={cn(
                "font-medium text-gray-700 mb-2 block",
                isMobile ? "text-sm" : "text-sm"
              )}>
                Filter by Campaign
              </label>
              <MobileSelect
                value={selectedCampaignFilter === null ? 'all' : selectedCampaignFilter}
                onValueChange={(value) => setSelectedCampaignFilter(value === 'all' ? null : value)}
                placeholder="All Campaigns"
                options={[
                  { value: 'all', label: `All Campaigns (${sections.length})` },
                  { value: 'null', label: `📚 General Training (${sections.filter(s => s.campaign === null).length})` },
                  ...campaigns.map(c => ({
                    value: c.id,
                    label: `🎯 ${c.name} (${sections.filter(s => s.campaign_id === c.id).length})`
                  }))
                ]}
              />
            </div>
            <div className={cn(
              "text-gray-600",
              isMobile ? "text-xs text-center" : "text-sm"
            )}>
              Viser {filteredSections.length} av {sections.length} seksjoner
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedSections.length > 0 && (
          <Card className={cn("mb-6", isMobile && "mb-4")}>
            <CardContent className={cn(isMobile ? "p-4" : "pt-6")}>
              <div className={cn(
                "flex items-center justify-between",
                isMobile ? "flex-col gap-3" : "flex-row"
              )}>
                <p className={cn(
                  "text-gray-600",
                  isMobile ? "text-sm font-medium" : "text-sm"
                )}>
                  {selectedSections.length} seksjon{selectedSections.length !== 1 ? 'er' : ''} valgt
                </p>
                <div className={cn(
                  "flex gap-2",
                  isMobile ? "w-full flex-col" : "flex-row"
                )}>
                  <Button
                    variant="outline"
                    size={isMobile ? "default" : "sm"}
                    onClick={() => handleBulkOperation("activate")}
                    className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                  >
                    Aktiver
                  </Button>
                  <Button
                    variant="outline"
                    size={isMobile ? "default" : "sm"}
                    onClick={() => handleBulkOperation("deactivate")}
                    className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                  >
                    Deaktiver
                  </Button>
                  <Button
                    variant="destructive"
                    size={isMobile ? "default" : "sm"}
                    onClick={() => handleBulkOperation("delete")}
                    className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                  >
                    Slett
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sections Grid - Grouped by Campaign */}
        {groupedData && groupedData.campaigns.length > 0 ? (
          <div className="space-y-8">
            {groupedData.campaigns
              .filter(campaign => {
                // Apply campaign filter
                if (selectedCampaignFilter === null) return true; // Show all
                if (selectedCampaignFilter === 'null') {
                  return campaign.id === null;
                }
                return campaign.id === selectedCampaignFilter;
              })
              .map((campaign) => (
                <div key={campaign.id || 'general'}>
                  {/* Campaign Header */}
                  <div className={cn("mb-4", isMobile && "mb-3")}>
                    <h3 className={cn(
                      "font-bold text-gray-900 flex items-center gap-2 flex-wrap",
                      isMobile ? "text-lg" : "text-xl"
                    )}>
                      <span>{campaign.is_general ? '📚' : '🎯'}</span>
                      <span>{campaign.name}</span>
                      <Badge variant={campaign.is_general ? "outline" : "default"} className={cn(
                        isMobile && "text-[10px] px-1.5 py-0"
                      )}>
                        {campaign.sections.length} seksjon{campaign.sections.length !== 1 ? 'er' : ''}
                      </Badge>
                    </h3>
                    <p className={cn(
                      "text-gray-600",
                      isMobile ? "text-xs mt-1" : "text-sm"
                    )}>
                      {campaign.is_general 
                        ? 'Synlig for alle brukere' 
                        : 'Synlig kun for tildelte kampanjebrukere'}
                    </p>
                  </div>

                  {/* Campaign Sections Grid */}
                  <div className={cn(
                    "grid gap-4",
                    isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3 gap-6"
                  )}>
                    {campaign.sections.map((section) => (
                      <Card key={section.id} className={cn(
                        "relative",
                        isMobile && "min-h-[140px]"
                      )}>
                        <CardHeader className={cn(isMobile ? "p-4" : "")}>
                          <div className={cn(
                            "flex items-start justify-between",
                            isMobile ? "flex-col gap-3" : "flex-row"
                          )}>
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className={cn(
                                "rounded-lg flex-shrink-0",
                                isMobile ? "p-1.5" : "p-2",
                                section.icon_color || "bg-blue-500"
                              )}>
                                <span className={cn(isMobile ? "text-base" : "text-lg")}>
                                  {section.icon_emoji || "📚"}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <CardTitle className={cn(
                                  "truncate",
                                  isMobile ? "text-base" : "text-lg"
                                )}>
                                  {section.title}
                                </CardTitle>
                                <CardDescription className={cn(
                                  isMobile ? "text-xs" : "text-sm"
                                )}>
                                  Rekkefølge: {section.order} • {section.duration_estimate_minutes} min
                                </CardDescription>
                              </div>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1",
                              isMobile && "w-full justify-between pt-2 border-t"
                            )}>
                              <input
                                type="checkbox"
                                checked={selectedSections.includes(section.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSections([...selectedSections, section.id]);
                                  } else {
                                    setSelectedSections(selectedSections.filter(id => id !== section.id));
                                  }
                                }}
                                className={cn(
                                  "cursor-pointer",
                                  isMobile && "h-5 w-5"
                                )}
                                aria-label="Velg seksjon"
                              />
                              <MobileActionMenu
                                actions={[
                                  CommonActions.edit(() => {
                setSectionModalId(section.id);
                setSectionModalOpen(true);
              }),
                                  CommonActions.duplicate(() => handleDuplicateSection(section.id)),
                                  CommonActions.delete(() => handleDeleteSection(section.id))
                                ]}
                                inlineOnMobile={isMobile}
                              />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
                          <p className={cn(
                            "text-gray-600 mb-3 line-clamp-2",
                            isMobile ? "text-xs" : "text-sm"
                          )}>
                            {section.description}
                          </p>
                          <Link
                            href={`/learning-platform/${section.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-[#141414] hover:underline mb-3", isMobile && "text-xs")}
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            Forhåndsvis hele reisen
                          </Link>
                          <div className={cn(
                            "flex items-center justify-between flex-wrap gap-2",
                            isMobile && "flex-col items-start gap-2"
                          )}>
                            <div className="flex items-center gap-2">
                              <Badge variant={section.is_active ? "default" : "secondary"} className={cn(
                                isMobile && "text-[10px] px-1.5 py-0"
                              )}>
                                {section.is_active ? "Aktiv" : "Inaktiv"}
                              </Badge>
                            </div>
                            <div className={cn(
                              "text-gray-500",
                              isMobile ? "text-[10px]" : "text-xs"
                            )}>
                              {new Date(section.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className={cn(
            "grid gap-4",
            isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3 gap-6"
          )}>
            {filteredSections.map((section) => (
              <Card key={section.id} className={cn(
                "relative",
                isMobile && "min-h-[140px]"
              )}>
                <CardHeader className={cn(isMobile ? "p-4" : "")}>
                  <div className={cn(
                    "flex items-start justify-between",
                    isMobile ? "flex-col gap-3" : "flex-row"
                  )}>
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "rounded-lg flex-shrink-0",
                        isMobile ? "p-1.5" : "p-2",
                        section.icon_color || "bg-blue-500"
                      )}>
                        <span className={cn(isMobile ? "text-base" : "text-lg")}>
                          {section.icon_emoji || "📚"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className={cn(
                          "truncate",
                          isMobile ? "text-base" : "text-lg"
                        )}>
                          {section.title}
                        </CardTitle>
                        <CardDescription className={cn(
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Order: {section.order} • {section.duration_estimate_minutes} min
                        </CardDescription>
                      </div>
                    </div>
                    <div className={cn(
                      "flex items-center gap-1",
                      isMobile && "w-full justify-between pt-2 border-t"
                    )}>
                      <input
                        type="checkbox"
                        checked={selectedSections.includes(section.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSections([...selectedSections, section.id]);
                          } else {
                            setSelectedSections(selectedSections.filter(id => id !== section.id));
                          }
                        }}
                        className={cn(
                          "cursor-pointer",
                          isMobile && "h-5 w-5"
                        )}
                        aria-label="Select section"
                      />
                      <MobileActionMenu
                        actions={[
                          CommonActions.edit(() => {
                setSectionModalId(section.id);
                setSectionModalOpen(true);
              }),
                          CommonActions.duplicate(() => handleDuplicateSection(section.id)),
                          CommonActions.delete(() => handleDeleteSection(section.id))
                        ]}
                        inlineOnMobile={isMobile}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className={cn(isMobile ? "p-4 pt-0" : "")}>
                  <p className={cn(
                    "text-gray-600 mb-3 line-clamp-2",
                    isMobile ? "text-xs" : "text-sm"
                  )}>
                    {section.description}
                  </p>
                  <Link
                    href={`/learning-platform/${section.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-[#141414] hover:underline mb-3", isMobile && "text-xs")}
                  >
                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                    Forhåndsvis hele reisen
                  </Link>
                  <div className={cn(
                    "flex items-center justify-between flex-wrap gap-2",
                    isMobile && "flex-col items-start gap-2"
                  )}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Campaign Badge */}
                      <Badge variant={section.is_general_training ? "outline" : "secondary"} className={cn(
                        isMobile && "text-[10px] px-1.5 py-0"
                      )}>
                        {section.is_general_training ? '📚' : '🎯'} {section.campaign_name}
                      </Badge>
                      <Badge variant={section.is_active ? "default" : "secondary"} className={cn(
                        isMobile && "text-[10px] px-1.5 py-0"
                      )}>
                        {section.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className={cn(
                      "text-gray-500",
                      isMobile ? "text-[10px]" : "text-xs"
                    )}>
                      {new Date(section.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {sections.length === 0 && (
          <Card className={cn("text-center", isMobile ? "py-8" : "py-12")}>
            <CardContent className={cn(isMobile ? "p-4" : "")}>
              <BookOpen className={cn(
                "text-gray-400 mx-auto mb-4",
                isMobile ? "w-10 h-10" : "w-12 h-12"
              )} />
              <h3 className={cn(
                "font-medium text-gray-900 mb-2",
                isMobile ? "text-base" : "text-lg"
              )}>
                No sections found
              </h3>
              <p className={cn(
                "text-gray-600 mb-4",
                isMobile ? "text-sm" : ""
              )}>
                Opprett din første læringsseksjon for å komme i gang.
              </p>
              <Button
                className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                onClick={() => {
                  setSectionModalId(null);
                  setSectionModalOpen(true);
                }}
              >
                <Plus className={cn("mr-2", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                Opprett første seksjon
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
};

export default SectionManagement;
