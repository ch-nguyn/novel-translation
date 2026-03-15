import { SavedChapter, ReaderSettings } from "./types";

const STORAGE_KEY = "novel-translator-chapters";
const CURRENT_KEY = "novel-translator-current";
const SETTINGS_KEY = "novel-translator-settings";

const DEFAULT_SETTINGS: ReaderSettings = {
  bgColor: "#f5f5dc",
  fontSize: 18,
  apiKey: "",
  aiModel: "gpt-4o",
};

// Extract novel slug from URL
// tvtruyen.com:    /tien-vo-de-ton-dich/chuong-1-xxx  → tien-vo-de-ton-dich
// tangthuvien.net: /doc-truyen/novel-slug/chuong-1     → novel-slug
// webnovel.vn:     /novel-slug/chuong-1/               → novel-slug
export function extractNovelSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/\/$/, "");
    const parts = pathname.split("/").filter(Boolean);

    if (url.includes("tangthuvien.net")) {
      // /doc-truyen/novel-slug/chuong-X
      const idx = parts.indexOf("doc-truyen");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }

    // 69shuba.com: /txt/NOVEL_ID/CHAPTER_ID → NOVEL_ID
    if (url.includes("69shuba") || url.includes("69shu")) {
      const txtIdx = parts.indexOf("txt");
      if (txtIdx >= 0 && parts[txtIdx + 1]) return parts[txtIdx + 1];
      const bookIdx = parts.indexOf("book");
      if (bookIdx >= 0 && parts[bookIdx + 1]) return parts[bookIdx + 1].replace(".htm", "");
    }

    // tvtruyen.com: /novel-slug/chuong-X
    // webnovel.vn:  /novel-slug/chuong-X
    if (parts.length >= 2) return parts[0];
    return parts[0] || "unknown";
  } catch {
    return "unknown";
  }
}

export function getSavedChapters(): SavedChapter[] {
  try {
    const chapters: SavedChapter[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    return chapters.map((c) => ({
      ...c,
      novelName: c.novelName || "",
      novelSlug: c.novelSlug || extractNovelSlug(c.url),
      prevUrl: c.prevUrl ?? null,
      nextUrl: c.nextUrl ?? null,
    }));
  } catch {
    return [];
  }
}

export function saveChapter(chapter: SavedChapter) {
  const chapters = getSavedChapters();
  const existing = chapters.findIndex((c) => c.url === chapter.url);
  if (existing >= 0) {
    chapters[existing] = chapter;
  } else {
    chapters.unshift(chapter);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
}

export function deleteChapter(url: string) {
  const chapters = getSavedChapters().filter((c) => c.url !== url);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
}

export function clearNovelChapters(novelSlug: string) {
  const chapters = getSavedChapters().filter((c) => c.novelSlug !== novelSlug);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
  // Clear current URL if it belonged to this novel
  const currentUrl = getCurrentUrl();
  if (currentUrl && extractNovelSlug(currentUrl) === novelSlug) {
    localStorage.removeItem(CURRENT_KEY);
  }
}

export function getCurrentUrl(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentUrl(url: string) {
  localStorage.setItem(CURRENT_KEY, url);
}

export function getSettings(): ReaderSettings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") ?? DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ReaderSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function extractChapterNumber(title: string): number | null {
  const match =
    title.match(/(?:ch(?:ương|apter|ap)?|chương)\s*(\d+)/i) ||
    title.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
