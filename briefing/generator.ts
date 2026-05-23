import { App } from "obsidian";
import { fetchTodayTasks, fetchCompletedToday, TodoistTask, CompletedTask } from "../sources/todoist";
import { fetchTodayEvents, CalendarEvent } from "../sources/calendar";
import { fetchTodayFocusStats, fetchYesterdayFocusStats, FocusStats } from "../sources/focussessions";
import { recommendFocus, DEFAULT_GROQ_MODEL } from "../sources/groq";
import { fetchCurrentReading, ReadingItem } from "../sources/reading";

export type Slot = "morning" | "evening";

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export const ENERGY_LEVELS: EnergyLevel[] = [1, 2, 3, 4, 5];

export const ENERGY_FRONTMATTER_KEY = {
  morning: "morning_energy",
  evening: "evening_energy",
} as const;

export function isEnergyLevel(v: unknown): v is EnergyLevel {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

export type { ReadingItem };

interface BriefingContextBase {
  date: Date;
  energy: EnergyLevel | null;        // 1 (drained) .. 5 (energized), persisted in daily note YAML
  errors: string[];                  // soft errors so the view can render partial briefings
}

export interface MorningBriefingContext extends BriefingContextBase {
  slot: "morning";
  calendarEvents: CalendarEvent[];
  tasks: TodoistTask[];
  currentReading: ReadingItem[];     // empty in Session 1 — wired when vault reader lands
  recommendedFocus: string | null;   // null until Session 4 Groq integration
  // FUTURE: music queue section — read from ~/Library/Application Support/music-queue/store.json
  // FUTURE: language learning section — read from vault file Daily Notes/lang-streak.md
}

export interface EveningBriefingContext extends BriefingContextBase {
  slot: "evening";
  focusStats: FocusStats;
  completedTasks: CompletedTask[];
  openTasks: TodoistTask[];
  reflectionPrompt: string;
}

export type BriefingContext = MorningBriefingContext | EveningBriefingContext;

export interface MorningGeneratorDeps {
  app: App;
  todoistToken: string;
  focusFoxStorePath: string;
  groqApiKey: string;
  groqModel: string;
  energy: EnergyLevel | null;
}

export interface EveningGeneratorDeps {
  todoistToken: string;
  focusFoxStorePath: string;
  energy: EnergyLevel | null;
  reflectionPrompt: string;
}

function pushError(errors: string[], prefix: string, reason: unknown): void {
  const msg = reason instanceof Error ? reason.message : String(reason);
  errors.push(`${prefix}: ${msg}`);
}

export async function generateMorningBriefing(deps: MorningGeneratorDeps): Promise<MorningBriefingContext> {
  const errors: string[] = [];
  const now = new Date();

  const [tasksResult, eventsResult, yesterdayResult] = await Promise.allSettled([
    fetchTodayTasks(deps.todoistToken, 5),
    fetchTodayEvents(deps.focusFoxStorePath, now),
    fetchYesterdayFocusStats(deps.focusFoxStorePath, now),
  ]);

  const tasks: TodoistTask[] = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  if (tasksResult.status === "rejected") pushError(errors, "Tasks", tasksResult.reason);

  const calendarEvents: CalendarEvent[] =
    eventsResult.status === "fulfilled" ? eventsResult.value : [];
  if (eventsResult.status === "rejected") pushError(errors, "Calendar", eventsResult.reason);

  const yesterdayFocusSeconds =
    yesterdayResult.status === "fulfilled" ? yesterdayResult.value.totalSeconds : 0;
  // Yesterday stats are nice-to-have for Groq prompt; don't surface failures.

  let currentReading: ReadingItem[] = [];
  try {
    currentReading = fetchCurrentReading(deps.app);
  } catch (err) {
    pushError(errors, "Current reading", err);
  }

  let recommendedFocus: string | null = null;
  if (deps.groqApiKey) {
    try {
      recommendedFocus = await recommendFocus({
        apiKey: deps.groqApiKey,
        model: deps.groqModel || DEFAULT_GROQ_MODEL,
        calendarEvents,
        tasks,
        energy: deps.energy,
        yesterdayFocusSeconds,
      });
    } catch (err) {
      pushError(errors, "Focus recommendation", err);
    }
  }

  return {
    slot: "morning",
    date: now,
    calendarEvents,
    tasks,
    currentReading,
    recommendedFocus,
    energy: deps.energy,
    errors,
  };
}

export async function generateEveningBriefing(deps: EveningGeneratorDeps): Promise<EveningBriefingContext> {
  const errors: string[] = [];
  const now = new Date();

  const [openResult, completedResult, focusResult] = await Promise.allSettled([
    fetchTodayTasks(deps.todoistToken, 8),
    fetchCompletedToday(deps.todoistToken, 10, now),
    fetchTodayFocusStats(deps.focusFoxStorePath, now),
  ]);

  const openTasks: TodoistTask[] = openResult.status === "fulfilled" ? openResult.value : [];
  if (openResult.status === "rejected") pushError(errors, "Open tasks", openResult.reason);

  const completedTasks: CompletedTask[] =
    completedResult.status === "fulfilled" ? completedResult.value : [];
  if (completedResult.status === "rejected") pushError(errors, "Completed tasks", completedResult.reason);

  const focusStats: FocusStats =
    focusResult.status === "fulfilled"
      ? focusResult.value
      : { sessionCount: 0, totalSeconds: 0, projectTotals: [], topProject: null };
  if (focusResult.status === "rejected") pushError(errors, "Focus stats", focusResult.reason);

  return {
    slot: "evening",
    date: now,
    energy: deps.energy,
    errors,
    focusStats,
    completedTasks,
    openTasks,
    reflectionPrompt: deps.reflectionPrompt,
  };
}

export const REFLECTION_PROMPTS: readonly string[] = [
  "What felt energizing today?",
  "What felt like a drag?",
  "What worked really well with your schedule?",
  "What would you do differently?",
  "What's one thing you want to carry into tomorrow?",
  "Where did you spend your best energy today?",
  "What did you avoid, and why?",
];

interface ReflectionState {
  reflectionIndex: number;
  reflectionLastDate: string;
}

// Picks today's reflection prompt and rolls forward the rotation on date change.
// First-ever call (lastDate "") seeds today without advancing so the user sees
// prompt #0 on day one. Mutates `state`; caller persists.
export function pickAndAdvanceReflectionPrompt(state: ReflectionState, todayStr: string): string {
  if (state.reflectionLastDate !== todayStr) {
    if (state.reflectionLastDate !== "") {
      state.reflectionIndex = (state.reflectionIndex + 1) % REFLECTION_PROMPTS.length;
    }
    state.reflectionLastDate = todayStr;
  }
  const idx = ((state.reflectionIndex % REFLECTION_PROMPTS.length) + REFLECTION_PROMPTS.length) %
    REFLECTION_PROMPTS.length;
  return REFLECTION_PROMPTS[idx];
}

export function todayKey(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatHumanDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
