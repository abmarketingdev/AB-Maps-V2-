// Employee briefing — live backend adapter (Module 1, guide §4).
// GET /api/employee/me/briefing/?date=YYYY-MM-DD. Identity is the token; never
// send employee_id (it is ignored/overridden server-side, guide §7).

import { getJSON } from '@/lib/auth/fetchWithAuth';
import type { GoalStatus } from '@/components/dashboard/v2/employee/employeeLogic';

interface EmployeeBriefingResponse {
  first_name: string;
  weekday: string;
  date_str: string;
  time_of_day: 'morgen' | 'dag' | 'kveld';
  within_shift: boolean;
  goal_status: {
    yesterday_doors: number;
    yesterday_goal: number;
    yesterday_achieved: boolean;
    yesterday_pct: number;
    today_goal: number;
    has_today_goal: boolean;
    global_default: number;
  };
  streak_days: number;
  doors_today: number;
}

// The fields EmployeeBriefingView actually reads.
export interface EmployeeBriefing {
  firstName: string;
  weekday: string;
  dateStr: string;
  timeOfDay: 'morgen' | 'dag' | 'kveld';
  withinShift: boolean;
  streakDays: number;
  doorsToday: number;
  goal: GoalStatus;
}

export function mapEmployeeBriefing(r: EmployeeBriefingResponse): EmployeeBriefing {
  const g = r.goal_status;
  return {
    firstName: r.first_name,
    weekday: r.weekday,
    dateStr: r.date_str,
    timeOfDay: r.time_of_day,
    withinShift: r.within_shift,
    streakDays: r.streak_days,
    doorsToday: r.doors_today,
    goal: {
      yesterdayDoors: g.yesterday_doors,
      yesterdayGoal: g.yesterday_goal,
      yesterdayAchieved: g.yesterday_achieved,
      yesterdayPct: g.yesterday_pct,
      todayGoal: g.today_goal,
      hasTodayGoal: g.has_today_goal,
      globalDefault: g.global_default,
    },
  };
}

// Zeroed placeholder used while the live briefing loads (no mock numbers).
export function emptyEmployeeBriefing(firstName = ""): EmployeeBriefing {
  const now = new Date();
  const hour = now.getHours();
  return {
    firstName,
    weekday: now.toLocaleDateString('nb-NO', { weekday: 'long' }),
    dateStr: now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long' }),
    timeOfDay: hour < 11 ? 'morgen' : hour < 17 ? 'dag' : 'kveld',
    withinShift: false,
    streakDays: 0,
    doorsToday: 0,
    goal: {
      yesterdayDoors: 0, yesterdayGoal: 0, yesterdayAchieved: false, yesterdayPct: 0,
      todayGoal: 0, hasTodayGoal: false, globalDefault: 0,
    },
  };
}

/** Fetch + map the employee briefing. `date` optional (defaults to today). */
export async function fetchEmployeeBriefing(date?: string): Promise<EmployeeBriefing> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  const raw = await getJSON<EmployeeBriefingResponse>(`/api/employee/me/briefing/${q}`);
  return mapEmployeeBriefing(raw);
}
