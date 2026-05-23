import { Notice, Plugin, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { BriefingView, VIEW_TYPE_BRIEFING } from "./views/BriefingView";
import { BriefingSettingTab } from "./views/SettingsTab";
import { startScheduler } from "./scheduler";
import {
  BriefingContext,
  ENERGY_FRONTMATTER_KEY,
  EnergyLevel,
  Slot,
  generateEveningBriefing,
  generateMorningBriefing,
  isEnergyLevel,
  pickAndAdvanceReflectionPrompt,
  todayKey,
} from "./briefing/generator";
import { formatBriefingNote } from "./briefing/formatter";
import { DEFAULT_GROQ_MODEL } from "./sources/groq";

export interface MorningBriefingSettings {
  todoistToken: string;
  groqApiKey: string;
  groqModel: string;
  morningTime: string;
  eveningTime: string;
  autoGenerate: boolean;
  dailyNotePath: string;
  briefingMorningNote: string;
  briefingEveningNote: string;
  focusFoxStorePath: string;
  writeBriefingNotes: boolean;
  requireDailyNoteForEnergy: boolean;
  activeSlot: Slot;
  lastMorningGenerated: string;
  lastEveningGenerated: string;
  reflectionIndex: number;
  reflectionLastDate: string;
}

const DEFAULT_SETTINGS: MorningBriefingSettings = {
  todoistToken: "",
  groqApiKey: "",
  groqModel: DEFAULT_GROQ_MODEL,
  morningTime: "07:00",
  eveningTime: "21:00",
  autoGenerate: true,
  dailyNotePath: "Daily Notes/YYYY-MM-DD",
  briefingMorningNote: "Daily Notes/briefing-morning",
  briefingEveningNote: "Daily Notes/briefing-evening",
  focusFoxStorePath: "~/Library/Application Support/focus-fox/store.json",
  writeBriefingNotes: true,
  requireDailyNoteForEnergy: true,
  activeSlot: "morning",
  lastMorningGenerated: "",
  lastEveningGenerated: "",
  reflectionIndex: 0,
  reflectionLastDate: "",
};

export default class MorningBriefingPlugin extends Plugin {
  settings: MorningBriefingSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_BRIEFING, (leaf) => new BriefingView(leaf, this));

    this.addRibbonIcon("sun", "Open briefing", () => this.activateView());

    this.addCommand({
      id: "open-morning-briefing",
      name: "Open morning briefing",
      callback: () => this.activateView("morning"),
    });

    this.addCommand({
      id: "open-evening-briefing",
      name: "Open evening briefing",
      callback: () => this.activateView("evening"),
    });

    this.addSettingTab(new BriefingSettingTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      startScheduler(this, {
        onMorningTrigger: () => this.triggerSlot("morning", "☀️ Morning briefing ready"),
        onEveningTrigger: () => this.triggerSlot("evening", "🌙 Evening briefing ready"),
      });
    });
  }

  async onunload() {
    // Obsidian unregisters views automatically on unload; nothing manual yet.
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // --- Path helpers ---------------------------------------------------------

  resolveDailyNotePath(): string {
    const template = this.settings.dailyNotePath || "Daily Notes/YYYY-MM-DD";
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

  resolveCanvasNotePath(slot: Slot): string | null {
    const template = slot === "morning"
      ? this.settings.briefingMorningNote
      : this.settings.briefingEveningNote;
    if (!template.trim()) return null;
    const withExt = template.endsWith(".md") ? template : `${template}.md`;
    return normalizePath(withExt);
  }

  dailyNoteExists(): boolean {
    return this.app.vault.getAbstractFileByPath(this.resolveDailyNotePath()) instanceof TFile;
  }

  readEnergyFromFrontmatter(slot: Slot): EnergyLevel | null {
    const file = this.app.vault.getAbstractFileByPath(this.resolveDailyNotePath());
    if (!(file instanceof TFile)) return null;
    const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const raw = fm?.[ENERGY_FRONTMATTER_KEY[slot]];
    return isEnergyLevel(raw) ? raw : null;
  }

  async ensureDailyNote(): Promise<TFile> {
    const path = this.resolveDailyNotePath();
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    const parent = path.split("/").slice(0, -1).join("/");
    if (parent && !this.app.vault.getAbstractFileByPath(parent)) {
      await this.app.vault.createFolder(parent);
    }
    return await this.app.vault.create(path, "");
  }

  // --- Briefing generation --------------------------------------------------

  // Single source of truth for producing a briefing context. Called by the
  // view (on open / refresh / slot toggle) and by the scheduler (so the canvas
  // mirror notes stay current even when no view is open).
  async generateBriefingForSlot(slot: Slot): Promise<BriefingContext> {
    const energy = this.readEnergyFromFrontmatter(slot);
    let ctx: BriefingContext;
    if (slot === "morning") {
      ctx = await generateMorningBriefing({
        app: this.app,
        todoistToken: this.settings.todoistToken,
        focusFoxStorePath: this.settings.focusFoxStorePath,
        groqApiKey: this.settings.groqApiKey,
        groqModel: this.settings.groqModel,
        energy,
      });
    } else {
      const prompt = pickAndAdvanceReflectionPrompt(this.settings, todayKey());
      await this.saveSettings();
      ctx = await generateEveningBriefing({
        todoistToken: this.settings.todoistToken,
        focusFoxStorePath: this.settings.focusFoxStorePath,
        energy,
        reflectionPrompt: prompt,
      });
    }
    await this.writeCanvasNote(ctx);
    return ctx;
  }

  async writeCanvasNote(ctx: BriefingContext): Promise<void> {
    if (!this.settings.writeBriefingNotes) return;
    const path = this.resolveCanvasNotePath(ctx.slot);
    if (!path) return;
    const content = formatBriefingNote(ctx);
    try {
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        await this.app.vault.modify(existing, content);
      } else {
        const parent = path.split("/").slice(0, -1).join("/");
        if (parent && !this.app.vault.getAbstractFileByPath(parent)) {
          await this.app.vault.createFolder(parent);
        }
        await this.app.vault.create(path, content);
      }
    } catch (err) {
      new Notice(`Couldn't write ${path}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // --- View coordination ----------------------------------------------------

  // Scheduler entry point. Sets the active slot, generates + writes the canvas
  // mirror, then pushes the context into any open view so the panel matches
  // the just-written canvas card.
  private async triggerSlot(slot: Slot, message: string): Promise<void> {
    this.settings.activeSlot = slot;
    await this.saveSettings();
    const ctx = await this.generateBriefingForSlot(slot);
    for (const view of this.openBriefingViews()) {
      await view.applyContext(ctx);
    }
    new Notice(message);
  }

  // Used by the view's slot toggle to flip slots in any other open views.
  async switchSlotAndRefresh(slot: Slot): Promise<void> {
    this.settings.activeSlot = slot;
    await this.saveSettings();
    for (const view of this.openBriefingViews()) {
      await view.setSlot(slot);
    }
  }

  private openBriefingViews(): BriefingView[] {
    const views: BriefingView[] = [];
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_BRIEFING)) {
      if (leaf.view instanceof BriefingView) views.push(leaf.view);
    }
    return views;
  }

  async activateView(slot?: Slot) {
    if (slot && this.settings.activeSlot !== slot) {
      this.settings.activeSlot = slot;
      await this.saveSettings();
    }
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_BRIEFING)[0];
    if (existing) {
      workspace.revealLeaf(existing);
      if (slot && existing.view instanceof BriefingView) await existing.view.setSlot(slot);
      return;
    }
    const leaf: WorkspaceLeaf | null =
      workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_BRIEFING, active: true });
    workspace.revealLeaf(leaf);
  }
}
