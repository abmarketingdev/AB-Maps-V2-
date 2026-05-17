"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LearningAuthService } from "@/services/learningAuthService";
import { LearningAdminService } from "@/services/learningAdminService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import LoadingState from "@/components/learning/LoadingState";
import ErrorState from "@/components/learning/ErrorState";
import {
  FileText,
  Video,
  HelpCircle,
  GripVertical,
  Pencil,
  Play,
  ChevronDown,
  ChevronRight,
  Link2,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
} from "lucide-react";
import type { LearningLesson, LearningLessonCreate, LearningSection } from "@/services/learningTypes";
import type { GroupedSectionsResponse } from "@/services/learningTypes";

function getLessonIcon(kind: string) {
  switch (kind) {
    case "VIDEO": return <Video className="h-4 w-4 shrink-0" />;
    case "QUIZ": return <HelpCircle className="h-4 w-4 shrink-0" />;
    default: return <FileText className="h-4 w-4 shrink-0" />;
  }
}

const defaultForm: Partial<LearningLessonCreate> = {
  title: "",
  description: "",
  content: "",
  kind: "TEXT",
  content_url: "",
  order: 1,
  is_active: true,
  section: 0,
  duration_estimate_minutes: 10,
  pass_threshold_percent: 80,
};

export interface LessonEditorContentProps {
  lessonId: number | null;
  preselectedSectionId?: number;
  onSuccess?: (action: "created" | "published", newId?: number) => void;
  onSelectLesson?: (id: number | null, sectionId?: number) => void;
  onClose?: () => void;
}

export function LessonEditorContent({
  lessonId,
  preselectedSectionId,
  onSuccess,
  onSelectLesson,
  onClose,
}: LessonEditorContentProps) {
  const router = useRouter();
  const isNew = lessonId === null;

  const [lesson, setLesson] = useState<LearningLesson | null>(null);
  const [sections, setSections] = useState<LearningSection[]>([]);
  const [allLessons, setAllLessons] = useState<LearningLesson[]>([]);
  const [grouped, setGrouped] = useState<GroupedSectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [previewRole, setPreviewRole] = useState<"ansatt" | "leder">("ansatt");
  const [requiredCompletion, setRequiredCompletion] = useState(true);
  const [downloadableResources, setDownloadableResources] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const [form, setForm] = useState<Partial<LearningLessonCreate>>({ ...defaultForm });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = LearningAuthService.getInstance();
      const [ok, isSuper] = await Promise.all([
        auth.isAuthenticated(),
        auth.checkSuperuser().catch(() => false),
      ]);
      if (!ok) { router.push("/learning-platform/login"); return; }
      if (!isSuper) { router.push("/learning-dashboard"); return; }
      const admin = LearningAdminService.getInstance();

      if (isNew) {
        const [secs, lessons, grp] = await Promise.all([
          admin.getAdminSections(),
          admin.getAdminLessons(),
          admin.getAdminGroupedSections().catch(() => null),
        ]);
        setSections(secs);
        setAllLessons(lessons);
        setGrouped(grp || null);
        const sectionId = (preselectedSectionId != null && secs.some((s) => s.id === preselectedSectionId))
          ? preselectedSectionId
          : secs[0]?.id ?? 0;
        const nextOrder = Math.max(0, ...lessons.filter((l) => l.section === sectionId).map((l) => l.order)) + 1;
        setForm({ ...defaultForm, section: sectionId, order: nextOrder });
        setLesson(null);
        setExpandedSections(new Set(sectionId ? [sectionId] : []));
        return;
      }
      if (lessonId == null) return;
      const [l, secs, lessons, grp] = await Promise.all([
        admin.getAdminLesson(lessonId),
        admin.getAdminSections(),
        admin.getAdminLessons(),
        admin.getAdminGroupedSections().catch(() => null),
      ]);
      setLesson(l);
      setSections(secs);
      setAllLessons(lessons);
      setGrouped(grp || null);
      setForm({
        title: l.title,
        description: l.description || "",
        content: l.content || "",
        kind: l.kind,
        content_url: (l as any).content_url || "",
        order: l.order,
        is_active: l.is_active,
        section: l.section,
        duration_estimate_minutes: l.duration_estimate_minutes,
        pass_threshold_percent: (l as any).pass_threshold_percent ?? 80,
      });
      setExpandedSections((p) => new Set([...p, l.section]));
    } catch (e) {
      console.error(e);
      setError(isNew ? "Kunne ikke laste data" : "Kunne ikke laste leksjon");
    } finally {
      setLoading(false);
    }
  }, [lessonId, isNew, preselectedSectionId, router]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    if (!form.section || !sections.some((s) => s.id === form.section)) {
      setError("Velg en seksjon.");
      setSaving(false);
      return;
    }
    try {
      const admin = LearningAdminService.getInstance();
      // Generate base slug from title, append timestamp to ensure uniqueness within section
      const baseSlug = form.title?.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").trim() || "lesson";
      const slug = `${baseSlug}-${Date.now()}`;
      const nextOrder = Math.max(0, ...allLessons.filter((l) => l.section === form.section).map((l) => l.order)) + 1;
      const payload: LearningLessonCreate = {
        title: form.title || "Untitled",
        slug,
        description: form.description || "",
        content: form.content || "",
        kind: form.kind || "TEXT",
        content_url: form.content_url,
        section: form.section,
        order: form.order ?? nextOrder,
        is_active: form.is_active ?? true,
        duration_estimate_minutes: form.duration_estimate_minutes ?? 10,
        pass_threshold_percent: form.pass_threshold_percent ?? 80,
      };
      const created = await admin.createLesson(payload);
      setSavedAt(new Date());
      onSuccess?.("created", created.id);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Kunne ikke opprette leksjon");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      const admin = LearningAdminService.getInstance();
      await admin.updateLesson(lesson.id, { ...form, slug: lesson.slug } as LearningLessonCreate);
      setSavedAt(new Date());
    } catch (e) {
      console.error(e);
      setError("Kunne ikke lagre");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!lesson) return;
    setSaving(true);
    try {
      const admin = LearningAdminService.getInstance();
      await admin.updateLesson(lesson.id, { ...form, is_active: true, slug: lesson.slug } as LearningLessonCreate);
      setLesson((p) => (p ? { ...p, is_active: true } : null));
      setForm((f) => ({ ...f, is_active: true }));
      setSavedAt(new Date());
      onSuccess?.("published");
    } catch (e) {
      console.error(e);
      setError("Kunne ikke publisere");
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (id: number) => {
    setExpandedSections((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const wrapFormat = (before: string, after: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const v = form.content || "";
    const { start, end } = selectionRef.current;
    const sel = end > start ? v.slice(start, end) : "";
    setForm((f) => ({ ...f, content: v.slice(0, start) + (sel ? `${before}${sel}${after}` : before) + v.slice(end) }));
  };

  const currentSection = sections.find((s) => s.id === (lesson?.section ?? form.section));
  const lessonsBySection = Object.fromEntries(
    sections.map((sec) => [sec.id, allLessons.filter((l) => l.section === sec.id).sort((a, b) => a.order - b.order)])
  );

  if (loading) return <LoadingState message="Laster..." />;
  if (error && !lesson && !isNew) {
    return (
      <ErrorState
        title="Kunne ikke laste leksjon"
        message={error}
        onGoHome={() => (onClose ? onClose() : router.push("/admin-dashboard-learning/lessons"))}
      />
    );
  }
  if (!lesson && !isNew) return null;

  const renderTree = () => {
    const secs = grouped?.campaigns?.flatMap((c) => c.sections) ?? sections;
    return secs.map((sec) => {
      const ls = lessonsBySection[sec.id] || [];
      const expanded = expandedSections.has(sec.id);
      return (
        <div key={sec.id}>
          <button
            type="button"
            onClick={() => toggleSection(sec.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[#141414] hover:bg-[#f7f7f7]"
          >
            {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-[#757575]" /> : <ChevronRight className="h-4 w-4 shrink-0 text-[#757575]" />}
            <FileText className="h-4 w-4 shrink-0 text-[#757575]" />
            <span className="truncate">Seksjon {sec.order}: {sec.title}</span>
          </button>
          {expanded && ls.map((l) => {
            const isActive = lessonId !== null && l.id === lessonId;
            return (
              <div key={l.id} className={cn("ml-6 flex items-center gap-2 rounded-md px-2 py-1.5", isActive && "bg-[#141414] text-white")}>
                <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-50" />
                {onSelectLesson ? (
                  <button type="button" onClick={() => onSelectLesson(l.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                    {getLessonIcon(l.kind)}
                    <span className="truncate">{sec.order}.{l.order} {l.title}</span>
                  </button>
                ) : (
                  <Link href={`/admin-dashboard-learning/lessons/${l.id}`} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
                    {getLessonIcon(l.kind)}
                    <span className="truncate">{sec.order}.{l.order} {l.title}</span>
                  </Link>
                )}
                {!onSelectLesson && (
                  <Link href={`/admin-dashboard-learning/lessons/${l.id}`} className="shrink-0 rounded p-1 opacity-70 hover:opacity-100" aria-label="Rediger">
                    <Pencil className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Topp */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#E0E0E0] bg-white px-4 py-3 pr-12">
        <div className="flex items-center gap-2 text-sm text-[#757575]">
          {onClose ? (
            <button type="button" onClick={onClose} className="hover:text-[#141414]">Leksjoner</button>
          ) : (
            <Link href="/admin-dashboard-learning/lessons" className="hover:text-[#141414]">Leksjoner</Link>
          )}
          <span>/</span>
          <span className="font-medium text-[#141414]">{isNew ? "Ny leksjon" : currentSection?.title || lesson?.title}</span>
        </div>
        <div className="flex items-center gap-3">
          {savedAt && <span className="text-sm text-[#757575]">Sist lagret {savedAt.toLocaleTimeString("nb-NO", { minute: "2-digit", second: "2-digit" })}</span>}
          {isNew ? (
            <Button size="sm" onClick={handleCreate} disabled={saving || !form.title?.trim()} className="bg-[#141414] text-white hover:bg-[#333]">Opprett leksjon</Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={saving} className="border-[#E0E0E0]">Lagre utkast</Button>
              <Button size="sm" onClick={handlePublish} disabled={saving} className="bg-[#141414] text-white hover:bg-[#333]">Publiser endringer</Button>
            </>
          )}
        </div>
      </div>
      {error && <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">{error}</div>}

      <div className="flex min-h-0 flex-1">
        {/* Venstre: Kursstruktur */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-[#E0E0E0] bg-white">
          <div className="border-b border-[#E0E0E0] px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#757575]">Kursstruktur</h2>
            <p className="mt-0.5 truncate text-sm font-medium text-[#141414]">{currentSection?.title || "—"}</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">{renderTree()}</div>
          <div className="border-t border-[#E0E0E0] p-3">
            {onSelectLesson ? (
              <button
                type="button"
                onClick={() => onSelectLesson(null, form.section ?? lesson?.section)}
                className={cn("flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors", isNew ? "border-[#141414] bg-[#f7f7f7] text-[#141414]" : "border-[#E0E0E0] bg-white text-[#141414] hover:bg-[#f7f7f7]")}
              >
                <span className="text-lg">+</span> Legg til leksjon
              </button>
            ) : (
              <Link href={`/admin-dashboard-learning/lessons/new?section=${lesson?.section ?? form.section ?? sections[0]?.id ?? ""}`} className={cn("flex w-full items-center justify-center gap-2 rounded-lg border py-3 text-sm font-medium transition-colors", isNew ? "border-[#141414] bg-[#f7f7f7] text-[#141414]" : "border-[#E0E0E0] bg-white text-[#141414] hover:bg-[#f7f7f7]")}>
                <span className="text-lg">+</span> Legg til leksjon
              </Link>
            )}
          </div>
        </aside>

        {/* Midt: Skjema */}
        <main className="min-w-0 flex-1 overflow-y-auto border-r border-[#E0E0E0] bg-white p-6">
          <div className="mx-auto max-w-2xl space-y-6">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#757575]">Leksjonstittel</label>
              <Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="F.eks. Company Vision & Values" className="border-[#E0E0E0] text-lg font-semibold focus-visible:ring-[#141414]/30" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#757575]">Leksjonstype</label>
              <Select value={form.kind || "TEXT"} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                <SelectTrigger className="border-[#E0E0E0]"><SelectValue placeholder="Velg type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TEXT">📄 Tekst</SelectItem>
                  <SelectItem value="VIDEO">🎥 Video</SelectItem>
                  <SelectItem value="QUIZ">❓ Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.kind === "VIDEO" && (
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#757575]">Video</h4>
                <Button variant="outline" size="sm" className="mb-2 border-[#E0E0E0] text-[#141414]">Velg fra bibliotek</Button>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#E0E0E0] bg-[#f7f7f7] py-10 px-4" onDragOver={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}>
                  <Video className="mb-2 h-10 w-10 text-[#757575]" />
                  <p className="text-sm font-medium text-[#141414]">Slipp videofil her</p>
                  <p className="mt-1 text-xs text-[#757575]">MP4, MOV eller WebM opp til 2GB</p>
                  <Input value={form.content_url || ""} onChange={(e) => setForm((f) => ({ ...f, content_url: e.target.value }))} placeholder="Eller lim inn videourl" className="mt-4 max-w-sm border-[#E0E0E0]" />
                </div>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#757575]">Leksjonsbeskrivelse</label>
              <div className="mb-1 flex gap-1 rounded-md border border-[#E0E0E0] bg-white px-2 py-1">
                <button type="button" onClick={() => wrapFormat("**", "**")} className="rounded p-1.5 text-[#757575] hover:bg-[#f7f7f7] hover:text-[#141414]" title="Fet"><Bold className="h-4 w-4" /></button>
                <button type="button" onClick={() => wrapFormat("*", "*")} className="rounded p-1.5 text-[#757575] hover:bg-[#f7f7f7] hover:text-[#141414]" title="Kursiv"><Italic className="h-4 w-4" /></button>
                <button type="button" onClick={() => wrapFormat("__", "__")} className="rounded p-1.5 text-[#757575] hover:bg-[#f7f7f7] hover:text-[#141414]" title="Understreket"><Underline className="h-4 w-4" /></button>
                <div className="w-px bg-[#E0E0E0]" />
                <button type="button" className="rounded p-1.5 text-[#757575] hover:bg-[#f7f7f7] hover:text-[#141414]" title="Punktliste"><List className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1.5 text-[#757575] hover:bg-[#f7f7f7] hover:text-[#141414]" title="Nummerert liste"><ListOrdered className="h-4 w-4" /></button>
                <div className="w-px bg-[#E0E0E0]" />
                <button type="button" className="rounded p-1.5 text-[#757575] hover:bg-[#f7f7f7] hover:text-[#141414]" title="Lenke"><Link2 className="h-4 w-4" /></button>
                <button type="button" className="rounded p-1.5 text-[#757575] hover:bg-[#f7f7f7] hover:text-[#141414]" title="Bilde"><ImageIcon className="h-4 w-4" /></button>
              </div>
              <Textarea ref={textareaRef} value={form.content || ""} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} onSelect={(e) => { const t = e.target as HTMLTextAreaElement; selectionRef.current = { start: t.selectionStart, end: t.selectionEnd }; }} placeholder="Skriv beskrivelsen her..." rows={8} className="resize-y border-[#E0E0E0] focus-visible:ring-[#141414]/30" />
            </div>
            <div className="space-y-4 rounded-lg border border-[#E0E0E0] bg-white p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-[#141414]">Påkrevd fullføring</p><p className="text-xs text-[#757575]">Bruker må fullføre for å gå videre</p></div>
                <Switch checked={requiredCompletion} onCheckedChange={setRequiredCompletion} className="data-[state=checked]:bg-[#141414]" />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-medium text-[#141414]">Nedlastbare ressurser</p><p className="text-xs text-[#757575]">Tillat vedlegg</p></div>
                <Switch checked={downloadableResources} onCheckedChange={setDownloadableResources} className="data-[state=checked]:bg-[#141414]" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#141414]">Synlig for studenter</p>
                <Switch checked={form.is_active ?? true} onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: !!c }))} className="data-[state=checked]:bg-[#141414]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#757575]">Estimert varighet (min)</label>
                <Input type="number" min={1} value={form.duration_estimate_minutes ?? 10} onChange={(e) => setForm((f) => ({ ...f, duration_estimate_minutes: parseInt(e.target.value, 10) || 10 }))} className="max-w-[120px] border-[#E0E0E0]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#757575]">Seksjon</label>
                <Select value={String(form.section || "")} onValueChange={(v) => setForm((f) => ({ ...f, section: parseInt(v, 10) }))}>
                  <SelectTrigger className="border-[#E0E0E0]"><SelectValue placeholder="Velg seksjon" /></SelectTrigger>
                  <SelectContent>{sections.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            {form.kind === "QUIZ" && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                <p className="text-sm text-amber-800">For å redigere spørsmål og svar, bruk <Link href="/admin-dashboard-learning/quizzes" className="font-medium underline">Quizzer</Link> og velg denne quizen.</p>
              </div>
            )}
          </div>
        </main>

        {/* Høyre: Sanntidsforhåndsvisning – Ansatt/Leder, mobilramme */}
        <aside className="hidden w-[360px] shrink-0 flex-col border-[#E0E0E0] bg-[#fafafa] lg:flex">
          <div className="flex items-center justify-between border-b border-[#E0E0E0] bg-white px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#757575]">Sanntidsforhåndsvisning</h3>
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> LIVE</span>
          </div>
          <div className="flex gap-1 border-b border-[#E0E0E0] p-2">
            <button type="button" onClick={() => setPreviewRole("ansatt")} className={cn("flex-1 rounded-md py-2 text-sm font-medium transition-colors", previewRole === "ansatt" ? "bg-[#141414] text-white" : "bg-[#f0f0f0] text-[#757575] hover:bg-[#E0E0E0]")}>Ansatt</button>
            <button type="button" onClick={() => setPreviewRole("leder")} className={cn("flex-1 rounded-md py-2 text-sm font-medium transition-colors", previewRole === "leder" ? "bg-[#141414] text-white" : "bg-[#f0f0f0] text-[#757575] hover:bg-[#E0E0E0]")}>Leder</button>
          </div>
          <div className="flex flex-1 flex-col items-center overflow-y-auto p-4">
            <div className="w-full max-w-[280px] overflow-hidden rounded-2xl border-2 border-[#1a1a1a] bg-[#1a1a1a] shadow-xl">
              <div className="border-b border-[#333] bg-[#222] px-3 py-2"><p className="truncate text-center text-[10px] text-[#999]">lms.company.com/kurs/{lesson?.section ?? form.section ?? ""}</p></div>
              <div className="bg-[#141414] p-4">
                {form.kind === "VIDEO" && (
                  <div className="mb-4 flex aspect-video items-center justify-center rounded-lg bg-[#222]">
                    {form.content_url ? <div className="flex flex-col items-center gap-1 text-white/80"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/20"><Play className="h-6 w-6" /></div><span className="text-xs">Video</span></div> : <div className="flex flex-col items-center gap-1 text-[#666]"><Video className="h-8 w-8" /><span className="text-[10px]">Ingen video</span></div>}
                  </div>
                )}
                <h4 className="text-base font-bold text-white">{form.title || "Leksjonstittel"}</h4>
                <p className="mt-1 text-[10px] uppercase text-[#888]">{form.kind === "VIDEO" ? "VIDEO" : form.kind === "QUIZ" ? "QUIZ" : "TEKST"} {form.duration_estimate_minutes ?? 10} min</p>
                <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-[#ccc]">{form.content || form.description || "Beskrivelse vises her."}</p>
                <div className="mt-4"><div className="flex items-center justify-center rounded-lg bg-white py-2.5 text-sm font-semibold text-[#141414]">Neste leksjon →</div></div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-[#757575]">Forhåndsvisningen oppdateres automatisk.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
