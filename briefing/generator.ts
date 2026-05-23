import { fetchTodayTasks, TodoistTask } from "../sources/todoist";

export interface BriefingContext {
  date: Date;
  calendarEvents: CalendarEvent[];   // empty in Session 1 — wired in Session 2 from ft9_cal
  tasks: TodoistTask[];
  currentReading: ReadingItem[];     // empty in Session 1 — wired when vault reader lands
  recommendedFocus: string | null;   // null in Session 1 — populated by Groq in Session 4
  energy: "low" | "medium" | "high" | null;
  errors: string[];                  // soft errors so the view can render partial briefings
  // FUTURE: music queue section — read from ~/Library/Application Support/music-queue/store.json
  // FUTURE: language learning section — read from vault file Daily Notes/lang-streak.md
}

export interface CalendarEvent {
  start: string;
  end: string;
  summary: string;
  location?: string;
}

export interface ReadingItem {
  title: string;
  author: string;
  genre?: string;
}

export interface GeneratorDeps {
  todoistToken: string;
  energy: "low" | "medium" | "high" | null;
}

export async function generateMorningBriefing(deps: GeneratorDeps): Promise<BriefingContext> {
  const errors: string[] = [];
  let tasks: TodoistTask[] = [];

  try {
    tasks = await fetchTodayTasks(deps.todoistToken, 5);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    date: new Date(),
    calendarEvents: [],
    tasks,
    currentReading: [],
    recommendedFocus: null,
    energy: deps.energy,
    errors,
  };
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
