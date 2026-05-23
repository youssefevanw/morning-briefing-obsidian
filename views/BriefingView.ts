import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import type MorningBriefingPlugin from "../main";
import {
  BriefingContext,
  MorningBriefingContext,
  EveningBriefingContext,
  Slot,
  formatHumanDate,
  EnergyLevel,
  ENERGY_LEVELS,
  ENERGY_FRONTMATTER_KEY,
} from "../briefing/generator";
import { formatBriefingCallout } from "../briefing/formatter";
import { priorityLabel, completeTask, TodoistTask } from "../sources/todoist";
import { formatDurationShort, FocusStats } from "../sources/focussessions";

export const VIEW_TYPE_BRIEFING = "morning-briefing-view";

const SLOT_HEADER: Record<Slot, { emoji: string; label: string }> = {
  morning: { emoji: "☀️", label: "Morning Briefing" },
  evening: { emoji: "🌙", label: "Evening Briefing" },
};

export class BriefingView extends ItemView {
  private context: BriefingContext | null = null;
  private loading = false;
  // Reflection text the user is typing right now. Ephemeral: lives in memory
  // until they click "Append to today's note". Lost on Obsidian restart.
  private reflectionDraft = "";

  constructor(leaf: WorkspaceLeaf, private plugin: MorningBriefingPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_BRIEFING;
  }

  getDisplayText(): string {
    return "Briefing";
  }

  getIcon(): string {
    return "sun";
  }

  get slot(): Slot {
    return this.plugin.settings.activeSlot;
  }

  async setSlot(slot: Slot): Promise<void> {
    if (this.plugin.settings.activeSlot === slot) return;
    this.plugin.settings.activeSlot = slot;
    await this.plugin.saveSettings();
    this.context = null;       // drop stale slot's data so it doesn't flash
    await this.refresh();
  }

  async onOpen() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.addClass("mb-view");
    // Re-render when today's daily note appears so the gated energy pills
    // become live without needing a manual refresh.
    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file.path === this.plugin.resolveDailyNotePath()) this.render();
      })
    );
    await this.refresh();
  }

  async onClose() {
    // nothing to clean up yet
  }

  async refresh() {
    if (this.loading) return;
    this.loading = true;
    this.render();
    this.context = await this.plugin.generateBriefingForSlot(this.slot);
    this.loading = false;
    this.render();
  }

  // Public hook used by the plugin (scheduler triggers) to push an already-
  // generated context into the view without paying for another generation pass.
  async applyContext(ctx: BriefingContext): Promise<void> {
    this.context = ctx;
    this.loading = false;
    this.render();
  }

  private async setEnergy(level: EnergyLevel) {
    if (this.plugin.settings.requireDailyNoteForEnergy && !this.plugin.dailyNoteExists()) {
      new Notice("Create today's daily note first to log energy.");
      return;
    }
    try {
      const file = await this.plugin.ensureDailyNote();
      const key = ENERGY_FRONTMATTER_KEY[this.slot];
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm[key] = level;
      });
      if (this.context) this.context.energy = level;
      this.render();
    } catch (err) {
      new Notice(`Couldn't save energy: ${err instanceof Error ? err.message : err}`);
    }
  }

  private render() {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();

    this.renderHeader(root);
    this.renderSlotToggle(root);
    this.renderEnergySection(root);

    if (this.loading && !this.context) {
      root.createDiv({ cls: "mb-empty", text: "Loading briefing…" });
      return;
    }

    const ctx = this.context;
    if (!ctx) return;

    if (ctx.slot === "morning") this.renderMorningSections(root, ctx);
    else this.renderEveningSections(root, ctx);

    if (ctx.errors.length > 0) {
      const errBox = root.createDiv({ cls: "mb-section" });
      errBox.createEl("h3", { text: "Issues" });
      const ul = errBox.createEl("ul", { cls: "mb-list" });
      for (const e of ctx.errors) ul.createEl("li", { cls: "mb-error", text: e });
    }

    this.renderActions(root);
  }

  private renderHeader(root: HTMLElement) {
    const header = root.createDiv({ cls: "mb-header" });
    const slotInfo = SLOT_HEADER[this.slot];
    header.createEl("h2", { text: `${slotInfo.emoji} ${slotInfo.label}` });
    header.createSpan({ cls: "mb-date", text: formatHumanDate(new Date()) });
  }

  private renderSlotToggle(root: HTMLElement) {
    const toggle = root.createDiv({ cls: "mb-slot-toggle" });
    const slots: Slot[] = ["morning", "evening"];
    for (const slot of slots) {
      const info = SLOT_HEADER[slot];
      const btn = toggle.createEl("button", {
        cls: "mb-slot-tab",
        text: `${info.emoji} ${slot === "morning" ? "Morning" : "Evening"}`,
      });
      if (slot === this.slot) btn.addClass("is-selected");
      btn.onclick = () => this.setSlot(slot);
    }
  }

  private renderEnergySection(root: HTMLElement) {
    const section = root.createDiv({ cls: "mb-section" });
    const heading = this.slot === "morning" ? "⚡ Energy check-in" : "⚡ End-of-day energy";
    section.createEl("h3", { text: heading });
    const gated =
      this.plugin.settings.requireDailyNoteForEnergy && !this.plugin.dailyNoteExists();

    const pills = section.createDiv({ cls: "mb-energy" });
    if (gated) pills.addClass("is-disabled");
    const current = this.plugin.readEnergyFromFrontmatter(this.slot);
    for (const level of ENERGY_LEVELS) {
      const btn = pills.createEl("button", { cls: "mb-pill mb-pill-num", text: String(level) });
      if (current === level) btn.addClass("is-selected");
      if (gated) {
        btn.disabled = true;
        btn.setAttr("title", "Create today's daily note to log energy");
      } else {
        btn.onclick = () => this.setEnergy(level);
      }
    }
    const scale = section.createDiv({ cls: "mb-energy-scale" });
    scale.createSpan({ text: "drained" });
    scale.createSpan({ text: "energized" });

    if (gated) {
      section.createDiv({
        cls: "mb-empty mb-energy-hint",
        text: "Create today's daily note to log energy.",
      });
    }
  }

  private renderMorningSections(root: HTMLElement, ctx: MorningBriefingContext) {
    this.renderCalendarSection(root, ctx);
    this.renderTaskListSection(root, "✅ Top tasks due today", ctx.tasks, "morning");
    this.renderReadingSection(root, ctx);
    this.renderFocusRecommendation(root, ctx);
  }

  private renderEveningSections(root: HTMLElement, ctx: EveningBriefingContext) {
    this.renderFocusStatsSection(root, ctx.focusStats);
    this.renderCompletedSection(root, ctx);
    this.renderTaskListSection(root, "⚠️ Still open (due today or overdue)", ctx.openTasks, "evening");
    this.renderReflectionSection(root, ctx);
  }

  private renderCalendarSection(root: HTMLElement, ctx: MorningBriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "📅 Today's calendar" });
    if (ctx.calendarEvents.length === 0) {
      section.createDiv({ cls: "mb-empty", text: "No events today." });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list" });
    for (const ev of ctx.calendarEvents) {
      const li = ul.createEl("li", { cls: "mb-event" });
      li.createSpan({ cls: "mb-event-time", text: ev.displayTime });
      li.createSpan({ text: " " + ev.summary });
    }
  }

  private renderTaskListSection(root: HTMLElement, title: string, tasks: TodoistTask[], slot: Slot) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: title });
    if (tasks.length === 0) {
      const empty = slot === "morning" ? "Nothing due today." : "Nothing left open. Nice.";
      section.createDiv({ cls: "mb-empty", text: empty });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list mb-task-list" });
    for (const t of tasks) {
      const li = ul.createEl("li", { cls: "mb-task" });
      const checkbox = li.createEl("button", {
        cls: "mb-checkbox",
        attr: { "aria-label": `Complete: ${t.content}` },
      });
      checkbox.onclick = () => this.completeTaskAt(t.id, checkbox);

      const body = li.createSpan({ cls: "mb-task-body" });
      body.createSpan({ cls: "mb-task-title", text: t.content });
      const meta = body.createSpan({ cls: "mb-task-meta" });
      const label = priorityLabel(t.priority);
      meta.createSpan({ text: ` — ${t.projectName} · ` });
      meta.createSpan({ cls: `mb-priority-${label}`, text: label });
      if (t.isOverdue) {
        meta.createSpan({ text: " · " });
        meta.createSpan({ cls: "mb-overdue-tag", text: "overdue" });
      }
    }
  }

  private async completeTaskAt(taskId: string, btn: HTMLButtonElement) {
    if (!this.context) return;
    btn.disabled = true;
    btn.addClass("is-completing");
    try {
      await completeTask(this.plugin.settings.todoistToken, taskId);
      const ctx = this.context;
      const list = ctx.slot === "morning" ? ctx.tasks : ctx.openTasks;
      const task = list.find((t) => t.id === taskId);
      const filtered = list.filter((t) => t.id !== taskId);
      if (ctx.slot === "morning") ctx.tasks = filtered;
      else ctx.openTasks = filtered;
      this.render();
      if (task) new Notice(`Completed: ${task.content}`);
    } catch (err) {
      btn.disabled = false;
      btn.removeClass("is-completing");
      new Notice(`Couldn't complete task: ${err instanceof Error ? err.message : err}`);
    }
  }

  private renderReadingSection(root: HTMLElement, ctx: MorningBriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "📚 Current reading" });
    if (ctx.currentReading.length === 0) {
      section.createDiv({
        cls: "mb-empty",
        text: "No books marked Status: inprogress.",
      });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list" });
    for (const r of ctx.currentReading) {
      const li = ul.createEl("li");
      const link = li.createEl("a", {
        cls: "mb-reading-link",
        text: r.title,
      });
      link.onclick = (ev) => {
        ev.preventDefault();
        this.app.workspace.openLinkText(r.filePath, "", false);
      };
      const meta = r.author || r.genre ? li.createSpan({ cls: "mb-task-meta" }) : null;
      if (meta) {
        if (r.author) meta.appendText(` by ${r.author}`);
        if (r.genre) meta.appendText(` — ${r.genre}`);
      }
    }
  }

  private renderFocusRecommendation(root: HTMLElement, ctx: MorningBriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "🎯 Recommended first focus" });
    if (ctx.recommendedFocus) {
      section.createDiv({ text: ctx.recommendedFocus });
      return;
    }
    const placeholder = this.plugin.settings.groqApiKey
      ? "No recommendation available right now."
      : "Add a Groq API key in settings to enable focus recommendations.";
    section.createDiv({ cls: "mb-empty", text: placeholder });
  }

  private renderFocusStatsSection(root: HTMLElement, stats: FocusStats) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "⏱ Today's focus" });
    if (stats.sessionCount === 0) {
      section.createDiv({ cls: "mb-empty", text: "No focus sessions logged yet today." });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list" });
    ul.createEl("li", { text: `Total: ${formatDurationShort(stats.totalSeconds)} across ${stats.sessionCount} session${stats.sessionCount === 1 ? "" : "s"}` });
    if (stats.topProject) {
      const topSeconds = stats.projectTotals[0]?.seconds ?? 0;
      ul.createEl("li", {
        text: `Top project: ${stats.topProject} (${formatDurationShort(topSeconds)})`,
      });
    }
    if (stats.projectTotals.length > 1) {
      const rest = stats.projectTotals
        .slice(1, 4)
        .map((p) => `${p.project} ${formatDurationShort(p.seconds)}`)
        .join(" · ");
      if (rest) ul.createEl("li", { cls: "mb-task-meta", text: rest });
    }
  }

  private renderCompletedSection(root: HTMLElement, ctx: EveningBriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "✅ Tasks completed today" });
    if (ctx.completedTasks.length === 0) {
      section.createDiv({ cls: "mb-empty", text: "No tasks closed yet today." });
      return;
    }
    const ul = section.createEl("ul", { cls: "mb-list" });
    for (const t of ctx.completedTasks) {
      const li = ul.createEl("li", { cls: "mb-completed-task" });
      li.createSpan({ text: t.content });
      li.createSpan({ cls: "mb-task-meta", text: ` — ${t.projectName}` });
    }
  }

  private renderReflectionSection(root: HTMLElement, ctx: EveningBriefingContext) {
    const section = root.createDiv({ cls: "mb-section" });
    section.createEl("h3", { text: "💭 Reflection" });
    section.createDiv({ cls: "mb-reflection-prompt", text: ctx.reflectionPrompt });

    const textarea = section.createEl("textarea", { cls: "mb-reflection-input" });
    textarea.placeholder = "Type your reflection… (saved only when you append to today's note)";
    textarea.value = this.reflectionDraft;
    textarea.addEventListener("input", () => {
      this.reflectionDraft = textarea.value;
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
    const callout = formatBriefingCallout(this.context, {
      reflectionAnswer: this.reflectionDraft,
    });
    try {
      const file = await this.plugin.ensureDailyNote();
      const current = await this.app.vault.read(file);
      const sep = current.length === 0 ? "" : current.endsWith("\n") ? "\n" : "\n\n";
      await this.app.vault.modify(file, current + sep + callout);
      new Notice(`Appended to ${file.path}`);
    } catch (err) {
      new Notice(`Failed to append: ${err instanceof Error ? err.message : err}`);
    }
  }
}
