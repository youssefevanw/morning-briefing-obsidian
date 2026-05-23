import { requestUrl } from "obsidian";
import { TodoistTask, priorityLabel } from "./todoist";
import { CalendarEvent } from "./calendar";
import { formatDurationShort } from "./focussessions";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

const SYSTEM_PROMPT =
  "You are a concise personal planning assistant. Respond in plain text only, " +
  "no markdown. One to two sentences, no preamble.";

export interface FocusRecommendationDeps {
  apiKey: string;
  model: string;
  calendarEvents: CalendarEvent[];
  tasks: TodoistTask[];
  energy: number | null;          // 1..5
  yesterdayFocusSeconds: number;
}

export class GroqError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "GroqError";
  }
}

export async function recommendFocus(deps: FocusRecommendationDeps): Promise<string> {
  if (!deps.apiKey) throw new GroqError("Groq API key is not set in plugin settings.");

  const userPrompt = buildMorningPrompt(deps);
  const res = await requestUrl({
    url: GROQ_ENDPOINT,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deps.apiKey}`,
    },
    body: JSON.stringify({
      model: deps.model || DEFAULT_GROQ_MODEL,
      max_tokens: 200,
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
    throw: false,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new GroqError(`Groq returned ${res.status}: ${res.text}`, res.status);
  }

  const content = res.json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new GroqError("Groq returned an empty response.");
  }
  return content.trim();
}

function buildMorningPrompt(deps: FocusRecommendationDeps): string {
  const lines: string[] = [];

  lines.push("Today's calendar:");
  if (deps.calendarEvents.length === 0) {
    lines.push("- (no events today)");
  } else {
    for (const ev of deps.calendarEvents) {
      lines.push(`- ${ev.displayTime} ${ev.summary}`);
    }
  }
  lines.push("");

  lines.push("Candidate tasks (numbered):");
  const top = deps.tasks.slice(0, 5);
  if (top.length === 0) {
    lines.push("- (nothing due today)");
  } else {
    top.forEach((t, i) => {
      const overdue = t.isOverdue ? ", overdue" : "";
      lines.push(`${i + 1}. ${t.content} (${t.projectName}, ${priorityLabel(t.priority)}${overdue})`);
    });
  }
  const overdueCount = deps.tasks.filter((t) => t.isOverdue).length;
  if (overdueCount > 0) lines.push(`Overdue count: ${overdueCount}`);
  lines.push("");

  if (deps.energy !== null) {
    lines.push(`Morning energy (1 drained, 5 energized): ${deps.energy}/5`);
  }
  lines.push(`Yesterday's focus time: ${formatDurationShort(deps.yesterdayFocusSeconds)}`);
  lines.push("");

  lines.push("PICK ONE task from the numbered list to start with. Energy level is the primary selector — override priority when energy disagrees:");
  lines.push("- Energy 1-2: choose the lightest/shallowest item (admin, email, quick wins). DO NOT lead with deep work even if it's priority p1.");
  lines.push("- Energy 3: choose a medium-effort task — neither the hardest nor the most trivial.");
  lines.push("- Energy 4-5: choose the most cognitively demanding task in the list, typically the highest priority deep work.");
  lines.push("Judge cognitive load from the task name itself (e.g. 'Grade essays' is heavy, 'Reply to parent email' is light), not just the Todoist priority label.");
  lines.push("Also factor: time available before the next calendar block, and whether reducing overdue load matters.");
  lines.push("");
  lines.push("Output: 1-2 sentences naming the chosen task explicitly and why it fits the energy + timing. No preamble.");

  return lines.join("\n");
}
