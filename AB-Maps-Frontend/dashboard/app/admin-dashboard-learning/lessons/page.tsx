"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Copy, FileText, Video, HelpCircle, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useIsMobile } from "@/hooks/use-mobile";
import MobileHeader from "@/components/learning/MobileHeader";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { MobileSelect, MobileActionMenu, CommonActions, LessonEditorModal } from "@/components/admin";
import type { LearningLesson, LearningSection, GroupedSectionsResponse } from "@/services/learningTypes";

function LessonPreviewPanel({
  lesson,
  section,
  onClose,
  onUnpublish,
  onDelete,
  onAdministrer,
}: {
  lesson: LearningLesson;
  section?: LearningSection;
  onClose: () => void;
  onUnpublish: (l: LearningLesson) => void;
  onDelete: (l: LearningLesson) => void;
  onAdministrer?: (l: LearningLesson) => void;
}) {
  const previewUrl = `/learning-platform/${lesson.section}`;
  const contentLabel =
    lesson.kind === "VIDEO" ? "Videoleksjon" : lesson.kind === "QUIZ" ? "Quiz" : "Tekstartikkel";
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 h-24 flex items-end p-4">
        <h3 className="font-bold text-slate-900 truncate flex-1">{lesson.title}</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 -mr-1 text-slate-500 hover:text-slate-900"
          aria-label="Lukk"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-slate-500">ID: {lesson.id}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
            {lesson.duration_estimate_minutes} min
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              lesson.is_active ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"
            )}
          >
            {lesson.is_active ? "Publisert" : "Utkast"}
          </span>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Beskrivelse</p>
          <p className="text-sm text-slate-800 line-clamp-3">{lesson.description || "—"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Innholdsoversikt</p>
          <p className="text-sm text-slate-800 flex items-center gap-2">
            {lesson.kind === "VIDEO" && <span className="material-symbols-outlined text-[18px]">play_circle</span>}
            {lesson.kind === "TEXT" && <FileText className="w-4 h-4" />}
            {lesson.kind === "QUIZ" && <HelpCircle className="w-4 h-4" />}
            1 {contentLabel}
          </p>
        </div>
        <div className="space-y-2 pt-2 border-t border-slate-200">
          {onAdministrer ? (
            <button
              type="button"
              onClick={() => onAdministrer(lesson)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Administrer leksjon
            </button>
          ) : (
            <Link
              href={`/admin-dashboard-learning/lessons/${lesson.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Administrer leksjon
            </Link>
          )}
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            Forhåndsvis
          </a>
          {lesson.is_active && (
            <button
              type="button"
              onClick={() => onUnpublish(lesson)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Avpubliser
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(lesson)}
            className="w-full rounded-lg px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Slett
          </button>
        </div>
      </div>
    </div>
  );
}

const LessonManagement = () => {
  const [lessons, setLessons] = useState<LearningLesson[]>([]);
  const [sections, setSections] = useState<LearningSection[]>([]);
  const [groupedData, setGroupedData] = useState<GroupedSectionsResponse | null>(null);
  const [activeCampaignTab, setActiveCampaignTab] = useState<string | null>(null);
  const [activeSectionFilter, setActiveSectionFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLessons, setSelectedLessons] = useState<number[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LearningLesson | null>(null);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lessonModalId, setLessonModalId] = useState<number | null>(null);
  const [lessonModalPreselectedSectionId, setLessonModalPreselectedSectionId] = useState<number | undefined>(undefined);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile(); // Must be called before any conditional returns

  // Åpne leksjon-modal med forhåndsvalgt seksjon når man kommer fra «Legg til leksjon» med ?section=
  useEffect(() => {
    if (loading || !sections.length) return;
    const sec = searchParams.get("section");
    if (!sec) return;
    const n = parseInt(sec, 10);
    if (isNaN(n) || !sections.some((s) => s.id === n)) return;
    router.replace("/admin-dashboard-learning/lessons");
    setLessonModalPreselectedSectionId(n);
    setLessonModalId(null);
    setLessonModalOpen(true);
  }, [loading, sections, searchParams, router]);

  // Check authentication and fetch data (optimized with parallel execution)
  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        const authService = LearningAuthService.getInstance();
        
        // Run auth checks in parallel for faster response
        const [authenticated, isSuperuser] = await Promise.all([
          authService.isAuthenticated(),
          authService.checkSuperuser().catch(() => false)
        ]);
        
        if (!authenticated) {
          router.push("/learning-platform");
          return;
        }

        if (!isSuperuser) {
          router.push("/learning-dashboard");
          return;
        }

        await Promise.all([fetchLessons(), fetchSections(), fetchGroupedSections()]);
      } catch (error) {
        console.error("Authentication error:", error);
        setError("Authentication failed");
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetchData();
  }, [router]);

  const fetchLessons = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const data = await adminService.getAdminLessons();
      setLessons(data);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      setError("Failed to fetch lessons");
    }
  };

  const fetchSections = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const data = await adminService.getAdminSections();
      setSections(data);
    } catch (error) {
      console.error("Error fetching sections:", error);
      setError("Failed to fetch sections");
    }
  };

  const fetchGroupedSections = async () => {
    try {
      const adminService = LearningAdminService.getInstance();
      const groupedSections = await adminService.getAdminGroupedSections();
      setGroupedData(groupedSections);
      
      
      // Set first campaign as active tab
      if (groupedSections.campaigns.length > 0 && activeCampaignTab === null) {
        setActiveCampaignTab(groupedSections.campaigns[0].id || 'general');
      }
    } catch (error) {
      console.error("Error fetching grouped sections:", error);
    }
  };

  const handleDeleteLesson = async (id: number) => {
    if (!confirm("Are you sure you want to delete this lesson?")) return;
    
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.deleteLesson(id);
      await fetchLessons();
    } catch (error) {
      console.error("Error deleting lesson:", error);
      setError("Failed to delete lesson");
    }
  };

  const handleDuplicateLesson = async (id: number) => {
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.duplicateLesson(id);
      await fetchLessons();
    } catch (error) {
      console.error("Error duplicating lesson:", error);
      setError("Failed to duplicate lesson");
    }
  };

  const handleUnpublish = async (l: LearningLesson) => {
    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.updateLesson(l.id, { is_active: false });
      await fetchLessons();
      setSelectedLesson(null);
    } catch (err) {
      console.error("Error unpublishing lesson:", err);
      setError("Kunne ikke avpublisere");
    }
  };

  const handleBulkOperation = async (operation: string) => {
    if (selectedLessons.length === 0) {
      alert("Please select lessons first");
      return;
    }

    try {
      const adminService = LearningAdminService.getInstance();
      await adminService.bulkOperations(operation, selectedLessons, 'lessons');
      setSelectedLessons([]);
      await fetchLessons();
    } catch (error) {
      console.error("Error performing bulk operation:", error);
      setError("Failed to perform bulk operation");
    }
  };

  const getLessonTypeIcon = (kind: string) => {
    switch (kind) {
      case "TEXT":
        return <FileText className="w-4 h-4" />;
      case "VIDEO":
        return <Video className="w-4 h-4" />;
      case "QUIZ":
        return <HelpCircle className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getLessonTypeColor = (kind: string) => {
    switch (kind) {
      case "TEXT":
        return "bg-blue-100 text-blue-800";
      case "VIDEO":
        return "bg-purple-100 text-purple-800";
      case "QUIZ":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return <LoadingState message="Loading lessons..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load lessons"
        message={error}
        onGoHome={() => router.push("/admin-dashboard-learning")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {isMobile ? (
        <MobileHeader
          title="Leksjoner"
          userData={null}
          onLogout={() => {}}
          onBack={() => router.push("/admin-dashboard-learning")}
          showBack={true}
        />
      ) : (
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/admin-dashboard-learning" prefetch={true}>
              <Button variant="ghost" size="sm" className="flex items-center gap-2 text-slate-600 hover:text-slate-900">
                <ArrowLeft className="h-4 w-4" />
                Tilbake til oversikt
              </Button>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900">Leksjoner</h1>
              <p className="text-sm text-slate-500">Administrer leksjoner og innhold</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setLessonModalId(null);
              setLessonModalPreselectedSectionId(undefined);
              setLessonModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Opprett leksjon
          </Button>
        </header>
      )}

      {/* Mobile Create Button */}
      {isMobile && (
        <div>
          <Button
            onClick={() => {
              setLessonModalId(null);
              setLessonModalPreselectedSectionId(undefined);
              setLessonModalOpen(true);
            }}
            className="w-full h-12 min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Opprett ny leksjon
          </Button>
        </div>
      )}

      <div className={cn(
        "mx-auto flex gap-6",
        isMobile ? "px-4 py-4 flex-col" : "max-w-7xl px-6 py-6"
      )}>
        <div className="flex-1 min-w-0">
        {/* Bulk Actions */}
        {selectedLessons.length > 0 && (
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
                  {selectedLessons.length} lesson{selectedLessons.length !== 1 ? 's' : ''} selected
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
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size={isMobile ? "default" : "sm"}
                    onClick={() => handleBulkOperation("deactivate")}
                    className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                  >
                    Deactivate
                  </Button>
                  <Button
                    variant="destructive"
                    size={isMobile ? "default" : "sm"}
                    onClick={() => handleBulkOperation("delete")}
                    className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Tabs */}
        {groupedData && groupedData.campaigns.length > 0 && (
          <div className={cn("mb-6", isMobile && "mb-4")}>
            <div className="border-b border-gray-200">
              <nav
                className={cn(
                  "-mb-px flex overflow-x-auto",
                  isMobile
                    ? "space-x-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                    : "space-x-8"
                )}
                aria-label="Campaigns"
              >
                {groupedData.campaigns.map((campaign) => {
                  const campaignKey = campaign.id || 'general';
                  const isActive = activeCampaignTab === campaignKey;
                  
                  // Count lessons in this campaign
                  const campaignLessons = lessons.filter(lesson => {
                    const section = sections.find(s => s.id === lesson.section);
                    if (!section) return false;
                    const sectionCampaignId = section.campaign_id || section.campaign || null;
                    const normalizedSectionCampaign = sectionCampaignId || 'general';
                    const campaignMatch = normalizedSectionCampaign === campaignKey;
                    const sectionMatch = !activeSectionFilter || lesson.section.toString() === activeSectionFilter;
                    return campaignMatch && sectionMatch;
                  });
                  
                  return (
                    <button
                      key={campaignKey}
                      onClick={() => {
                        setActiveCampaignTab(campaignKey);
                        setActiveSectionFilter(null);
                      }}
                      className={cn(
                        'whitespace-nowrap border-b-2 font-medium transition-colors flex-shrink-0',
                        isMobile ? 'py-3 px-2 text-sm min-w-[120px]' : 'py-4 px-1 text-sm',
                        isActive
                          ? 'border-emerald-600 text-emerald-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span>{campaign.is_general ? '📚' : '🎯'}</span>
                        <span className={cn(isMobile && "truncate")}>{campaign.name}</span>
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className={cn(
                            "ml-1 flex-shrink-0",
                            isMobile && "text-[10px] px-1.5 py-0"
                          )}
                        >
                          {campaignLessons.length}
                        </Badge>
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Section Filter */}
        {groupedData && activeCampaignTab && (() => {
          const activeCampaign = groupedData.campaigns.find(
            c => (c.id || 'general') === activeCampaignTab
          );
          
          if (activeCampaign && activeCampaign.sections.length > 0) {
            return (
              <div className={cn("mb-6", isMobile && "mb-4")}>
                <div className={cn(
                  "flex items-center gap-4",
                  isMobile ? "flex-col gap-3 items-stretch" : "flex-row"
                )}>
                  <label className={cn(
                    "font-medium text-gray-700",
                    isMobile ? "text-sm" : "text-sm"
                  )}>
                    Filter by section:
                  </label>
                  <div className={cn("flex-1", isMobile && "w-full")}>
                    <MobileSelect
                      value={activeSectionFilter || 'all'}
                      onValueChange={(value) => {
                        setActiveSectionFilter(value === 'all' ? null : value);
                      }}
                      placeholder="Select section"
                      options={[
                        { value: 'all', label: 'All sections' },
                        ...activeCampaign.sections.map((section) => ({
                          value: section.id.toString(),
                          label: section.title
                        }))
                      ]}
                    />
                  </div>
                  {activeSectionFilter && (
                    <Button
                      variant="outline"
                      size={isMobile ? "default" : "sm"}
                      onClick={() => setActiveSectionFilter(null)}
                      className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                    >
                      Clear filter
                    </Button>
                  )}
                </div>
              </div>
            );
          }
          return null;
        })()}


        {/* Campaign Progress Summary */}
        {groupedData && activeCampaignTab && (() => {
          const activeCampaign = groupedData.campaigns.find(
            c => (c.id || 'general') === activeCampaignTab
          );
          
          if (activeCampaign) {
            const campaignLessons = lessons.filter(lesson => {
              const section = sections.find(s => s.id === lesson.section);
              if (!section) return false;
              const sectionCampaignId = section.campaign_id || section.campaign || null;
              const normalizedSectionCampaign = sectionCampaignId || 'general';
              const campaignMatch = normalizedSectionCampaign === activeCampaignTab;
              const sectionMatch = !activeSectionFilter || lesson.section.toString() === activeSectionFilter;
              return campaignMatch && sectionMatch;
            });
            
            const activeLessons = campaignLessons.filter(lesson => lesson.is_active);
            const inactiveLessons = campaignLessons.filter(lesson => !lesson.is_active);
            
            return (
              <div className={cn(
                "mb-6 bg-white border border-slate-200 rounded-xl shadow-sm",
                isMobile ? "p-3" : "p-4"
              )}>
                <h3 className={cn("font-semibold text-slate-900 mb-3 flex items-center gap-2", isMobile ? "text-base" : "")}>
                  {activeCampaign.is_general ? '📚' : '🎯'} {activeCampaign.name} – oversikt
                </h3>
                <div className={cn("grid gap-4 text-sm", isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4")}>
                  <div className="text-center">
                    <div className={cn("font-bold text-emerald-600", isMobile ? "text-xl" : "text-2xl")}>{campaignLessons.length}</div>
                    <div className={cn("text-slate-500", isMobile ? "text-[10px]" : "text-xs")}>Leksjoner</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("font-bold text-slate-800", isMobile ? "text-xl" : "text-2xl")}>{activeLessons.length}</div>
                    <div className={cn("text-slate-500", isMobile ? "text-[10px]" : "text-xs")}>Aktive</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("font-bold text-slate-600", isMobile ? "text-xl" : "text-2xl")}>{inactiveLessons.length}</div>
                    <div className={cn("text-slate-500", isMobile ? "text-[10px]" : "text-xs")}>Inaktive</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("font-bold text-slate-800", isMobile ? "text-xl" : "text-2xl")}>{activeCampaign.sections.length}</div>
                    <div className={cn("text-slate-500", isMobile ? "text-[10px]" : "text-xs")}>Seksjoner</div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Lessons Grid */}
        <div className={cn(
          "grid gap-4",
          isMobile ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-3 gap-6"
        )}>
          {(() => {
            // Filter lessons by active campaign and section
            const campaignLessons = lessons.filter(lesson => {
              const section = sections.find(s => s.id === lesson.section);
              if (!section) return false;
              
              // If no campaign is selected, show all lessons
              if (!activeCampaignTab) return true;
              
              // Handle campaign matching - both campaign and campaign_id should work
              const sectionCampaignId = section.campaign_id || section.campaign || null;
              const normalizedSectionCampaign = sectionCampaignId || 'general';
              const normalizedActiveCampaign = activeCampaignTab || 'general';
              
              const campaignMatch = normalizedSectionCampaign === normalizedActiveCampaign;
              
              // If section filter is active, also filter by section
              const sectionMatch = !activeSectionFilter || lesson.section.toString() === activeSectionFilter;
              
              
              return campaignMatch && sectionMatch;
            });
            
            
            return campaignLessons.map((lesson) => (
            <Card key={lesson.id} className={cn(
              "relative border-slate-200 rounded-xl shadow-sm hover:shadow transition-shadow",
              isMobile && "min-h-[160px]"
            )}>
              <CardHeader className={cn(isMobile ? "p-4" : "")}>
                <div className={cn(
                  "flex items-start justify-between",
                  isMobile ? "flex-col gap-3" : "flex-row"
                )}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "rounded-lg bg-gray-100 flex-shrink-0",
                      isMobile ? "p-1.5" : "p-2"
                    )}>
                      {getLessonTypeIcon(lesson.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className={cn(
                        "truncate",
                        isMobile ? "text-base" : "text-lg"
                      )}>
                        {lesson.title}
                      </CardTitle>
                      <CardDescription className={cn(
                        isMobile ? "text-xs" : "text-sm"
                      )}>
                        Order: {lesson.order} • {lesson.duration_estimate_minutes} min
                      </CardDescription>
                    </div>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1",
                    isMobile && "w-full justify-between pt-2 border-t"
                  )}>
                    <input
                      type="checkbox"
                      checked={selectedLessons.includes(lesson.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedLessons([...selectedLessons, lesson.id]);
                        } else {
                          setSelectedLessons(selectedLessons.filter(id => id !== lesson.id));
                        }
                      }}
                      className={cn(
                        "cursor-pointer",
                        isMobile && "h-5 w-5"
                      )}
                      aria-label="Select lesson"
                    />
                    <MobileActionMenu
                      actions={[
                        CommonActions.view(() => setSelectedLesson(lesson)),
                        CommonActions.edit(() => {
                          setLessonModalId(lesson.id);
                          setLessonModalPreselectedSectionId(undefined);
                          setLessonModalOpen(true);
                        }),
                        CommonActions.duplicate(() => handleDuplicateLesson(lesson.id)),
                        CommonActions.delete(() => handleDeleteLesson(lesson.id))
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
                  {lesson.description}
                </p>
                <div className={cn(
                  "flex items-center gap-2 mb-3 flex-wrap",
                  isMobile && "gap-1.5"
                )}>
                  <Badge className={cn(
                    getLessonTypeColor(lesson.kind),
                    isMobile && "text-[10px] px-1.5 py-0"
                  )}>
                    {lesson.kind}
                  </Badge>
                  <Badge
                    variant={lesson.is_active ? "default" : "secondary"}
                    className={cn(isMobile && "text-[10px] px-1.5 py-0")}
                  >
                    {lesson.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {lesson.kind === "QUIZ" && (
                    <Badge
                      variant="outline"
                      className={cn(isMobile && "text-[10px] px-1.5 py-0")}
                    >
                      Pass: {(lesson as any).pass_threshold_percent || 80}%
                    </Badge>
                  )}
                </div>
                <div className={cn(
                  "text-gray-500 space-y-1",
                  isMobile ? "text-[10px]" : "text-xs"
                )}>
                  <div>
                    Section: {sections.find(s => s.id === lesson.section)?.title || "Unknown"}
                  </div>
                  <div>
                    {(() => {
                      const section = sections.find(s => s.id === lesson.section);
                      const campaignName = section?.campaign_name || "General Training";
                      return `Campaign: ${campaignName}`;
                    })()}
                  </div>
                  <div>
                    {new Date(lesson.created_at).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
            ));
          })()}
        </div>

        {/* Empty State */}
        {(() => {
          const campaignLessons = lessons.filter(lesson => {
            const section = sections.find(s => s.id === lesson.section);
            if (!section) return false;
            const sectionCampaignId = section.campaign_id || section.campaign || null;
            const normalizedSectionCampaign = sectionCampaignId || 'general';
            const campaignMatch = normalizedSectionCampaign === activeCampaignTab;
            const sectionMatch = !activeSectionFilter || lesson.section.toString() === activeSectionFilter;
            return campaignMatch && sectionMatch;
          });
          
          if (campaignLessons.length === 0) {
            const activeCampaign = groupedData?.campaigns.find(
              c => (c.id || 'general') === activeCampaignTab
            );
            
            return (
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
                    No lessons in {activeCampaign?.name || 'selected campaign'}
                  </h3>
                  <p className={cn(
                    "text-gray-600 mb-4",
                    isMobile ? "text-sm" : ""
                  )}>
                    There are no lessons in this campaign yet. Create your first lesson to get started.
                  </p>
                  <Button
                    onClick={() => {
                      setLessonModalId(null);
                      setLessonModalPreselectedSectionId(undefined);
                      setLessonModalOpen(true);
                    }}
                    className={cn(isMobile && "w-full h-12 min-h-[44px]")}
                  >
                    <Plus className={cn("mr-2", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                    Opprett leksjon
                  </Button>
                </CardContent>
              </Card>
            );
          }
          return null;
        })()}
        </div>

        {/* Høyre: Forhåndsvisning (desktop) */}
        {!isMobile && (
          <aside className="w-[380px] flex-shrink-0">
            {selectedLesson ? (
              <LessonPreviewPanel
                lesson={selectedLesson}
                section={sections.find((s) => s.id === selectedLesson.section)}
                onClose={() => setSelectedLesson(null)}
                onUnpublish={handleUnpublish}
                onDelete={(l) => {
                  handleDeleteLesson(l.id);
                  setSelectedLesson(null);
                }}
                onAdministrer={(l) => {
                  setLessonModalId(l.id);
                  setLessonModalPreselectedSectionId(undefined);
                  setLessonModalOpen(true);
                  setSelectedLesson(null);
                }}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm text-slate-500">
                Velg en leksjon for forhåndsvisning
              </div>
            )}
          </aside>
        )}
      </div>

      <LessonEditorModal
        open={lessonModalOpen}
        onOpenChange={setLessonModalOpen}
        lessonId={lessonModalId}
        preselectedSectionId={lessonModalPreselectedSectionId}
        onSaved={fetchLessons}
      />
    </div>
  );
};

export default LessonManagement;
