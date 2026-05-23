import { Plugin, WorkspaceLeaf } from "obsidian";
import { BriefingView, VIEW_TYPE_BRIEFING } from "./views/BriefingView";
import { BriefingSettingTab } from "./views/SettingsTab";

export interface EnergyEntry {
  morning: "low" | "medium" | "high" | null;
  evening: "low" | "medium" | "high" | null;
}

export interface MorningBriefingSettings {
  todoistToken: string;
  groqApiKey: string;
  morningTime: string;
  eveningTime: string;
  autoGenerate: boolean;
  dailyNotePath: string;
  briefingMorningNote: string;
  briefingEveningNote: string;
  focusFoxStorePath: string;
  lastMorningGenerated: string;
  lastEveningGenerated: string;
  reflectionIndex: number;
  energyLog: Record<string, EnergyEntry>;
}

const DEFAULT_SETTINGS: MorningBriefingSettings = {
  todoistToken: "",
  groqApiKey: "",
  morningTime: "07:00",
  eveningTime: "21:00",
  autoGenerate: true,
  dailyNotePath: "Daily Notes/YYYY-MM-DD",
  briefingMorningNote: "Daily Notes/briefing-morning",
  briefingEveningNote: "Daily Notes/briefing-evening",
  focusFoxStorePath: "~/Library/Application Support/focus-fox/store.json",
  lastMorningGenerated: "",
  lastEveningGenerated: "",
  reflectionIndex: 0,
  energyLog: {},
};

export default class MorningBriefingPlugin extends Plugin {
  settings: MorningBriefingSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_BRIEFING, (leaf) => new BriefingView(leaf, this));

    this.addRibbonIcon("sun", "Open morning briefing", () => this.activateView());

    this.addCommand({
      id: "open-morning-briefing",
      name: "Open morning briefing",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new BriefingSettingTab(this.app, this));
  }

  async onunload() {
    // Obsidian unregisters views automatically on unload; nothing manual yet.
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.energyLog) this.settings.energyLog = {};
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_BRIEFING)[0];
    if (existing) {
      workspace.revealLeaf(existing);
      return;
    }
    const leaf: WorkspaceLeaf | null =
      workspace.getRightLeaf(false) ?? workspace.getLeaf(true);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE_BRIEFING, active: true });
    workspace.revealLeaf(leaf);
  }
}
