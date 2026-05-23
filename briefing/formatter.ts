import {
  BriefingContext,
  EveningBriefingContext,
  MorningBriefingContext,
  formatHumanDate,
} from "./generator";
import { priorityLabel } from "../sources/todoist";
import { formatDurationShort } from "../sources/focussessions";
import { formatReadingItem } from "../sources/reading";

export interface FormatOptions {
  reflectionAnswer?: string;
}

export function formatBriefingCallout(ctx: BriefingContext, opts: FormatOptions = {}): string {
  return ctx.slot === "morning"
    ? formatMorningCallout(ctx)
    : formatEveningCallout(ctx, opts.reflectionAnswer ?? "");
}

// Plain markdown version of the briefing, written to a fixed-path note that
// can be embedded as a Canvas card. The user-facing file is overwritten on
// every refresh — do not edit it by hand.
export function formatBriefingNote(ctx: BriefingContext): string {
  return ctx.slot === "morning" ? formatMorningNote(ctx) : formatEveningNote(ctx);
}

function formatMorningCallout(ctx: MorningBriefingContext): string {
  const lines: string[] = [];
  const dateStr = formatHumanDate(ctx.date);
  lines.push(`> [!note]- ☀️ Morning Briefing — ${dateStr}`);
  lines.push(`> `);

  if (ctx.energy !== null) {
    lines.push(`> ⚡ **Morning energy:** ${ctx.energy}/5`);
    lines.push(`> `);
  }

  lines.push(`> **Today's Calendar**`);
  if (ctx.calendarEvents.length === 0) {
    lines.push(`> - _No events today_`);
  } else {
    for (const ev of ctx.calendarEvents) {
      lines.push(`> - ${ev.displayTime} ${ev.summary}`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Top Tasks**`);
  if (ctx.tasks.length === 0) {
    lines.push(`> - _No tasks due today_`);
  } else {
    for (const t of ctx.tasks) {
      const suffix = t.isOverdue ? ", overdue" : "";
      lines.push(`> - ${t.content} (${t.projectName}, ${priorityLabel(t.priority)}${suffix})`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Current Reading**`);
  if (ctx.currentReading.length === 0) {
    lines.push(`> - _No books in progress_`);
  } else {
    for (const r of ctx.currentReading) {
      lines.push(`> - ${formatReadingItem(r)}`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Recommended First Focus**`);
  lines.push(`> - ${ctx.recommendedFocus ?? "_(Groq recommendation lands in Session 4)_"}`);

  return lines.join("\n") + "\n";
}

function formatEveningCallout(ctx: EveningBriefingContext, reflectionAnswer: string): string {
  const lines: string[] = [];
  const dateStr = formatHumanDate(ctx.date);
  lines.push(`> [!note]- 🌙 Evening Briefing — ${dateStr}`);
  lines.push(`> `);

  if (ctx.energy !== null) {
    lines.push(`> ⚡ **End-of-day energy:** ${ctx.energy}/5`);
    lines.push(`> `);
  }

  lines.push(`> **Today's Focus**`);
  if (ctx.focusStats.sessionCount === 0) {
    lines.push(`> - _No focus sessions logged_`);
  } else {
    lines.push(
      `> - Total: ${formatDurationShort(ctx.focusStats.totalSeconds)} across ${ctx.focusStats.sessionCount} session${ctx.focusStats.sessionCount === 1 ? "" : "s"}`
    );
    if (ctx.focusStats.topProject) {
      const topSeconds = ctx.focusStats.projectTotals[0]?.seconds ?? 0;
      lines.push(`> - Top project: ${ctx.focusStats.topProject} (${formatDurationShort(topSeconds)})`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Completed Today**`);
  if (ctx.completedTasks.length === 0) {
    lines.push(`> - _No tasks closed yet today_`);
  } else {
    for (const t of ctx.completedTasks) {
      lines.push(`> - ${t.content} (${t.projectName})`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Still Open**`);
  if (ctx.openTasks.length === 0) {
    lines.push(`> - _Nothing left open_`);
  } else {
    for (const t of ctx.openTasks) {
      const suffix = t.isOverdue ? ", overdue" : "";
      lines.push(`> - ${t.content} (${t.projectName}, ${priorityLabel(t.priority)}${suffix})`);
    }
  }
  lines.push(`> `);

  lines.push(`> **Reflection**`);
  lines.push(`> - ${ctx.reflectionPrompt}`);
  const trimmed = reflectionAnswer.trim();
  if (trimmed.length > 0) {
    // Indent each answer line under the bullet, keeping the callout block intact.
    for (const answerLine of trimmed.split(/\r?\n/)) {
      lines.push(`>     ${answerLine}`);
    }
  }

  return lines.join("\n") + "\n";
}

function formatMorningNote(ctx: MorningBriefingContext): string {
  const lines: string[] = [];
  lines.push(`**☀️ Morning Briefing — ${formatHumanDate(ctx.date)}**`);
  lines.push("");
  if (ctx.energy !== null) {
    lines.push(`⚡ Energy: ${ctx.energy}/5`);
    lines.push("");
  }

  lines.push("### 📅 Today's Calendar");
  if (ctx.calendarEvents.length === 0) {
    lines.push("- _No events today_");
  } else {
    for (const ev of ctx.calendarEvents) {
      lines.push(`- ${ev.displayTime} ${ev.summary}`);
    }
  }
  lines.push("");

  lines.push("### ✅ Top Tasks");
  if (ctx.tasks.length === 0) {
    lines.push("- _Nothing due today_");
  } else {
    for (const t of ctx.tasks) {
      const suffix = t.isOverdue ? ", overdue" : "";
      lines.push(`- ${t.content} (${t.projectName}, ${priorityLabel(t.priority)}${suffix})`);
    }
  }
  lines.push("");

  lines.push("### 📚 Current Reading");
  if (ctx.currentReading.length === 0) {
    lines.push("_No books in progress_");
  } else {
    for (const r of ctx.currentReading) {
      lines.push(`- ${formatReadingItem(r)}`);
    }
  }
  lines.push("");

  lines.push("### 🎯 Recommended First Focus");
  lines.push(ctx.recommendedFocus ?? "_(no recommendation)_");
  lines.push("");

  return lines.join("\n");
}

function formatEveningNote(ctx: EveningBriefingContext): string {
  const lines: string[] = [];
  lines.push(`**🌙 Evening Briefing — ${formatHumanDate(ctx.date)}**`);
  lines.push("");
  if (ctx.energy !== null) {
    lines.push(`⚡ Energy: ${ctx.energy}/5`);
    lines.push("");
  }

  lines.push("### ⏱ Today's Focus");
  if (ctx.focusStats.sessionCount === 0) {
    lines.push("- _No focus sessions logged_");
  } else {
    lines.push(
      `- Total: ${formatDurationShort(ctx.focusStats.totalSeconds)} across ${ctx.focusStats.sessionCount} session${ctx.focusStats.sessionCount === 1 ? "" : "s"}`
    );
    if (ctx.focusStats.topProject) {
      const topSeconds = ctx.focusStats.projectTotals[0]?.seconds ?? 0;
      lines.push(`- Top project: ${ctx.focusStats.topProject} (${formatDurationShort(topSeconds)})`);
    }
  }
  lines.push("");

  lines.push("### ✅ Completed Today");
  if (ctx.completedTasks.length === 0) {
    lines.push("- _No tasks closed yet_");
  } else {
    for (const t of ctx.completedTasks) {
      lines.push(`- ${t.content} (${t.projectName})`);
    }
  }
  lines.push("");

  lines.push("### ⚠️ Still Open");
  if (ctx.openTasks.length === 0) {
    lines.push("- _Nothing left open_");
  } else {
    for (const t of ctx.openTasks) {
      const suffix = t.isOverdue ? ", overdue" : "";
      lines.push(`- ${t.content} (${t.projectName}, ${priorityLabel(t.priority)}${suffix})`);
    }
  }
  lines.push("");

  lines.push("### 💭 Reflection");
  lines.push(ctx.reflectionPrompt);
  lines.push("");

  return lines.join("\n");
}
