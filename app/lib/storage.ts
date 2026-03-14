import { SavedChapter, ReaderSettings } from "./types";

const STORAGE_KEY = "novel-translator-chapters";
const CURRENT_KEY = "novel-translator-current";
const SETTINGS_KEY = "novel-translator-settings";

const DEFAULT_SETTINGS: ReaderSettings = { bgColor: "#f5f5dc", fontSize: 18 };

export function getSavedChapters(): SavedChapter[] {
  try {
    const chapters: SavedChapter[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    return chapters.map((c) => ({
      ...c,
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
