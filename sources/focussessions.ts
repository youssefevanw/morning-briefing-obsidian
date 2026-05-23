import { readFocusFoxStore, FocusFoxSession } from "./focusfox";

export interface ProjectTotal {
  project: string;
  seconds: number;
}

export interface FocusStats {
  sessionCount: number;
  totalSeconds: number;
  projectTotals: ProjectTotal[];   // sorted desc by seconds
  topProject: string | null;
}

function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Focus Fox uses "Short Break" / "Long Break" phase names. Pure-break sessions
// shouldn't count toward focus time the way the desktop dashboard renders it.
function isBreak(s: FocusFoxSession): boolean {
  return /break/i.test(s.phase);
}

export async function fetchFocusStatsForDate(
  storePath: string,
  targetDate: Date
): Promise<FocusStats> {
  const store = await readFocusFoxStore(storePath);
  const log = (store.ft9_log ?? []) as FocusFoxSession[];

  const targetFocus = log.filter((s) => {
    if (!s?.startTs) return false;
    const start = new Date(s.startTs);
    if (Number.isNaN(start.getTime())) return false;
    if (!isSameLocalDate(start, targetDate)) return false;
    return !isBreak(s);
  });

  const byProject = new Map<string, number>();
  let totalSeconds = 0;
  for (const s of targetFocus) {
    const dur = typeof s.dur === "number" ? s.dur : 0;
    totalSeconds += dur;
    const project = s.project || "Unassigned";
    byProject.set(project, (byProject.get(project) ?? 0) + dur);
  }

  const projectTotals: ProjectTotal[] = Array.from(byProject.entries())
    .map(([project, seconds]) => ({ project, seconds }))
    .sort((a, b) => b.seconds - a.seconds);

  return {
    sessionCount: targetFocus.length,
    totalSeconds,
    projectTotals,
    topProject: projectTotals[0]?.project ?? null,
  };
}

export function fetchTodayFocusStats(storePath: string, now: Date = new Date()): Promise<FocusStats> {
  return fetchFocusStatsForDate(storePath, now);
}

export function fetchYesterdayFocusStats(storePath: string, now: Date = new Date()): Promise<FocusStats> {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return fetchFocusStatsForDate(storePath, yesterday);
}

export function formatDurationShort(seconds: number): string {
  if (seconds <= 0) return "0m";
  const totalMinutes = Math.round(seconds / 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
