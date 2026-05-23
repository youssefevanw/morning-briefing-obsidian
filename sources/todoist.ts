import { requestUrl } from "obsidian";

const TODOIST_BASE = "https://api.todoist.com/rest/v2";

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
    get<RawTask[]>("/tasks?filter=" + encodeURIComponent("(today | overdue)"), token),
    get<RawProject[]>("/projects", token),
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
