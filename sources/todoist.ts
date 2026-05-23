import { requestUrl } from "obsidian";

// Todoist deprecated REST v2 in 2025; the unified API now lives under /api/v1/
// and wraps list responses in { results, next_cursor }.
const TODOIST_BASE = "https://api.todoist.com/api/v1";
const PAGE_LIMIT = 200;

export interface TodoistTask {
  id: string;
  content: string;
  projectName: string;
  priority: 1 | 2 | 3 | 4;
  dueDate: string | null;
  isOverdue: boolean;
}

interface RawTask {
  id: string;
  content: string;
  project_id: string;
  priority: number;
  due?: { date: string } | null;
}

interface RawProject {
  id: string;
  name: string;
}

interface Paginated<T> {
  results: T[];
  next_cursor: string | null;
}

// Completed-task endpoints wrap the array in `items` instead of `results`.
interface PaginatedItems<T> {
  items: T[];
  next_cursor: string | null;
}

export class TodoistError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "TodoistError";
  }
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await requestUrl({
    url: `${TODOIST_BASE}${path}`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    throw: false,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new TodoistError(`Todoist ${path} returned ${res.status}: ${res.text}`, res.status);
  }
  return res.json as T;
}

export async function completeTask(token: string, id: string): Promise<void> {
  if (!token) throw new TodoistError("Todoist API token is not set in plugin settings.");
  const res = await requestUrl({
    url: `${TODOIST_BASE}/tasks/${encodeURIComponent(id)}/close`,
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    throw: false,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new TodoistError(`Todoist close returned ${res.status}: ${res.text}`, res.status);
  }
}

async function getAllPaged<T>(
  basePath: string,
  token: string,
  extraParams: Record<string, string> = {}
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT), ...extraParams });
    if (cursor) params.set("cursor", cursor);
    const sep = basePath.includes("?") ? "&" : "?";
    const page = await get<Paginated<T>>(`${basePath}${sep}${params.toString()}`, token);
    all.push(...page.results);
    cursor = page.next_cursor;
  } while (cursor);
  return all;
}

async function getAllPagedItems<T>(
  basePath: string,
  token: string,
  extraParams: Record<string, string> = {}
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ limit: String(PAGE_LIMIT), ...extraParams });
    if (cursor) params.set("cursor", cursor);
    const sep = basePath.includes("?") ? "&" : "?";
    const page = await get<PaginatedItems<T>>(`${basePath}${sep}${params.toString()}`, token);
    all.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return all;
}

function todayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export async function fetchTodayTasks(token: string, limit = 5): Promise<TodoistTask[]> {
  if (!token) throw new TodoistError("Todoist API token is not set in plugin settings.");

  const [rawTasks, rawProjects] = await Promise.all([
    getAllPaged<RawTask>("/tasks/filter", token, { query: "(today | overdue)" }),
    getAllPaged<RawProject>("/projects", token),
  ]);

  const projectMap = new Map(rawProjects.map((p) => [p.id, p.name]));
  const today = todayIsoDate();

  const normalized: TodoistTask[] = rawTasks
    .filter((t) => t.due?.date)
    .map((t) => ({
      id: t.id,
      content: t.content,
      projectName: projectMap.get(t.project_id) ?? "Inbox",
      priority: (t.priority as 1 | 2 | 3 | 4) ?? 1,
      dueDate: t.due?.date ?? null,
      isOverdue: !!(t.due?.date && t.due.date < today),
    }));

  // Sort: overdue first, then by priority desc (Todoist priority 4 = highest), then by due date asc.
  normalized.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  });

  return normalized.slice(0, limit);
}

// Maps Todoist priority (1=lowest .. 4=highest) to the user-facing p1..p4 label
// (p1=highest .. p4=lowest), matching how priorities display in the Todoist UI.
export function priorityLabel(p: 1 | 2 | 3 | 4): "p1" | "p2" | "p3" | "p4" {
  return (["p4", "p3", "p2", "p1"] as const)[p - 1];
}

export interface CompletedTask {
  id: string;
  content: string;
  projectName: string;
  completedAt: string | null;
}

interface RawCompletedTask {
  id: string;
  content: string;
  project_id: string;
  completed_at?: string | null;
}

export async function fetchCompletedToday(token: string, limit = 10, now: Date = new Date()): Promise<CompletedTask[]> {
  if (!token) throw new TodoistError("Todoist API token is not set in plugin settings.");

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [rawItems, rawProjects] = await Promise.all([
    getAllPagedItems<RawCompletedTask>("/tasks/completed/by_completion_date", token, {
      since: startOfDay.toISOString(),
      until: endOfDay.toISOString(),
    }),
    getAllPaged<{ id: string; name: string }>("/projects", token),
  ]);

  const projectMap = new Map(rawProjects.map((p) => [p.id, p.name]));

  const completed: CompletedTask[] = rawItems.map((t) => ({
    id: t.id,
    content: t.content,
    projectName: projectMap.get(t.project_id) ?? "Inbox",
    completedAt: t.completed_at ?? null,
  }));

  // Most-recently-completed first, then cap.
  completed.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  return completed.slice(0, limit);
}
