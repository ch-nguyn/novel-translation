"use client";

import { SavedChapter, ReaderSettings } from "../lib/types";

interface NovelInfo {
  slug: string;
  name: string;
  chapterCount: number;
  lastRead: number;
}

interface Props {
  chapters: SavedChapter[];
  settings: ReaderSettings;
  textColor: string;
  currentNovelSlug: string | null;
  onSelectNovel: (slug: string) => void;
  onClearNovel: (slug: string) => void;
}

function getNovelName(chapters: SavedChapter[]): string {
  return chapters[0]?.novelName || chapters[0]?.novelSlug || "Unknown";
}

function getNovels(chapters: SavedChapter[]): NovelInfo[] {
  const map = new Map<string, SavedChapter[]>();
  for (const ch of chapters) {
    const slug = ch.novelSlug || "unknown";
    if (!map.has(slug)) map.set(slug, []);
    map.get(slug)!.push(ch);
  }

  return Array.from(map.entries()).map(([slug, chs]) => ({
    slug,
    name: getNovelName(chs),
    chapterCount: chs.length,
    lastRead: Math.max(...chs.map((c) => c.savedAt)),
  })).sort((a, b) => b.lastRead - a.lastRead);
}

export default function SavedNovelsList({
  chapters,
  settings,
  textColor,
  currentNovelSlug,
  onSelectNovel,
  onClearNovel,
}: Props) {
  const novels = getNovels(chapters);

  return (
    <div
      className="mb-4 rounded-lg border overflow-hidden"
      style={{ borderColor: textColor + "20" }}
    >
      <div className="max-h-60 sm:max-h-64 overflow-auto">
        {novels.length === 0 ? (
          <p
            className="p-4 text-center text-sm"
            style={{ color: textColor + "60" }}
          >
            No saved novels
          </p>
        ) : (
          novels.map((novel) => (
            <div
              key={novel.slug}
              className="flex items-center justify-between px-3 sm:px-4 py-3 border-b last:border-b-0"
              style={{
                borderColor: textColor + "10",
                backgroundColor:
                  novel.slug === currentNovelSlug
                    ? textColor + "08"
                    : "transparent",
              }}
            >
              <button
                onClick={() => onSelectNovel(novel.slug)}
                className="text-left flex-1 cursor-pointer rounded-lg px-2 py-1 transition-colors hover:opacity-70"
              >
                <p className="text-sm font-medium">{novel.name}</p>
                <p className="text-xs" style={{ color: textColor + "60" }}>
                  {novel.chapterCount} chapters
                </p>
              </button>
              <button
                onClick={() => onClearNovel(novel.slug)}
                className="text-xs text-red-500 hover:text-red-700 cursor-pointer transition-colors"
              >
                Clear
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
