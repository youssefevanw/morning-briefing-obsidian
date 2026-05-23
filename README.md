# Morning Briefing 🌅

An Obsidian plugin that generates structured daily briefings — morning and evening — pulling from Todoist, Google Calendar (via Focus Fox), Focus Fox session data, and your vault. Embeds in an Obsidian Canvas as two persistent cards.

---

## What It Does

Opens a leaf view panel inside Obsidian with two briefings per day:

**Morning** — auto-generates at a configurable time (default 7:00am):
- Energy check-in (Low / Medium / High)
- Today's calendar events (from Focus Fox's Google Calendar sync)
- Top tasks due today, with overdue flagged
- Current book in progress
- One AI-recommended focus block, calibrated to your energy level and what's due

**Evening** — auto-generates at a configurable time (default 9:00pm):
- End-of-day energy check-in
- Focus session summary from Focus Fox (total time, sessions, top project)
- Tasks completed today
- Still-open tasks
- Rotating reflection prompt

Both briefings have a **Refresh** button and an **Append to today's note** button. No autonomous vault writes — you control what lands in your daily note.

---

## Features

- Auto-generates on schedule; manual refresh available at any time
- Energy logging per day (morning + evening) stored in plugin settings
- AI focus recommendation via Groq (`llama-3.3-70b-versatile`) — informed by energy level, calendar, and task priority
- Rotating reflection prompts (7-question cycle)
- Collapsible callout appended to daily note on demand
- Canvas-compatible: plugin writes `briefing-morning.md` and `briefing-evening.md` to the vault for embedding as Canvas cards
- Interactive controls (refresh, append, energy selection) live in the sidebar leaf view

---

## Data Sources

| Source | What it provides |
|---|---|
| **Todoist** | Tasks due today, overdue tasks, completed tasks |
| **Focus Fox** (`store.json`) | Session log, Google Calendar events, current project |
| **Obsidian vault** | Current book in progress (`Atlas/Sources`) |
| **Groq API** | Focus recommendation + reflection prompt |

Google Calendar data is read from Focus Fox's `store.json` (`ft9_cal`) — no separate OAuth setup required if Focus Fox is already connected.

---

## Canvas Integration

The plugin writes two markdown files after each generation:
- `Daily Notes/briefing-morning.md`
- `Daily Notes/briefing-evening.md`

Embed these as file cards in your Obsidian Canvas for a persistent at-a-glance dashboard. The leaf view panel provides the interactive version (refresh, append, energy logging).

---

## Installation

This plugin is not in the Obsidian community registry. Install manually:

1. Download `main.js` and `manifest.json` from the latest release
2. Copy both files to `[vault]/.obsidian/plugins/morning-briefing/`
3. Enable the plugin in Settings → Community plugins

For development, install via [BRAT](https://github.com/TfTHacker/obsidian42-brat):
1. Install BRAT from the community plugins registry
2. Add `youssefevanw/morning-briefing-obsidian` as a beta plugin

---

## Setup

Go to Settings → Morning Briefing and configure:

| Setting | Description | Default |
|---|---|---|
| Todoist API token | From todoist.com/app/settings/integrations | — |
| Groq API key | From console.groq.com | — |
| Focus Fox store path | Path to Focus Fox's store.json | `~/Library/Application Support/focus-fox/store.json` |
| Morning briefing time | When to auto-generate | `07:00` |
| Evening briefing time | When to auto-generate | `21:00` |
| Auto-generate | Enable/disable scheduled generation | On |
| Daily note path | Format for daily note filenames | `Daily Notes/YYYY-MM-DD` |
| Morning briefing note | Vault path for Canvas card | `Daily Notes/briefing-morning` |
| Evening briefing note | Vault path for Canvas card | `Daily Notes/briefing-evening` |

---

## Daily Note Output

Appending a briefing adds a collapsible callout to today's note:

```md
> [!note]- ☀️ Morning Briefing — Friday, May 22
>
> ⚡ Morning energy: Medium
>
> **Today's Calendar**
> - 10:00 Staff meeting
>
> **Top Tasks**
> - Grade unit 3 essays (Teaching, p1)
>
> **Current Reading**
> - Sounding the Sacred by Peter Bouteneff
>
> **Recommended First Focus**
> - Start with essay grading — highest priority, clear morning window
```

---

## Ecosystem

Morning Briefing is part of a personal productivity ecosystem:

| App | Repo | What it does |
|---|---|---|
| Focus Fox | `youssefevanw/focus-fox` | Focus timer, session logging, GCal sync |
| Focus Fox Plugin | `youssefevanw/focus-fox-obsidian` | Timer + session log inside Obsidian |
| Research Hub | `youssefevanw/research-hub` | Research, reading system, Zotero |
| Research Hub Plugin | `youssefevanw/research-hub-obsidian` | Research + books inside Obsidian |
| Morning Briefing | `youssefevanw/morning-briefing-obsidian` | This plugin |

**Planned additions** (stub hooks already in `generator.ts`):
- Music queue section — when `youssefevanw/music-queue` is built
- Language learning streak — when `youssefevanw/language-tracker` is built

---

## Stack

- **Obsidian Plugin API** — leaf view, vault read/write, settings
- **Groq API** — `llama-3.3-70b-versatile` for focus recommendation and reflection prompts
- **Todoist REST API v2** — task data
- **Focus Fox store.json** — session data + Google Calendar events
- All HTTP via Obsidian's `requestUrl` — never `fetch()`

---

## Repo Structure

```
morning-briefing-obsidian/
├── main.ts                  # Plugin entry, leaf view registration, scheduler
├── views/
│   ├── BriefingView.ts      # Morning + evening briefing panel
│   └── SettingsView.ts      # Plugin settings tab
├── sources/
│   ├── todoist.ts           # Todoist REST API v2 client
│   ├── calendar.ts          # GCal reader via Focus Fox store.json
│   ├── focusfox.ts          # Focus Fox store.json reader
│   └── vault.ts             # Obsidian vault note reader
├── briefing/
│   ├── generator.ts         # Context assembly + Groq API call
│   └── formatter.ts         # Markdown rendering
└── manifest.json
```

---

*Built by [youssefevanw](https://github.com/youssefevanw)*
