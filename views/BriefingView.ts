import { ItemView, WorkspaceLeaf, Notice, TFile, normalizePath } from "obsidian";
import type MorningBriefingPlugin from "../main";
import {
  BriefingContext,
  generateMorningBriefing,
  todayKey,
  formatHumanDate,
} from "../briefing/generator";
import { formatBriefingCallout } from "../briefing/formatter";
import { priorityLabel } from "../sources/todoist";

export const VIEW_TYPE_BRIEFING = "morning-briefing-view";

type EnergyLevel = "low" | "medium" | "high";

export class BriefingView extends ItemView {
  private context: BriefingContext | null = null;
  private loading = false;

  constructor(leaf: WorkspaceLeaf, private plugin: MorningBriefingPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_BRIEFING;
  }

  getDisplayText(): string {
    return "Morning Briefing";
  }

  getIcon(): string {
    return "sun";
  }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.addClass("mb-view");
    await this.refresh();
  }

  async onClose() {
    // nothing to clean up yet
  }

  private async refresh() {
    if (this.loading) return;
    this.loading = true;
    this.render();
    this.context = await generateMorningBriefing({
      todoistToken: this.plugin.settings.todoistToken,
      energy: this.currentEnergy(),
    });
    this.loading = false;
    this.render();
  }

  private currentEnergy(): EnergyLevel | null {
    const entry = this.plugin.settings.energyLog[todayKey()];
    return entry?.morning ?? null;
  }

  private async setEnergy(level: EnergyLevel) {
    const key = todayKey();
    const existing = this.plugin.settings.energyLog[key] ?? { morning: null, evening: null };
    existing.morning = level;
    this.plugin.settings.energyLog[key] = existing;
    await this.plugin.saveSettings();
    if (this.context) this.context.energy = level;
    this.render();
  }

  private render() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();

    const header = root.createDiv({ cls: "mb-header" });
    header.createEl("h2", { text: "☀️ Morning Briefing" });
    header.createSpan({ cls: "mb-date", text: formatHumanDate(new Date()) });

    this.renderEnergySection(root);

    if (this.loading && !this.context) {
      root.createDiv({ cls: "mb-empty", text: "Loading briefing…" });
      return;
    }

    const ctx = this.context;
    if (!ctx) return;

    this.renderCalendarSection(root, ctx);
    this.renderTaskSection(root, ctx);
    this.renderReadingSection(root, ctx);
    this.renderFocusSection(root, ctx);

    if (ctx.errors.length > 0) {
      const errBox = root.createDiv({ cls: "mb-section" });
      errBox.createEl("h3", { text: "Issues" });
      const ul = errBox.createEl("ul", { cls: "mb-list" });
      for (const e of ctx.errors) ul.createEl("li", { cls: "mb-error", text: e });
    }

    this.renderActions(root);
  }

  private renderEnergySection(root: HTMLElement) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "⚡ Energy check-in" });
    const pills = section.createDiv({ cls: "mb-energy" });
    const current = this.currentEnergy();
    const levels: { level: EnergyLevel; label: string }[] = [
      { level: "low", label: "Low" },
      { level: "medium", label: "Medium" },
      { level: "high", label: "High" },
    ];
    for (const { level, label } of levels) {
      const btn = pills.createEl("button", { cls: "mb-pill", text: label });
      if (current === level) btn.addClass("is-selected");
      btn.onclick = () => this.setEnergy(level);
    }
  }

  private renderCalendarSection(root: HTMLElement, ctx: BriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "📅 Today's calendar" });
    if (ctx.calendarEvents.length === 0) {
      section.createDiv({ cls: "mb-empty", text: "Calendar wiring lands in Session 2." });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list" });
    for (const ev of ctx.calendarEvents) {
      ul.createEl("li", { text: `${ev.start} ${ev.summary}` });
    }
  }

  private renderTaskSection(root: HTMLElement, ctx: BriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "✅ Top tasks due today" });
    if (ctx.tasks.length === 0 && ctx.errors.length === 0) {
      section.createDiv({ cls: "mb-empty", text: "Nothing due today." });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list" });
    for (const t of ctx.tasks) {
      const li = ul.createEl("li");
      if (t.isOverdue) li.createSpan({ cls: "mb-overdue", text: "⚠️" });
      li.appendText(` ${t.content}`);
      const meta = li.createSpan({ cls: "mb-task-meta" });
      const label = priorityLabel(t.priority);
      meta.addClass(`mb-priority-${label}`);
      meta.setText(` — ${t.projectName} · ${label}`);
    }
  }

  private renderReadingSection(root: HTMLElement, ctx: BriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "📚 Current reading" });
    if (ctx.currentReading.length === 0) {
      section.createDiv({
        cls: "mb-empty",
        text: "Vault reader lands when Atlas/Sources is wired.",
      });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list" });
    for (const r of ctx.currentReading) {
      ul.createEl("li", {
        text: `${r.title} by ${r.author}${r.genre ? ` — ${r.genre}` : ""}`,
      });
    }
  }

  private renderFocusSection(root: HTMLElement, ctx: BriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "🎯 Recommended first focus" });
    section.createDiv({
      cls: ctx.recommendedFocus ? "" : "mb-empty",
      text: ctx.recommendedFocus ?? "Groq recommendation lands in Session 4.",
    });
  }

  private renderActions(root: HTMLElement) {
    const actions = root.createDiv({ cls: "mb-actions" });
    const refreshBtn = actions.createEl("button", { text: "🔄 Refresh" });
    refreshBtn.onclick = () => this.refresh();

    const appendBtn = actions.createEl("button", { text: "📋 Append to today's note" });
    appendBtn.onclick = () => this.appendToTodayNote();
  }

  private async appendToTodayNote() {
    if (!this.context) {
      new Notice("Briefing not ready yet.");
      return;
    }
    const path = this.resolveDailyNotePath();
    const callout = formatBriefingCallout(this.context);
    try {
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        const current = await this.app.vault.read(existing);
        const sep = current.endsWith("\n") ? "\n" : "\n\n";
        await this.app.vault.modify(existing, current + sep + callout);
      } else {
        // Ensure parent folder exists, then create the daily note.
        const parent = path.split("/").slice(0, -1).join("/");
        if (parent && !this.app.vault.getAbstractFileByPath(parent)) {
          await this.app.vault.createFolder(parent);
        }
        await this.app.vault.create(path, callout);
      }
      new Notice(`Appended to ${path}`);
    } catch (err) {
      new Notice(`Failed to append: ${err instanceof Error ? err.message : err}`);
    }
  }

  private resolveDailyNotePath(): string {
    const template = this.plugin.settings.dailyNotePath || "Daily Notes/YYYY-MM-DD";
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const resolved = template
      .replace(/YYYY/g, yyyy)
      .replace(/MM/g, mm)
      .replace(/DD/g, dd);
    const withExt = resolved.endsWith(".md") ? resolved : `${resolved}.md`;
    return normalizePath(withExt);
  }
}
