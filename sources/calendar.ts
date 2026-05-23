import { readFocusFoxStore, FocusFoxCalEvent } from "./focusfox";

export interface CalendarEvent {
  start: Date;
  end: Date;
  summary: string;
  displayTime: string;   // pre-formatted local time, e.g. "9:30 AM"
}

function isSameLocalDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export async function fetchTodayEvents(storePath: string, now: Date = new Date()): Promise<CalendarEvent[]> {
  const store = await readFocusFoxStore(storePath);
  const raw = (store.ft9_cal ?? []) as FocusFoxCalEvent[];

  const events: CalendarEvent[] = [];
  for (const ev of raw) {
    if (!ev?.start || !ev?.summary) continue;
    const start = new Date(ev.start);
    const end = new Date(ev.end ?? ev.start);
    if (Number.isNaN(start.getTime())) continue;
    if (!isSameLocalDate(start, now)) continue;
    events.push({
      start,
      end,
      summary: ev.summary,
      displayTime: formatTime(start),
    });
  }

  events.sort((a, b) => a.start.getTime() - b.start.getTime());
  return events;
}
