import { todayKey } from "./briefing/generator";
import type MorningBriefingPlugin from "./main";

const CHECK_INTERVAL_MS = 60 * 1000;

type Slot = "morning" | "evening";

// Parses "HH:MM" (24h). Returns null if malformed so the scheduler can no-op
// instead of firing at an unintended time.
function parseTime(hhmm: string): { h: number; m: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function isPastTriggerToday(now: Date, hhmm: string): boolean {
  const t = parseTime(hhmm);
  if (!t) return false;
  const trigger = new Date(now);
  trigger.setHours(t.h, t.m, 0, 0);
  return now.getTime() >= trigger.getTime();
}

export interface SchedulerCallbacks {
  onMorningTrigger: () => Promise<void> | void;
  onEveningTrigger: () => Promise<void> | void;
}

export function startScheduler(plugin: MorningBriefingPlugin, callbacks: SchedulerCallbacks): void {
  const check = async () => {
    if (!plugin.settings.autoGenerate) return;
    const now = new Date();
    const today = todayKey(now);

    if (
      plugin.settings.lastMorningGenerated !== today &&
      isPastTriggerToday(now, plugin.settings.morningTime)
    ) {
      await fire("morning", plugin, today, callbacks.onMorningTrigger);
    }

    if (
      plugin.settings.lastEveningGenerated !== today &&
      isPastTriggerToday(now, plugin.settings.eveningTime)
    ) {
      await fire("evening", plugin, today, callbacks.onEveningTrigger);
    }
  };

  // Run once immediately so a plugin load past the trigger time catches up.
  void check();

  plugin.registerInterval(window.setInterval(() => void check(), CHECK_INTERVAL_MS));
}

async function fire(
  slot: Slot,
  plugin: MorningBriefingPlugin,
  todayStr: string,
  cb: () => Promise<void> | void
): Promise<void> {
  // Mark as generated *before* awaiting the callback so a slow refresh can't
  // race a second tick into firing twice.
  if (slot === "morning") plugin.settings.lastMorningGenerated = todayStr;
  else plugin.settings.lastEveningGenerated = todayStr;
  await plugin.saveSettings();

  try {
    await cb();
  } catch (err) {
    console.error(`[morning-briefing] ${slot} trigger failed:`, err);
  }
}
