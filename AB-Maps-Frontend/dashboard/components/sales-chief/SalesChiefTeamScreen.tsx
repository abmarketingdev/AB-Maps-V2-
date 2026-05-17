"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Users,
  UserCog,
  User as UserIcon,
  Search,
  RefreshCw,
  AlertTriangle,
  Loader2,
  Plus,
  X,
  CheckCircle2,
  GripVertical,
  ChevronDown,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  MouseSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/AuthContext";

import {
  fetchAvailablePeople,
  fetchMyTeam,
  addTeamMember,
  bulkAddTeamMembers,
  removeTeamMember,
  bulkRemoveTeamMembers,
  SalesChiefApiError,
  type AvailablePerson,
  type TeamMember,
  type Role,
} from "@/services/salesChiefService";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

type RoleFilter = "all" | Role;

const ROLE_LABEL: Record<Role, string> = {
  manager: "Leder",
  employee: "Ansatt",
};

const ROLE_FILTERS: Array<{ id: RoleFilter; label: string }> = [
  { id: "all", label: "Alle" },
  { id: "manager", label: "Ledere" },
  { id: "employee", label: "Ansatte" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Turn backend error codes into a friendly Norwegian message. */
function humanizeError(err: unknown, fallback: string): string {
  if (err instanceof SalesChiefApiError) {
    switch (err.code) {
      case "already_in_team":
        return "Brukeren er allerede i teamet ditt.";
      case "self_add_not_allowed":
        return "Du kan ikke legge til deg selv i teamet.";
      case "user_not_found":
        return "Brukeren ble ikke funnet.";
      case "role_required":
        return "Kunne ikke avgjøre rolle — velg leder eller ansatt.";
      case "not_in_team":
        return "Medlemmet finnes ikke i teamet.";
    }
    return err.message || fallback;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

/* -------------------------------------------------------------------------- */
/*  Person card (shared for both columns)                                     */
/* -------------------------------------------------------------------------- */

interface PersonCardProps {
  id: string;
  name: string;
  email: string;
  username?: string;
  abPersonId?: string | null;
  role: Role;
  isOnline?: boolean;
  side: "available" | "team";
  selected: boolean;
  onToggleSelect: () => void;
  onPrimaryAction: () => void;
  actionBusy?: boolean;
  draggable?: boolean;
}

function PersonCard({
  id,
  name,
  email,
  username,
  abPersonId,
  role,
  isOnline,
  side,
  selected,
  onToggleSelect,
  onPrimaryAction,
  actionBusy,
  draggable = true,
}: PersonCardProps) {
  const sortable = useSortable({ id, disabled: !draggable });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg border bg-white p-3 shadow-sm transition-all",
        "hover:shadow-md",
        selected ? "border-blue-400 ring-2 ring-blue-200" : "border-gray-200",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <div className="pt-1">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={selected ? "Fjern markering" : "Marker"}
          />
        </div>

        {/* Drag handle */}
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none pt-1 text-gray-300 transition-colors hover:text-gray-500 active:cursor-grabbing"
            aria-label="Dra for å flytte"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {/* Avatar */}
        <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white shadow-inner">
          {getInitials(name)}
          {isOnline && (
            <span
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-500"
              aria-label="Online"
            />
          )}
        </div>

        {/* Body */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
            <Badge
              variant="outline"
              className={cn(
                "h-5 px-1.5 text-[10px] font-medium",
                role === "manager"
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : "border-sky-200 bg-sky-50 text-sky-700"
              )}
            >
              {role === "manager" ? (
                <UserCog className="mr-1 h-3 w-3" />
              ) : (
                <UserIcon className="mr-1 h-3 w-3" />
              )}
              {ROLE_LABEL[role]}
            </Badge>
          </div>
          <p className="truncate text-xs text-gray-500">{email}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
            {username && <span className="truncate">@{username}</span>}
            {abPersonId && (
              <>
                <span>·</span>
                <span>AB {abPersonId}</span>
              </>
            )}
          </div>
        </div>

        {/* Primary action */}
        <Button
          size="sm"
          variant="outline"
          disabled={actionBusy}
          onClick={(e) => {
            e.stopPropagation();
            onPrimaryAction();
          }}
          className={cn(
            "flex-shrink-0",
            side === "available"
              ? "border-blue-200 text-blue-700 hover:bg-blue-50"
              : "border-red-200 text-red-600 hover:bg-red-50"
          )}
        >
          {actionBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : side === "available" ? (
            <>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Legg til
            </>
          ) : (
            <>
              <X className="mr-1 h-3.5 w-3.5" />
              Fjern
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Drop column                                                               */
/* -------------------------------------------------------------------------- */

interface DropColumnProps {
  id: "available" | "team";
  title: string;
  subtitle?: string;
  count: number;
  isOver: boolean;
  isLoading: boolean;
  emptyLabel: string;
  children: React.ReactNode;
  headerExtras?: React.ReactNode;
}

function DropColumn({
  id,
  title,
  subtitle,
  count,
  isLoading,
  emptyLabel,
  children,
  headerExtras,
}: DropColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <Badge variant="outline" className="font-medium">
            {count}
          </Badge>
          {isOver && (
            <Badge className="ml-auto animate-pulse bg-blue-600 text-white">
              Slipp her
            </Badge>
          )}
        </div>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        {headerExtras}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[300px] flex-1 flex-col rounded-lg border-2 border-dashed p-3 transition-all",
          isOver ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50"
        )}
      >
        <div className="max-h-[calc(100vh-360px)] flex-1 space-y-2 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <div className="h-4 w-4 rounded bg-gray-200" />
                  <div className="h-10 w-10 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded bg-gray-200" />
                    <div className="h-2 w-3/4 rounded bg-gray-200" />
                  </div>
                  <div className="h-8 w-20 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : count === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-gray-400">
              <Users className="mb-2 h-10 w-10" />
              <p className="text-sm">{emptyLabel}</p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main screen                                                               */
/* -------------------------------------------------------------------------- */

export default function SalesChiefTeamScreen() {
  const { isSalesChief, user, isLoading: authLoading } = useAuth();

  // ---- Team (right column) ------------------------------------------------
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState<string | null>(null);

  // ---- Available people (left column) ------------------------------------
  const [available, setAvailable] = useState<AvailablePerson[]>([]);
  const [availableLoading, setAvailableLoading] = useState(true);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [availableCount, setAvailableCount] = useState(0);
  const [availablePage, setAvailablePage] = useState(1);
  const [availableHasMore, setAvailableHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // ---- Filters / search ---------------------------------------------------
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  // ---- Selection ----------------------------------------------------------
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set());
  const [selectedTeam, setSelectedTeam] = useState<Set<string>>(new Set());

  // ---- Busy states --------------------------------------------------------
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // ---- Confirm dialogs ----------------------------------------------------
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);

  // ---- DnD ----------------------------------------------------------------
  const [activeDrag, setActiveDrag] = useState<
    | { type: "available"; person: AvailablePerson }
    | { type: "team"; person: TeamMember }
    | null
  >(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  /* ----------------------------- data loading --------------------------- */

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamError(null);
    try {
      const data = await fetchMyTeam();
      setTeam(data.team);
    } catch (err) {
      setTeamError(humanizeError(err, "Kunne ikke hente teamet."));
    } finally {
      setTeamLoading(false);
    }
  }, []);

  const availableReqId = useRef(0);
  const loadAvailable = useCallback(
    async (opts: { page?: number; append?: boolean } = {}) => {
      const page = opts.page ?? 1;
      const append = !!opts.append;

      if (append) setLoadingMore(true);
      else setAvailableLoading(true);
      setAvailableError(null);

      const reqId = ++availableReqId.current;

      try {
        const data = await fetchAvailablePeople({
          search: debouncedSearch || undefined,
          role: roleFilter === "all" ? undefined : roleFilter,
          page,
          pageSize: 50,
        });

        if (reqId !== availableReqId.current) return;

        setAvailableCount(data.count);
        setAvailableHasMore(!!data.next);
        setAvailablePage(page);
        setAvailable((prev) => (append ? [...prev, ...data.results] : data.results));
      } catch (err) {
        if (reqId !== availableReqId.current) return;
        setAvailableError(humanizeError(err, "Kunne ikke hente tilgjengelige brukere."));
      } finally {
        if (reqId === availableReqId.current) {
          setAvailableLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [debouncedSearch, roleFilter]
  );

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Initial + whenever filters change, reload available from page 1
  useEffect(() => {
    if (!isSalesChief) return;
    loadAvailable({ page: 1, append: false });
  }, [isSalesChief, loadAvailable]);

  useEffect(() => {
    if (!isSalesChief) return;
    loadTeam();
  }, [isSalesChief, loadTeam]);

  /* ----------------------------- helpers -------------------------------- */

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleAvailableSelection = useCallback((id: string) => {
    setSelectedAvailable((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleTeamSelection = useCallback((id: string) => {
    setSelectedTeam((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /* ----------------------------- add ------------------------------------ */

  // Optimistic add — moves a person from available → team, then reconciles.
  const handleAddOne = useCallback(
    async (person: AvailablePerson) => {
      setBusy(person.user_id, true);

      // Optimistic move
      setAvailable((prev) => prev.filter((p) => p.user_id !== person.user_id));
      setSelectedAvailable((prev) => {
        const n = new Set(prev);
        n.delete(person.user_id);
        return n;
      });

      try {
        const member = await addTeamMember(person.user_id);
        setTeam((prev) =>
          prev.some((m) => m.user_id === member.user_id) ? prev : [member, ...prev]
        );
        setAvailableCount((c) => Math.max(0, c - 1));
        toast({ title: "Lagt til", description: `${member.name} er lagt til i teamet.` });
      } catch (err) {
        // Roll back on failure
        setAvailable((prev) =>
          prev.some((p) => p.user_id === person.user_id) ? prev : [person, ...prev]
        );
        toast({
          title: "Kunne ikke legge til",
          description: humanizeError(err, "Ukjent feil."),
          variant: "destructive",
        });
      } finally {
        setBusy(person.user_id, false);
      }
    },
    [setBusy]
  );

  const handleBulkAdd = useCallback(async () => {
    const ids = Array.from(selectedAvailable);
    if (ids.length === 0) return;

    const people = available.filter((p) => ids.includes(p.user_id));
    if (people.length === 0) return;

    setBulkBusy(true);
    // Optimistic: remove them from available
    setAvailable((prev) => prev.filter((p) => !selectedAvailable.has(p.user_id)));
    setSelectedAvailable(new Set());

    try {
      const res = await bulkAddTeamMembers(ids.map((user_id) => ({ user_id })));
      if (res.added.length > 0) {
        setTeam((prev) => {
          const known = new Set(prev.map((m) => m.user_id));
          return [...res.added.filter((m) => !known.has(m.user_id)), ...prev];
        });
      }
      setAvailableCount((c) => Math.max(0, c - res.added.length));

      // Restore those the backend couldn't add
      const restoreIds = new Set([
        ...res.already_exists,
        ...res.not_found,
        ...res.no_role,
      ]);
      if (restoreIds.size > 0) {
        const restore = people.filter((p) => restoreIds.has(p.user_id));
        if (restore.length > 0) {
          setAvailable((prev) => [...restore, ...prev]);
        }
      }

      const problems: string[] = [];
      if (res.already_exists.length) problems.push(`${res.already_exists.length} allerede i teamet`);
      if (res.not_found.length) problems.push(`${res.not_found.length} ikke funnet`);
      if (res.no_role.length) problems.push(`${res.no_role.length} uten rolle`);

      toast({
        title: `La til ${res.added.length} ${res.added.length === 1 ? "medlem" : "medlemmer"}`,
        description: problems.length ? problems.join(" · ") : "Alle ble lagt til.",
      });
    } catch (err) {
      // Roll back everything
      setAvailable((prev) => {
        const known = new Set(prev.map((p) => p.user_id));
        return [...people.filter((p) => !known.has(p.user_id)), ...prev];
      });
      toast({
        title: "Kunne ikke legge til medlemmer",
        description: humanizeError(err, "Ukjent feil."),
        variant: "destructive",
      });
    } finally {
      setBulkBusy(false);
    }
  }, [available, selectedAvailable]);

  /* ----------------------------- remove --------------------------------- */

  const matchesFilters = useCallback(
    (p: { name: string; email: string; username: string; ab_person_id?: string | null; role: Role }) => {
      if (roleFilter !== "all" && p.role !== roleFilter) return false;
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const hay = [p.name, p.email, p.username, p.ab_person_id || ""]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    },
    [debouncedSearch, roleFilter]
  );

  const handleRemoveOne = useCallback(
    async (member: TeamMember) => {
      setBusy(member.user_id, true);

      // Optimistic: remove from team
      setTeam((prev) => prev.filter((m) => m.user_id !== member.user_id));
      setSelectedTeam((prev) => {
        const n = new Set(prev);
        n.delete(member.user_id);
        return n;
      });

      try {
        const res = await removeTeamMember(member.user_id);
        // Bring the full snapshot back into the available column if it matches current filters.
        const restored: AvailablePerson = {
          user_id: res.member.user_id,
          name: res.member.name,
          email: res.member.email,
          username: res.member.username,
          ab_person_id: res.member.ab_person_id,
          role: res.member.role,
          is_online: res.member.is_online,
          phone: res.member.phone,
        };
        if (matchesFilters(restored)) {
          setAvailable((prev) =>
            prev.some((p) => p.user_id === restored.user_id) ? prev : [restored, ...prev]
          );
          setAvailableCount((c) => c + 1);
        } else {
          setAvailableCount((c) => c + 1);
        }
        toast({ title: "Fjernet", description: `${res.member.name} er fjernet fra teamet.` });
      } catch (err) {
        // Roll back
        setTeam((prev) => (prev.some((m) => m.user_id === member.user_id) ? prev : [member, ...prev]));
        toast({
          title: "Kunne ikke fjerne",
          description: humanizeError(err, "Ukjent feil."),
          variant: "destructive",
        });
      } finally {
        setBusy(member.user_id, false);
      }
    },
    [matchesFilters, setBusy]
  );

  const handleBulkRemove = useCallback(async () => {
    const ids = Array.from(selectedTeam);
    if (ids.length === 0) return;

    const snapshot = team.filter((m) => ids.includes(m.user_id));
    if (snapshot.length === 0) return;

    setBulkBusy(true);
    // Optimistic: drop from team
    setTeam((prev) => prev.filter((m) => !selectedTeam.has(m.user_id)));
    setSelectedTeam(new Set());

    try {
      const res = await bulkRemoveTeamMembers(ids);

      // Restore into available column (only those matching current filters)
      const toRestore = res.removed_members.filter(matchesFilters);
      if (toRestore.length > 0) {
        setAvailable((prev) => {
          const known = new Set(prev.map((p) => p.user_id));
          return [
            ...toRestore
              .filter((m) => !known.has(m.user_id))
              .map((m) => ({
                user_id: m.user_id,
                name: m.name,
                email: m.email,
                username: m.username,
                ab_person_id: m.ab_person_id,
                role: m.role,
                is_online: m.is_online,
                phone: m.phone,
              })),
            ...prev,
          ];
        });
      }
      setAvailableCount((c) => c + res.removed_members.length);

      // If backend didn't actually remove some, put them back into the team
      if (res.not_found.length > 0) {
        const restoreTeam = snapshot.filter((m) => res.not_found.includes(m.user_id));
        if (restoreTeam.length > 0) {
          setTeam((prev) => {
            const known = new Set(prev.map((m) => m.user_id));
            return [...restoreTeam.filter((m) => !known.has(m.user_id)), ...prev];
          });
        }
      }

      toast({
        title: `Fjernet ${res.removed} ${res.removed === 1 ? "medlem" : "medlemmer"}`,
        description: res.not_found.length
          ? `${res.not_found.length} var ikke i teamet.`
          : undefined,
      });
    } catch (err) {
      // Roll back everything
      setTeam((prev) => {
        const known = new Set(prev.map((m) => m.user_id));
        return [...snapshot.filter((m) => !known.has(m.user_id)), ...prev];
      });
      toast({
        title: "Kunne ikke fjerne medlemmer",
        description: humanizeError(err, "Ukjent feil."),
        variant: "destructive",
      });
    } finally {
      setBulkBusy(false);
    }
  }, [matchesFilters, selectedTeam, team]);

  /* ----------------------------- filtering ------------------------------ */

  // Available list is server-filtered, but to keep things snappy after
  // optimistic moves and local filter changes, apply client-side filters too.
  const visibleAvailable = useMemo(() => available.filter(matchesFilters), [available, matchesFilters]);
  const visibleTeam = useMemo(() => team.filter(matchesFilters), [team, matchesFilters]);

  /* ----------------------------- drag handlers -------------------------- */

  const handleDragStart = useCallback(
    (ev: DragStartEvent) => {
      const id = String(ev.active.id);
      const avail = available.find((p) => p.user_id === id);
      if (avail) {
        setActiveDrag({ type: "available", person: avail });
        return;
      }
      const mem = team.find((m) => m.user_id === id);
      if (mem) {
        setActiveDrag({ type: "team", person: mem });
      }
    },
    [available, team]
  );

  const handleDragEnd = useCallback(
    (ev: DragEndEvent) => {
      const active = activeDrag;
      setActiveDrag(null);
      if (!active || !ev.over) return;
      const overId = String(ev.over.id);

      if (active.type === "available" && overId === "team") {
        handleAddOne(active.person);
      } else if (active.type === "team" && overId === "available") {
        handleRemoveOne(active.person);
      }
    },
    [activeDrag, handleAddOne, handleRemoveOne]
  );

  /* ----------------------------- render --------------------------------- */

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isSalesChief) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="h-7 w-7 text-red-500" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Ingen tilgang</h2>
        <p className="text-sm text-gray-600">
          Denne siden er kun for salgssjefer. Kontakt en administrator hvis du mener
          dette er feil.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Users className="h-6 w-6 text-blue-600" />
            Salgssjef-team
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {user?.user_info?.name ? (
              <>Administrer teamet til <span className="font-medium">{user.user_info.name}</span>. </>
            ) : null}
            Klikk på et kort for å legge til eller fjerne, eller dra kort mellom kolonnene.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadTeam();
              loadAvailable({ page: 1, append: false });
            }}
            disabled={teamLoading || availableLoading}
          >
            <RefreshCw
              className={cn(
                "mr-2 h-4 w-4",
                (teamLoading || availableLoading) && "animate-spin"
              )}
            />
            Oppdater
          </Button>
        </div>
      </div>

      {/* Toolbar: search + role filter */}
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Søk på navn, e-post, brukernavn eller AB-ID…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-gray-50 p-1">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setRoleFilter(f.id)}
              className={cn(
                "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                roleFilter === f.id
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {(selectedAvailable.size > 0 || selectedTeam.size > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
          <div className="flex items-center gap-2 text-blue-900">
            <CheckCircle2 className="h-4 w-4" />
            <span>
              {selectedAvailable.size > 0 && (
                <>
                  {selectedAvailable.size} valgt til å legge til
                  {selectedTeam.size > 0 ? " · " : ""}
                </>
              )}
              {selectedTeam.size > 0 && <>{selectedTeam.size} valgt til å fjerne</>}
            </span>
          </div>
          <div className="flex gap-2">
            {selectedAvailable.size > 0 && (
              <Button
                size="sm"
                onClick={handleBulkAdd}
                disabled={bulkBusy}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {bulkBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Legg til {selectedAvailable.size}
              </Button>
            )}
            {selectedTeam.size > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmBulkRemove(true)}
                disabled={bulkBusy}
              >
                {bulkBusy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <X className="mr-2 h-4 w-4" />
                )}
                Fjern {selectedTeam.size}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelectedAvailable(new Set());
                setSelectedTeam(new Set());
              }}
            >
              Nullstill
            </Button>
          </div>
        </div>
      )}

      {/* Errors */}
      {(teamError || availableError) && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            {teamError && <div>{teamError}</div>}
            {availableError && <div>{availableError}</div>}
          </div>
        </div>
      )}

      {/* Columns */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDrag(null)}
      >
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Available */}
          <DropColumn
            id="available"
            title="Tilgjengelige"
            subtitle="Brukere du kan legge til i teamet"
            count={visibleAvailable.length}
            isOver={false}
            isLoading={availableLoading}
            emptyLabel={
              debouncedSearch || roleFilter !== "all"
                ? "Ingen treff på søket."
                : "Ingen tilgjengelige brukere."
            }
            headerExtras={
              <div className="flex items-center justify-between text-[11px] text-gray-500">
                <span>
                  Viser {visibleAvailable.length} av {availableCount}
                </span>
                {availableHasMore && (
                  <button
                    type="button"
                    onClick={() => loadAvailable({ page: availablePage + 1, append: true })}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    Last flere
                  </button>
                )}
              </div>
            }
          >
            <SortableContext
              items={visibleAvailable.map((p) => p.user_id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleAvailable.map((p) => (
                <PersonCard
                  key={p.user_id}
                  id={p.user_id}
                  name={p.name}
                  email={p.email}
                  username={p.username}
                  abPersonId={p.ab_person_id}
                  role={p.role}
                  isOnline={p.is_online}
                  side="available"
                  selected={selectedAvailable.has(p.user_id)}
                  onToggleSelect={() => toggleAvailableSelection(p.user_id)}
                  onPrimaryAction={() => handleAddOne(p)}
                  actionBusy={busyIds.has(p.user_id)}
                />
              ))}
            </SortableContext>
          </DropColumn>

          {/* Team */}
          <DropColumn
            id="team"
            title="I teamet ditt"
            subtitle="Medlemmer som rapporterer til deg"
            count={visibleTeam.length}
            isOver={false}
            isLoading={teamLoading}
            emptyLabel={
              debouncedSearch || roleFilter !== "all"
                ? "Ingen treff på søket."
                : "Du har ikke lagt til noen medlemmer ennå."
            }
          >
            <SortableContext
              items={visibleTeam.map((m) => m.user_id)}
              strategy={verticalListSortingStrategy}
            >
              {visibleTeam.map((m) => (
                <PersonCard
                  key={m.user_id}
                  id={m.user_id}
                  name={m.name}
                  email={m.email}
                  username={m.username}
                  abPersonId={m.ab_person_id}
                  role={m.role}
                  isOnline={m.is_online}
                  side="team"
                  selected={selectedTeam.has(m.user_id)}
                  onToggleSelect={() => toggleTeamSelection(m.user_id)}
                  onPrimaryAction={() => setConfirmRemove(m)}
                  actionBusy={busyIds.has(m.user_id)}
                />
              ))}
            </SortableContext>
          </DropColumn>
        </div>

        <DragOverlay>
          {activeDrag ? (
            <div className="rotate-1 rounded-lg border border-blue-300 bg-white p-3 shadow-xl ring-2 ring-blue-200">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
                  {getInitials(activeDrag.person.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{activeDrag.person.name}</p>
                  <p className="text-xs text-gray-500">{ROLE_LABEL[activeDrag.person.role]}</p>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Confirm single remove */}
      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fjerne medlem fra teamet?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmRemove ? (
                <>
                  <span className="font-medium text-gray-900">{confirmRemove.name}</span>{" "}
                  vil bli fjernet fra teamet ditt. Du kan legge dem til igjen senere.
                </>
              ) : (
                "Er du sikker?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (confirmRemove) {
                  const target = confirmRemove;
                  setConfirmRemove(null);
                  handleRemoveOne(target);
                }
              }}
            >
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm bulk remove */}
      <AlertDialog open={confirmBulkRemove} onOpenChange={setConfirmBulkRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Fjerne {selectedTeam.size} {selectedTeam.size === 1 ? "medlem" : "medlemmer"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              De valgte medlemmene vil bli fjernet fra teamet ditt. Du kan legge dem til
              igjen senere.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                setConfirmBulkRemove(false);
                handleBulkRemove();
              }}
            >
              Fjern
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
