"use client";

import { useState } from "react";
import { SavedChapter, ReaderSettings } from "../lib/types";
import { extractChapterNumber } from "../lib/storage";

interface Props {
  chapters: SavedChapter[];
  settings: ReaderSettings;
  textColor: string;
  onLoad: (chapter: SavedChapter) => void;
  onDelete: (url: string) => void;
}

export default function SavedChaptersList({
  chapters,
  settings,
  textColor,
  onLoad,
  onDelete,
}: Props) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? chapters.filter((ch) => {
        const searchNum = parseInt(search, 10);
        if (!isNaN(searchNum)) {
          const chNum = extractChapterNumber(ch.title);
          return chNum === searchNum;
        }
        return ch.title.toLowerCase().includes(search.toLowerCase());
      })
    : chapters;

  return (
    <div
      className="mb-4 rounded-lg border overflow-hidden"
      style={{ borderColor: textColor + "20" }}
    >
      <div
        className="p-3 border-b"
        style={{ borderColor: textColor + "10" }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by chapter number..."
          className="w-full px-3 py-2 rounded border text-sm"
          style={{
            backgroundColor: settings.bgColor,
            borderColor: textColor + "20",
            color: textColor,
          }}
        />
      </div>
      <div className="max-h-64 overflow-auto">
        {filtered.length === 0 ? (
          <p
            className="p-4 text-center text-sm"
            style={{ color: textColor + "60" }}
          >
            No chapters found
          </p>
        ) : (
          filtered.map((ch) => (
            <div
              key={ch.url}
              className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
              style={{ borderColor: textColor + "10" }}
            >
              <button
                onClick={() => onLoad(ch)}
                className="text-left flex-1 mr-4"
              >
                <p className="text-sm font-medium truncate">{ch.title}</p>
                <p className="text-xs" style={{ color: textColor + "60" }}>
                  {new Date(ch.savedAt).toLocaleString()}
                </p>
              </button>
              <button
                onClick={() => onDelete(ch.url)}
                className="text-xs text-red-500 hover:text-red-700 shrink-0"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
