"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { LearningAdminService } from "@/services/learningAdminService";
import type { LearningStats, ActivityItem } from "@/services/learningTypes";

export default function AdminLearningDashboard() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const admin = LearningAdminService.getInstance();
      // Get everything: metrics + content status + recent activity
      const o = await admin.getOverviewStats({
        include_content_status: true,
        include_recent_activity: true,
        activity_limit: 20, // Get up to 20 recent activities
      });
      setStats(o);
    } catch (e) {
      console.error("getOverviewStats", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case "SECTION_COMPLETED":
        return "verified";
      case "LESSON_STARTED":
        return "map";
      case "QUIZ_SUBMITTED":
        return "quiz";
      case "LESSON_COMPLETED":
        return "check_circle";
      case "SYSTEM_ALERT":
        return "warning";
      case "USER_REGISTERED":
        return "person_add";
      default:
        return "info";
    }
  };

  const getEventIconColor = (event: string) => {
    switch (event) {
      case "SECTION_COMPLETED":
      case "LESSON_COMPLETED":
        return "bg-[#141414]/10 text-[#141414]";
      case "LESSON_STARTED":
      case "QUIZ_SUBMITTED":
        return "bg-[#757575]/10 text-[#757575]";
      case "SYSTEM_ALERT":
        return "bg-[#141414]/5 text-[#141414]";
      case "USER_REGISTERED":
        return "bg-[#757575]/10 text-[#757575]";
      default:
        return "bg-[#757575]/10 text-[#757575]";
    }
  };

  const formatActivityText = (activity: ActivityItem) => {
    const userName = activity.user.name;
    
    switch (activity.event) {
      case "SECTION_COMPLETED":
        const sectionTitle = activity.section?.title || "ukjent seksjon";
        return (
          <>
            <span className="font-semibold">{userName}</span> fullførte seksjon i{" "}
            <span className="font-semibold">{sectionTitle}</span>.
          </>
        );
      case "LESSON_STARTED":
        const lessonTitle = activity.lesson?.title || "ukjent leksjon";
        const sectionTitle2 = activity.section?.title || "ukjent seksjon";
        return (
          <>
            <span className="font-semibold">{userName}</span> startet{" "}
            <span className="font-semibold">{sectionTitle2}</span>.
          </>
        );
      case "QUIZ_SUBMITTED":
        const quizTitle = activity.lesson?.title || "ukjent quiz";
        const score = activity.metadata?.score_percent;
        const passed = activity.metadata?.passed;
        if (score !== undefined) {
          return (
            <>
              <span className="font-semibold">{userName}</span> fullførte quiz{" "}
              <span className="font-semibold">{quizTitle}</span> med {score}%{passed ? " (bestått)" : " (ikke bestått)"}.
            </>
          );
        }
        return (
          <>
            <span className="font-semibold">{userName}</span> fullførte quiz{" "}
            <span className="font-semibold">{quizTitle}</span>.
          </>
        );
      case "LESSON_COMPLETED":
        const lessonTitle2 = activity.lesson?.title || "ukjent leksjon";
        return (
          <>
            <span className="font-semibold">{userName}</span> fullførte leksjon{" "}
            <span className="font-semibold">{lessonTitle2}</span>.
          </>
        );
      case "SYSTEM_ALERT":
        return (
          <>
            <span className="font-semibold">Systemvarsel:</span> {activity.metadata?.message || "Systemvarsel oppstod"}.
          </>
        );
      case "USER_REGISTERED":
        return (
          <>
            <span className="font-semibold">Ny brukerregistrering:</span> {activity.metadata?.count || 1} bruker{activity.metadata?.count !== 1 ? "e" : ""} lagt til.
          </>
        );
      default:
        return (
          <>
            <span className="font-semibold">{userName}</span> {activity.event_display.toLowerCase()}.
          </>
        );
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Tittel og periode */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#141414]">Oversikt</h2>
          <p className="mt-1 text-[#757575]">Spor læringsaktivitet og fremdrift på plattformen.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[#E0E0E0] bg-white px-3 py-1.5 text-sm font-medium text-[#757575] shadow-sm">
          <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          <span>24. okt 2024 - I dag</span>
        </div>
      </div>

      {/* 4 stat-kort */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="group flex h-32 cursor-default flex-col justify-between rounded-lg border border-[#E0E0E0] bg-white p-5 transition-colors hover:border-[#141414]/30">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-[#757575]">Registrerte brukere</p>
            <span className="material-symbols-outlined text-[20px] text-[#757575] transition-colors group-hover:text-[#141414]">school</span>
          </div>
          <div>
            {loading ? (
              <span className="text-3xl font-bold text-[#141414]">—</span>
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#141414]">{stats?.total_users ?? 0}</p>
            )}
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-[#757575]">registrert på læringsplattformen</span>
            </div>
          </div>
        </div>

        <div className="group flex h-32 cursor-default flex-col justify-between rounded-lg border border-[#E0E0E0] bg-white p-5 transition-colors hover:border-[#141414]/30">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-[#757575]">Aktive i læring</p>
            <span className="material-symbols-outlined text-[20px] text-[#757575] transition-colors group-hover:text-[#141414]">play_circle</span>
          </div>
          <div>
            {loading ? (
              <span className="text-3xl font-bold text-[#141414]">—</span>
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#141414]">{stats?.active_employees_of_total ?? "0/0"}</p>
            )}
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-[#757575]">i aktiv læring nå</span>
            </div>
          </div>
        </div>

        <div className="group flex h-32 cursor-default flex-col justify-between rounded-lg border border-[#E0E0E0] bg-white p-5 transition-colors hover:border-[#141414]/30">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-[#757575]">Fullføringsrate</p>
            <span className="material-symbols-outlined text-[20px] text-[#757575] transition-colors group-hover:text-[#141414]">verified</span>
          </div>
          <div>
            {loading ? (
              <span className="text-3xl font-bold text-[#141414]">—</span>
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#141414]">{stats?.completion_rate_percent ?? 0}%</p>
            )}
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-[#757575]">fullførte kurs i gjennomsnitt</span>
            </div>
          </div>
        </div>

        <div className="group flex h-32 cursor-default flex-col justify-between rounded-lg border border-[#E0E0E0] bg-white p-5 transition-colors hover:border-[#141414]/30">
          <div className="flex items-start justify-between">
            <p className="text-sm font-medium text-[#757575]">Ikke startet</p>
            <span className="material-symbols-outlined text-[20px] text-[#757575] transition-colors group-hover:text-[#141414]">schedule</span>
          </div>
          <div>
            {loading ? (
              <span className="text-3xl font-bold text-[#141414]">—</span>
            ) : (
              <p className="text-3xl font-bold tracking-tight text-[#141414]">{stats?.never_started_employees ?? 0}</p>
            )}
            <div className="mt-1 flex items-center gap-1">
              <span className="text-xs text-[#757575]">brukere som ikke har startet</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Venstre: Innholdsstatus + Nylig aktivitet */}
        <div className="space-y-6 lg:col-span-2">
          {/* Innholdsstatus */}
          <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
            <div className="flex items-center justify-between border-b border-[#E0E0E0] bg-gray-50/50 px-6 py-4">
              <h3 className="text-base font-bold text-[#141414]">Innholdsstatus</h3>
              <Link href="/admin-dashboard-learning/sections" className="text-xs font-medium text-[#141414] hover:underline">
                Se alt innhold
              </Link>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border border-[#E0E0E0] bg-[#f7f7f7]/50 p-3">
                  <div className="shrink-0 rounded border border-[#E0E0E0] bg-white p-2">
                    <span className="material-symbols-outlined text-[20px] text-[#141414]">edit_document</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#141414]">
                      {loading ? "—" : stats?.content_status?.drafts_pending?.count ?? 0}
                    </p>
                    <p className="text-xs font-medium text-[#757575]">Utkast venter</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#E0E0E0] bg-[#f7f7f7]/50 p-3">
                  <div className="shrink-0 rounded border border-[#E0E0E0] bg-white p-2">
                    <span className="material-symbols-outlined text-[20px] text-[#141414]">videocam_off</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#141414]">
                      {loading ? "—" : stats?.content_status?.missing_media?.count ?? 0}
                    </p>
                    <p className="text-xs font-medium text-[#757575]">Mangler media</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-[#E0E0E0] bg-[#f7f7f7]/50 p-3">
                  <div className="shrink-0 rounded border border-[#E0E0E0] bg-white p-2">
                    <span className="material-symbols-outlined text-[20px] text-[#141414]">quiz</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[#141414]">
                      {loading ? "—" : stats?.content_status?.low_questions?.count ?? 0}
                    </p>
                    <p className="text-xs font-medium text-[#757575]">Lavt antall spørsmål</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nylig aktivitet */}
          <div className="overflow-hidden rounded-lg border border-[#E0E0E0] bg-white">
            <div className="flex items-center justify-between border-b border-[#E0E0E0] bg-gray-50/50 px-6 py-4">
              <h3 className="text-base font-bold text-[#141414]">Nylig aktivitet</h3>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="rounded p-1 text-[#757575] transition-colors hover:bg-[#f7f7f7] hover:text-[#141414] disabled:opacity-50"
                aria-label="Oppdater aktivitet"
              >
                <span className={`material-symbols-outlined text-[20px] ${refreshing ? 'animate-spin' : ''}`}>
                  refresh
                </span>
              </button>
            </div>
            {loading ? (
              <div className="p-6 text-center text-[#757575]">
                <span className="text-sm">Laster aktivitet...</span>
              </div>
            ) : stats?.recent_activity?.activities && stats.recent_activity.activities.length > 0 ? (
              <>
                <div className="divide-y divide-[#E0E0E0]">
                  {stats.recent_activity.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-[#f7f7f7]/50"
                    >
                      <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${getEventIconColor(activity.event)}`}>
                        <span className="material-symbols-outlined text-[18px]">
                          {getEventIcon(activity.event)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-[#141414]">{formatActivityText(activity)}</p>
                        <p className="mt-1 text-xs text-[#757575]">{activity.time_ago}</p>
                      </div>
                      {(activity.event === "SECTION_COMPLETED" || activity.event === "SYSTEM_ALERT") && (
                        <button
                          type="button"
                          className="shrink-0 rounded border border-[#E0E0E0] bg-white px-2 py-1 text-xs transition-colors hover:bg-gray-50"
                          onClick={() => {
                            // TODO: Navigate to details page
                            console.log("View details for activity:", activity.id);
                          }}
                        >
                          {activity.event === "SYSTEM_ALERT" ? "Gjennomgå" : "Detaljer"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {stats.recent_activity.count > stats.recent_activity.activities.length && (
                  <div className="border-t border-[#E0E0E0] bg-gray-50/50 px-6 py-3 text-center">
                    <Link
                      href="/admin-dashboard-learning/analytics"
                      className="text-xs font-semibold uppercase tracking-wide text-[#141414] hover:text-[#757575]"
                    >
                      Se hele loggen ({stats.recent_activity.count} aktiviteter)
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 text-center text-[#757575]">
                <span className="text-sm">Ingen nylig aktivitet</span>
              </div>
            )}
          </div>
        </div>

        {/* Høyre: Hurtighandlinger + Systemkapasitet */}
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-lg bg-[#141414] p-6 text-white shadow-lg">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 transition-transform duration-500 group-hover:scale-110" />
            <h3 className="relative z-10 mb-4 text-lg font-bold">Hurtighandlinger</h3>
            <div className="relative z-10 space-y-3">
              <Link
                href="/admin-dashboard-learning/courses/create"
                className="flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#141414] shadow-sm transition-colors hover:bg-gray-100"
              >
                <span>Innhold / Seksjoner</span>
                <span className="material-symbols-outlined text-[18px]">folder_open</span>
              </Link>
              <Link
                href="/admin-dashboard-learning/courses/create"
                className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                <span>Leksjoner</span>
                <span className="material-symbols-outlined text-[18px]">edit_document</span>
              </Link>
              <Link
                href="/admin-dashboard-learning/courses/create"
                className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                <span>Quizzer</span>
                <span className="material-symbols-outlined text-[18px]">quiz</span>
              </Link>
              <Link
                href="/admin-dashboard-learning/users"
                className="flex w-full items-center justify-between rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/20"
              >
                <span>Brukere</span>
                <span className="material-symbols-outlined text-[18px]">group</span>
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-[#E0E0E0] bg-white p-6">
            <h3 className="mb-4 text-sm font-bold text-[#141414]">Systemkapasitet</h3>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium text-[#757575]">Lagring brukt</span>
                  <span className="font-bold text-[#141414]">45%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#f7f7f7]">
                  <div className="h-1.5 rounded-full bg-[#141414]" style={{ width: "45%" }} />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium text-[#757575]">Månedlige API-kall</span>
                  <span className="font-bold text-[#141414]">72%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#f7f7f7]">
                  <div className="h-1.5 rounded-full bg-[#757575]" style={{ width: "72%" }} />
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs">
                  <span className="font-medium text-[#757575]">Aktive økter</span>
                  <span className="font-bold text-[#141414]">24%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#f7f7f7]">
                  <div className="h-1.5 rounded-full bg-[#141414]/40" style={{ width: "24%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
