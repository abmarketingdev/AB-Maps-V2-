"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import { FileText, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import type { LearningSection, LearningSectionCreate, GroupedSectionsResponse } from "@/services/learningTypes";

const defaultForm: LearningSectionCreate = {
  campaign: null,
  title: "",
  slug: "",
  description: "",
  order: 1,
  is_active: true,
  duration_estimate_minutes: 30,
  icon_emoji: "📚",
  icon_color: "bg-blue-500",
};

function Badge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Aktiv
    </span>
  );
}

export interface SectionEditorContentProps {
  sectionId: number | null;
  onSuccess?: (action: "created" | "published", newId?: number) => void;
  onSelectSection?: (id: number | null) => void;
  onClose?: () => void;
}

export function SectionEditorContent({
  sectionId,
  onSuccess,
  onSelectSection,
  onClose,
}: SectionEditorContentProps) {
  const router = useRouter();
  const isNew = sectionId === null;

  const [section, setSection] = useState<LearningSection | null>(null);
  const [grouped, setGrouped] = useState<GroupedSectionsResponse | null>(null);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<LearningSectionCreate>({ ...defaultForm });

  const fetchCampaigns = useCallback(async () => {
    try {
      const tokens = localStorage.getItem("auth_tokens");
      if (!tokens) return;
      const { access } = JSON.parse(tokens);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/campaigns/campaigns/`, {
        headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.results || data).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
      setCampaigns(list);
    } catch {
      // non-critical
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = LearningAuthService.getInstance();
      const [ok, isSuper] = await Promise.all([
        auth.isAuthenticated(),
        auth.checkSuperuser().catch(() => false),
      ]);
      if (!ok) {
        router.push("/learning-platform/login");
        return;
      }
      if (!isSuper) {
        router.push("/learning-dashboard");
        return;
      }
      await fetchCampaigns();
      const admin = LearningAdminService.getInstance();
      const [grp] = await Promise.all([admin.getAdminGroupedSections().catch(() => null)]);
      setGrouped(grp || null);

      if (isNew) {
        setForm({ ...defaultForm });
        setSection(null);
        return;
      }
      if (sectionId == null) return;
      const s = await admin.getAdminSection(sectionId);
      setSection(s);
      setForm({
        campaign: s.campaign ?? s.campaign_id ?? null,
        title: s.title,
        slug: s.slug || "",
        description: s.description || "",
        order: s.order,
        is_active: s.is_active,
        duration_estimate_minutes: s.duration_estimate_minutes,
        icon_emoji: s.icon_emoji || "📚",
        icon_color: s.icon_color || "bg-blue-500",
      });
      setExpandedCampaigns((prev) => new Set([...prev, String(s.campaign ?? s.campaign_id ?? "null")]));
    } catch (e) {
      console.error(e);
      setError(isNew ? "Kunne ikke laste data" : "Kunne ikke laste seksjon");
    } finally {
      setLoading(false);
    }
  }, [sectionId, isNew, router, fetchCampaigns]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCampaign = (cid: string) => {
    setExpandedCampaigns((p) => {
      const n = new Set(p);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      const admin = LearningAdminService.getInstance();
      const slug =
        form.slug ||
        form.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();
      const payload: Record<string, unknown> = { ...form, slug: slug || "section-" + Date.now() };
      if (payload.campaign == null) delete payload.campaign;
      const created = await admin.createSection(payload as LearningSectionCreate);
      setSavedAt(new Date());
      onSuccess?.("created", created.id);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Kunne ikke opprette seksjon");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!section) return;
    setSaving(true);
    setError("");
    try {
      const admin = LearningAdminService.getInstance();
      const slug =
        form.slug ||
        form.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();
      const updated = await admin.updateSection(section.id, { ...form, slug: slug || section.slug });
      setSection(updated);
      setSavedAt(new Date());
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Kunne ikke lagre");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!section) return;
    setSaving(true);
    setError("");
    try {
      const admin = LearningAdminService.getInstance();
      const slug =
        form.slug ||
        form.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .trim();
      const updated = await admin.updateSection(section.id, {
        ...form,
        slug: slug || section.slug,
        is_active: true,
      });
      setSection(updated);
      setForm((f) => ({ ...f, is_active: true }));
      setSavedAt(new Date());
      onSuccess?.("published");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Kunne ikke publisere");
    } finally {
      setSaving(false);
    }
  };

  const currentCampaignName =
    grouped?.campaigns?.find((c) => String(c.id) === String(form.campaign ?? "null"))?.name ??
    (form.campaign ? campaigns.find((c) => c.id === form.campaign)?.name : "Generell opplæring");

  if (loading) return <LoadingState message="Laster..." />;

  if (error && !section && !isNew) {
    return (
      <ErrorState
        title="Kunne ikke laste seksjon"
        message={error}
        onGoHome={() => (onClose ? onClose() : router.push("/admin-dashboard-learning/sections"))}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Topp: Brødsmule, Sist lagret, Knapper – lik bildet */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#E0E0E0] bg-white px-4 py-3 pr-12">
        <div className="flex items-center gap-2 text-sm text-[#757575]">
          {onClose ? (
            <button type="button" onClick={onClose} className="hover:text-[#141414]">
              Innhold
            </button>
          ) : (
            <Link href="/admin-dashboard-learning/sections" className="hover:text-[#141414]">
              Innhold
            </Link>
          )}
          <span>/</span>
          <span className="font-medium text-[#141414]">
            {isNew ? "Ny seksjon" : form.title || section?.title || "Rediger seksjon"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-sm text-[#757575]">
              Sist lagret {savedAt.toLocaleTimeString("nb-NO", { minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          {isNew ? (
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={saving || !form.title?.trim()}
              className="bg-[#141414] text-white hover:bg-[#333]"
            >
              Opprett seksjon
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="border-[#E0E0E0]">
                Lagre utkast
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={saving}
                className="bg-[#141414] text-white hover:bg-[#333]"
              >
                Publiser endringer
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Venstre: COURSE STRUCTURE – som på bildet */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#E0E0E0] bg-white">
          <div className="border-b border-[#E0E0E0] px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#757575]">Kursstruktur</h2>
            <p className="mt-0.5 truncate text-sm font-medium text-[#141414]">{currentCampaignName}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {grouped?.campaigns?.map((camp) => {
              const cid = String(camp.id ?? "null");
              const expanded = expandedCampaigns.has(cid);
              return (
                <div key={cid}>
                  <button
                    type="button"
                    onClick={() => toggleCampaign(cid)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[#141414] hover:bg-[#f7f7f7]"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-[#757575]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-[#757575]" />
                    )}
                    <FileText className="h-4 w-4 shrink-0 text-[#757575]" />
                    <span className="truncate">{camp.name}</span>
                  </button>
                  {expanded &&
                    camp.sections.map((sec) => {
                      const isActive = !isNew && sec.id === sectionId;
                      return (
                        <div
                          key={sec.id}
                          className={cn(
                            "ml-6 flex items-center gap-2 rounded-md px-2 py-1.5",
                            isActive && "bg-[#141414] text-white"
                          )}
                        >
                          {onSelectSection ? (
                            <button
                              type="button"
                              onClick={() => onSelectSection(sec.id)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                            >
                              <span className="text-base">{sec.icon_emoji || "📚"}</span>
                              <span className="truncate">
                                {sec.order}. {sec.title}
                              </span>
                            </button>
                          ) : (
                            <Link
                              href={`/admin-dashboard-learning/sections/${sec.id}`}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                            >
                              <span className="text-base">{sec.icon_emoji || "📚"}</span>
                              <span className="truncate">
                                {sec.order}. {sec.title}
                              </span>
                            </Link>
                          )}
                          {!onSelectSection && (
                            <Link
                              href={`/admin-dashboard-learning/sections/${sec.id}`}
                              className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
                              aria-label="Rediger"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
          <div className="border-t border-[#E0E0E0] p-3">
            {onSelectSection ? (
              <button
                type="button"
                onClick={() => onSelectSection(null)}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors",
                  isNew ? "border-[#141414] bg-[#f7f7f7] text-[#141414]" : "border-[#E0E0E0] bg-white text-[#141414] hover:bg-[#f7f7f7]"
                )}
              >
                <span className="text-lg">+</span>
                Legg til seksjon
              </button>
            ) : (
              <Link
                href="/admin-dashboard-learning/sections/new"
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors",
                  isNew ? "border-[#141414] bg-[#f7f7f7] text-[#141414]" : "border-[#E0E0E0] bg-white text-[#141414] hover:bg-[#f7f7f7]"
                )}
              >
                <span className="text-lg">+</span>
                Legg til seksjon
              </Link>
            )}
          </div>
        </aside>

        {/* Midt: Skjema */}
        <main className="min-w-0 flex-1 overflow-y-auto border-r border-[#E0E0E0] bg-white p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#757575]">Kampanje</label>
              <Select
                value={form.campaign === null ? "null" : form.campaign || "null"}
                onValueChange={(v) => setForm((f) => ({ ...f, campaign: v === "null" ? null : v }))}
              >
                <SelectTrigger className="border-[#E0E0E0]">
                  <SelectValue placeholder="Velg kampanje" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">📚 Generell opplæring</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>🎯 {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-[#757575]">Generell opplæring for alle. Kampanjer kun for tildelte brukere.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#757575]">Tittel</label>
              <Input
                value={form.title || ""}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Seksjonstittel"
                className="border-[#E0E0E0] text-lg font-semibold focus-visible:ring-[#141414]/30"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#757575]">Slug (valgfri)</label>
                <Input
                  value={form.slug || ""}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="automatisk generert"
                  className="border-[#E0E0E0]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#757575]">Rekkefølge</label>
                <Input
                  type="number"
                  min={1}
                  value={form.order ?? 1}
                  onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value, 10) || 1 }))}
                  className="border-[#E0E0E0]"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#757575]">Beskrivelse</label>
              <Textarea
                value={form.description || ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Kort beskrivelse av seksjonen"
                rows={4}
                className="resize-y border-[#E0E0E0] focus-visible:ring-[#141414]/30"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#757575]">Varighet (min)</label>
                <Input
                  type="number"
                  min={1}
                  value={form.duration_estimate_minutes ?? 30}
                  onChange={(e) => setForm((f) => ({ ...f, duration_estimate_minutes: parseInt(e.target.value, 10) || 30 }))}
                  className="border-[#E0E0E0]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#757575]">Ikon (emoji)</label>
                <Input
                  value={form.icon_emoji || ""}
                  onChange={(e) => setForm((f) => ({ ...f, icon_emoji: e.target.value }))}
                  placeholder="📚"
                  className="border-[#E0E0E0]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#757575]">Ikonfarge</label>
                <Select
                  value={form.icon_color || "bg-blue-500"}
                  onValueChange={(v) => setForm((f) => ({ ...f, icon_color: v }))}
                >
                  <SelectTrigger className="border-[#E0E0E0]">
                    <SelectValue placeholder="Velg farge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bg-blue-500">Blå</SelectItem>
                    <SelectItem value="bg-green-500">Grønn</SelectItem>
                    <SelectItem value="bg-red-500">Rød</SelectItem>
                    <SelectItem value="bg-yellow-500">Gul</SelectItem>
                    <SelectItem value="bg-purple-500">Lilla</SelectItem>
                    <SelectItem value="bg-teal-500">Turkis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_active"
                checked={form.is_active ?? true}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: !!c }))}
              />
              <label htmlFor="is_active" className="text-sm font-medium text-[#141414] cursor-pointer">
                Aktiv (synlig for brukere)
              </label>
            </div>
          </div>
        </main>

        {/* Høyre: REAL-TIME PREVIEW – som på bildet */}
        <aside className="hidden w-[360px] shrink-0 flex-col border-[#E0E0E0] bg-[#fafafa] lg:flex">
          <div className="flex items-center justify-between border-b border-[#E0E0E0] bg-white px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#757575]">Sanntidsforhåndsvisning</h3>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> LIVE
            </span>
          </div>
          <div className="flex flex-1 flex-col items-center overflow-y-auto p-4">
            <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-[#1a1a1a] shadow-xl">
              <div className="border-b border-[#333] bg-[#222] px-3 py-2">
                <p className="truncate text-center text-[10px] text-[#999]">lms.company.com/course/{section?.id ?? "new"}</p>
              </div>
              <div className="bg-[#141414] p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-xl",
                      form.icon_color || "bg-blue-500"
                    )}
                  >
                    {form.icon_emoji || "📚"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate font-semibold text-white">{form.title || "Seksjonstittel"}</h4>
                    <p className="text-[10px] uppercase text-[#888]">
                      Rekkefølge {form.order ?? 1} • {form.duration_estimate_minutes ?? 30} min
                    </p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[#ccc]">
                  {form.description || "Beskrivelse vises her."}
                </p>
                <div className="mt-2">
                  <Badge show={form.is_active !== false} />
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-center rounded-lg bg-white py-2.5 text-sm font-semibold text-[#141414]">
                    Neste leksjon →
                  </div>
                </div>
              </div>
            </div>
            {!isNew && section && (
              <Link
                href={`/learning-platform/${section.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#141414] hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span>
                Forhåndsvis hele reisen
              </Link>
            )}
            <p className="mt-4 text-center text-xs text-[#757575]">Forhåndsvisningen oppdateres automatisk.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
