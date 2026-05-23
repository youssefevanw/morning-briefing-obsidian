import { BriefingContext, formatHumanDate } from "./generator";
import { priorityLabel } from "../sources/todoist";

const energyLabel: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function formatBriefingCallout(ctx: BriefingContext): string {
  const lines: string[] = [];
  const dateStr = formatHumanDate(ctx.date);
  lines.push(`> [!note]- ☀️ Morning Briefing — ${dateStr}`);
  lines.push(`> `);

  if (ctx.energy) {
    lines.push(`> ⚡ **Morning energy:** ${energyLabel[ctx.energy]}`);
    lines.push(`> `);
  }

  lines.push(`> **Today's Calendar**`);
  if (ctx.calendarEvents.length === 0) {
    lines.push(`> - _(calendar wiring lands in Session 2)_`);
  } else {
    for (const ev of ctx.calendarEvents) {
      lines.push(`> - ${ev.start} ${ev.summary}`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Top Tasks**`);
  if (ctx.tasks.length === 0) {
    lines.push(`> - _No tasks due today_`);
  } else {
    for (const t of ctx.tasks) {
      const overdue = t.isOverdue ? "⚠️ " : "";
      lines.push(`> - ${overdue}${t.content} (${t.projectName}, ${priorityLabel(t.priority)})`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Current Reading**`);
  if (ctx.currentReading.length === 0) {
    lines.push(`> - _(vault reader lands when Atlas/Sources is wired)_`);
  } else {
    for (const r of ctx.currentReading) {
      lines.push(`> - ${r.title} by ${r.author}${r.genre ? ` — ${r.genre}` : ""}`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Recommended First Focus**`);
  lines.push(`> - ${ctx.recommendedFocus ?? "_(Groq recommendation lands in Session 4)_"}`);

  return lines.join("\n") + "\n";
}
