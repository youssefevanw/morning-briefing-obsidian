import { App, PluginSettingTab, Setting } from "obsidian";
import type MorningBriefingPlugin from "../main";

export class BriefingSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: MorningBriefingPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Morning Briefing" });

    new Setting(containerEl)
      .setName("Todoist API token")
      .setDesc("Personal API token from Todoist → Settings → Integrations → Developer.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("paste token")
          .setValue(this.plugin.settings.todoistToken)
          .onChange(async (value) => {
            this.plugin.settings.todoistToken = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Daily note path")
      .setDesc("Path template for today's note. Use YYYY, MM, DD as placeholders.")
      .addText((text) =>
        text
          .setPlaceholder("Daily Notes/YYYY-MM-DD")
          .setValue(this.plugin.settings.dailyNotePath)
          .onChange(async (value) => {
            this.plugin.settings.dailyNotePath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Morning trigger time")
      .setDesc("HH:MM (24h). Used by the scheduler in Session 2.")
      .addText((text) =>
        text
          .setPlaceholder("07:00")
          .setValue(this.plugin.settings.morningTime)
          .onChange(async (value) => {
            this.plugin.settings.morningTime = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Evening trigger time")
      .setDesc("HH:MM (24h). Used by the scheduler in Session 2.")
      .addText((text) =>
        text
          .setPlaceholder("21:00")
          .setValue(this.plugin.settings.eveningTime)
          .onChange(async (value) => {
            this.plugin.settings.eveningTime = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
