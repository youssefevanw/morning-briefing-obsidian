import { App, PluginSettingTab, Setting } from "obsidian";
import type MorningBriefingPlugin from "../main";
import { DEFAULT_GROQ_MODEL } from "../sources/groq";

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
      .setName("Groq API key")
      .setDesc("Powers the morning focus recommendation. Leave blank to disable.")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("paste key")
          .setValue(this.plugin.settings.groqApiKey)
          .onChange(async (value) => {
            this.plugin.settings.groqApiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Groq model")
      .setDesc("Chat completions model. Defaults to llama-3.3-70b-versatile.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_GROQ_MODEL)
          .setValue(this.plugin.settings.groqModel)
          .onChange(async (value) => {
            this.plugin.settings.groqModel = value.trim() || DEFAULT_GROQ_MODEL;
            await this.plugin.saveSettings();
          })
      );

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
      .setDesc("HH:MM (24h). Evening view lands in Session 3.")
      .addText((text) =>
        text
          .setPlaceholder("21:00")
          .setValue(this.plugin.settings.eveningTime)
          .onChange(async (value) => {
            this.plugin.settings.eveningTime = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Require daily note before logging energy")
      .setDesc("When on, the energy pills are inert until today's daily note exists. When off, clicking a pill creates the daily note (frontmatter only).")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.requireDailyNoteForEnergy).onChange(async (value) => {
          this.plugin.settings.requireDailyNoteForEnergy = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Auto-generate at trigger times")
      .setDesc("When off, briefings are only generated when you click Refresh or open the panel.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoGenerate).onChange(async (value) => {
          this.plugin.settings.autoGenerate = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Write briefing notes for Canvas")
      .setDesc("Mirror each refresh into a fixed-path note so Canvas cards can embed it. Off = no extra files written.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.writeBriefingNotes).onChange(async (value) => {
          this.plugin.settings.writeBriefingNotes = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Morning briefing note path")
      .setDesc("Path of the markdown file that mirrors the morning briefing. Leave blank to disable just morning.")
      .addText((text) =>
        text
          .setPlaceholder("Daily Notes/briefing-morning")
          .setValue(this.plugin.settings.briefingMorningNote)
          .onChange(async (value) => {
            this.plugin.settings.briefingMorningNote = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Evening briefing note path")
      .setDesc("Path of the markdown file that mirrors the evening briefing. Leave blank to disable just evening.")
      .addText((text) =>
        text
          .setPlaceholder("Daily Notes/briefing-evening")
          .setValue(this.plugin.settings.briefingEveningNote)
          .onChange(async (value) => {
            this.plugin.settings.briefingEveningNote = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Focus Fox store.json path")
      .setDesc("Where to read calendar events from. ~ expands to your home directory.")
      .addText((text) =>
        text
          .setPlaceholder("~/Library/Application Support/focus-fox/store.json")
          .setValue(this.plugin.settings.focusFoxStorePath)
          .onChange(async (value) => {
            this.plugin.settings.focusFoxStorePath = value.trim() || this.plugin.settings.focusFoxStorePath;
            await this.plugin.saveSettings();
          })
      );
  }
}
