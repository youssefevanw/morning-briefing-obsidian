import { App } from "obsidian";

// Matches the Research Hub plugin's detection so the two views stay in sync.
const SKIP_FOLDER_REGEX = /(^|\/)(\.obsidian|\.trash|\.git|node_modules)(\/|$)/;

export interface ReadingItem {
  title: string;
  author: string;
  genre?: string;
  filePath: string;
  startDate: string;   // YYYY-MM-DD when populated; "" otherwise
}

function isBookFrontmatter(fm: unknown): boolean {
  if (!fm || typeof fm !== "object") return false;
  const obj = fm as Record<string, unknown>;
  const tags = obj.tags;
  if (Array.isArray(tags)) {
    if (tags.some((t) => typeof t === "string" && t.replace(/^#/, "") === "book")) return true;
  } else if (typeof tags === "string") {
    if (tags.replace(/^#/, "") === "book") return true;
  }
  const source = obj.Source;
  if (Array.isArray(source)) {
    if (source.some((s) => typeof s === "string" && s.toLowerCase() === "book")) return true;
  } else if (typeof source === "string") {
    if (source.toLowerCase() === "book") return true;
  }
  return false;
}

function normalizeStatus(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function str(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

// Author and Genre frontmatter can be either a single string or an array
// (collaborations, multi-genre books). Join arrays into a human-readable list.
function strOrJoin(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.length > 0).join(", ");
  }
  return String(value);
}

export function fetchCurrentReading(app: App): ReadingItem[] {
  const items: ReadingItem[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    if (SKIP_FOLDER_REGEX.test(file.path)) continue;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!isBookFrontmatter(fm)) continue;
    if (normalizeStatus(fm?.Status) !== "inprogress") continue;
    const title = str(fm?.Title) || file.basename;
    const author = strOrJoin(fm?.Author);
    const genre = strOrJoin(fm?.Genre);
    items.push({
      title,
      author,
      genre: genre || undefined,
      filePath: file.path,
      startDate: str(fm?.Start_date),
    });
  }
  // Most recently started first; books with no start date sink to the bottom.
  items.sort((a, b) => {
    if (a.startDate && !b.startDate) return -1;
    if (!a.startDate && b.startDate) return 1;
    return b.startDate.localeCompare(a.startDate);
  });
  return items;
}

export function formatReadingItem(r: ReadingItem): string {
  const authorPart = r.author ? ` by ${r.author}` : "";
  const genrePart = r.genre ? ` — ${r.genre}` : "";
  return `${r.title}${authorPart}${genrePart}`;
}
