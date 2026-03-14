"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface SavedChapter {
  url: string;
  title: string;
  simplifiedText: string;
  prevUrl: string | null;
  nextUrl: string | null;
  savedAt: number;
}

interface ReaderSettings {
  bgColor: string;
  fontSize: number;
}

const STORAGE_KEY = "novel-translator-chapters";
const CURRENT_KEY = "novel-translator-current";
const SETTINGS_KEY = "novel-translator-settings";

const BG_OPTIONS = [
  { bg: "#ffffff", text: "#1a1a1a", label: "White" },
  { bg: "#f5f5dc", text: "#3b3024", label: "Sepia" },
  { bg: "#d4edda", text: "#1b3a26", label: "Green" },
  { bg: "#1a1a2e", text: "#d4d4d4", label: "Dark" },
  { bg: "#0d0d0d", text: "#cccccc", label: "Black" },
];

function getTextColor(bgColor: string): string {
  return BG_OPTIONS.find((o) => o.bg === bgColor)?.text ?? "#1a1a1a";
}

function getSettings(): ReaderSettings {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") ?? {
      bgColor: "#f5f5dc",
      fontSize: 18,
    };
  } catch {
    return { bgColor: "#f5f5dc", fontSize: 18 };
  }
}

function getSavedChapters(): SavedChapter[] {
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

function saveChapter(chapter: SavedChapter) {
  const chapters = getSavedChapters();
  const existing = chapters.findIndex((c) => c.url === chapter.url);
  if (existing >= 0) {
    chapters[existing] = chapter;
  } else {
    chapters.unshift(chapter);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
}

function deleteChapter(url: string) {
  const chapters = getSavedChapters().filter((c) => c.url !== url);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
}

function extractChapterNumber(title: string): number | null {
  const match = title.match(/(?:ch(?:ương|apter|ap)?|chương)\s*(\d+)/i)
    || title.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [simplifiedText, setSimplifiedText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [title, setTitle] = useState("");
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>({
    bgColor: "#f5f5dc",
    fontSize: 18,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSavedChapters(getSavedChapters());
    setSettings(getSettings());

    const currentUrl = localStorage.getItem(CURRENT_KEY);
    if (currentUrl) {
      const chapters = getSavedChapters();
      const chapter = chapters.find((c) => c.url === currentUrl);
      if (chapter) {
        setUrl(chapter.url);
        setTitle(chapter.title);
        setSimplifiedText(chapter.simplifiedText);
        setPrevUrl(chapter.prevUrl || null);
        setNextUrl(chapter.nextUrl || null);
      } else {
        setUrl(currentUrl);
      }
    }
  }, []);

  function updateSettings(patch: Partial<ReaderSettings>) {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  }

  const handleFetchAndSimplify = useCallback(
    async (targetUrl?: string) => {
      const fetchUrl = targetUrl || url;
      if (!fetchUrl.trim() || fetching || simplifying) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFetching(true);
      setSimplifiedText("");
      setTitle("");
      setPrevUrl(null);
      setNextUrl(null);

      if (targetUrl) setUrl(targetUrl);

      try {
        const fetchRes = await fetch("/api/fetch-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: fetchUrl }),
          signal: controller.signal,
        });

        if (!fetchRes.ok) {
          const err = await fetchRes.json();
          setSimplifiedText(
            `Error: ${err.error || "Failed to fetch content"}`
          );
          return;
        }

        const data = await fetchRes.json();
        setTitle(data.title || "");
        setPrevUrl(data.prevUrl || null);
        setNextUrl(data.nextUrl || null);
        setFetching(false);

        setSimplifying(true);

        const simplifyRes = await fetch("/api/simplify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: data.text }),
          signal: controller.signal,
        });

        if (!simplifyRes.ok) {
          const err = await simplifyRes.json();
          setSimplifiedText(
            `Error: ${err.error || "Failed to simplify"}`
          );
          return;
        }

        const reader = simplifyRes.body?.getReader();
        const decoder = new TextDecoder();
        let result = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += decoder.decode(value, { stream: true });
            setSimplifiedText(result);
          }
        }

        const chapter: SavedChapter = {
          url: fetchUrl,
          title: data.title || fetchUrl,
          simplifiedText: result,
          prevUrl: data.prevUrl || null,
          nextUrl: data.nextUrl || null,
          savedAt: Date.now(),
        };
        saveChapter(chapter);
        setSavedChapters(getSavedChapters());
        localStorage.setItem(CURRENT_KEY, fetchUrl);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") {
          setSimplifiedText("Error: Failed to process");
        }
      } finally {
        setFetching(false);
        setSimplifying(false);
      }
    },
    [url, fetching, simplifying]
  );

  async function navigateToChapter(targetUrl: string) {
    const saved = getSavedChapters().find((c) => c.url === targetUrl);
    if (saved) {
      await loadSavedChapter(saved);
    } else {
      handleFetchAndSimplify(targetUrl);
    }
  }

  async function loadSavedChapter(chapter: SavedChapter) {
    setUrl(chapter.url);
    setTitle(chapter.title);
    setSimplifiedText(chapter.simplifiedText);
    setPrevUrl(chapter.prevUrl || null);
    setNextUrl(chapter.nextUrl || null);
    setShowSaved(false);
    setChapterSearch("");
    localStorage.setItem(CURRENT_KEY, chapter.url);

    if (!chapter.prevUrl && !chapter.nextUrl) {
      try {
        const res = await fetch("/api/fetch-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: chapter.url }),
        });
        if (res.ok) {
          const data = await res.json();
          setPrevUrl(data.prevUrl || null);
          setNextUrl(data.nextUrl || null);
          const updated: SavedChapter = {
            ...chapter,
            prevUrl: data.prevUrl || null,
            nextUrl: data.nextUrl || null,
          };
          saveChapter(updated);
          setSavedChapters(getSavedChapters());
        }
      } catch {
        // Ignore
      }
    }
  }

  function handleDelete(chapterUrl: string) {
    deleteChapter(chapterUrl);
    setSavedChapters(getSavedChapters());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleFetchAndSimplify();
    }
  }

  const filteredChapters = chapterSearch.trim()
    ? savedChapters.filter((ch) => {
        const searchNum = parseInt(chapterSearch, 10);
        if (!isNaN(searchNum)) {
          const chNum = extractChapterNumber(ch.title);
          return chNum === searchNum;
        }
        return ch.title.toLowerCase().includes(chapterSearch.toLowerCase());
      })
    : savedChapters;

  const isLoading = fetching || simplifying;
  const buttonLabel = fetching
    ? "Fetching..."
    : simplifying
      ? "Simplifying..."
      : "Translate (⌘+Enter)";

  const textColor = getTextColor(settings.bgColor);

  const navButtons = (
    <div className="flex justify-between py-3">
      <button
        onClick={() => prevUrl && navigateToChapter(prevUrl)}
        disabled={!prevUrl || isLoading}
        className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          borderColor: textColor + "30",
          color: textColor,
        }}
      >
        ← Previous
      </button>
      <button
        onClick={() => nextUrl && navigateToChapter(nextUrl)}
        disabled={!nextUrl || isLoading}
        className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={{
          borderColor: textColor + "30",
          color: textColor,
        }}
      >
        Next →
      </button>
    </div>
  );

  return (
    <main
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: settings.bgColor, color: textColor }}
    >
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Novel Translator</h1>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowSaved(!showSaved); setShowSettings(false); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: textColor + "30",
                color: textColor,
                backgroundColor: settings.bgColor,
              }}
            >
              Saved ({savedChapters.length})
            </button>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowSaved(false); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: textColor + "30",
                color: textColor,
                backgroundColor: settings.bgColor,
              }}
            >
              Settings
            </button>
          </div>
        </div>

        {showSettings && (
          <div
            className="mb-4 p-4 rounded-lg border"
            style={{ borderColor: textColor + "20" }}
          >
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium block mb-2">
                  Background
                </label>
                <div className="flex gap-2">
                  {BG_OPTIONS.map((opt) => (
                    <button
                      key={opt.bg}
                      onClick={() => updateSettings({ bgColor: opt.bg })}
                      className="w-10 h-10 rounded-lg border-2 transition-transform"
                      style={{
                        backgroundColor: opt.bg,
                        borderColor:
                          settings.bgColor === opt.bg
                            ? "#3b82f6"
                            : textColor + "20",
                        transform:
                          settings.bgColor === opt.bg
                            ? "scale(1.1)"
                            : "scale(1)",
                      }}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">
                  Font size: {settings.fontSize}px
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      updateSettings({
                        fontSize: Math.max(12, settings.fontSize - 2),
                      })
                    }
                    className="w-8 h-8 rounded border flex items-center justify-center"
                    style={{ borderColor: textColor + "30", color: textColor }}
                  >
                    -
                  </button>
                  <input
                    type="range"
                    min={12}
                    max={32}
                    step={1}
                    value={settings.fontSize}
                    onChange={(e) =>
                      updateSettings({ fontSize: parseInt(e.target.value, 10) })
                    }
                    className="flex-1"
                  />
                  <button
                    onClick={() =>
                      updateSettings({
                        fontSize: Math.min(32, settings.fontSize + 2),
                      })
                    }
                    className="w-8 h-8 rounded border flex items-center justify-center"
                    style={{ borderColor: textColor + "30", color: textColor }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSaved && (
          <div
            className="mb-4 rounded-lg border overflow-hidden"
            style={{ borderColor: textColor + "20" }}
          >
            <div className="p-3 border-b" style={{ borderColor: textColor + "10" }}>
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
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
              {filteredChapters.length === 0 ? (
                <p
                  className="p-4 text-center text-sm"
                  style={{ color: textColor + "60" }}
                >
                  No chapters found
                </p>
              ) : (
                filteredChapters.map((ch) => (
                  <div
                    key={ch.url}
                    className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
                    style={{ borderColor: textColor + "10" }}
                  >
                    <button
                      onClick={() => loadSavedChapter(ch)}
                      className="text-left flex-1 mr-4"
                    >
                      <p className="text-sm font-medium truncate">
                        {ch.title}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: textColor + "60" }}
                      >
                        {new Date(ch.savedAt).toLocaleString()}
                      </p>
                    </button>
                    <button
                      onClick={() => handleDelete(ch.url)}
                      className="text-xs text-red-500 hover:text-red-700 shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste chapter link..."
            className="flex-1 px-4 py-2.5 rounded-lg border text-sm"
            style={{
              backgroundColor: settings.bgColor,
              borderColor: textColor + "30",
              color: textColor,
            }}
          />
          <button
            onClick={() => handleFetchAndSimplify()}
            disabled={isLoading || !url.trim()}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {buttonLabel}
          </button>
        </div>

        {title && (
          <h2
            className="text-center text-lg font-semibold mb-4"
            style={{ color: textColor }}
          >
            {title}
          </h2>
        )}

        {navButtons}

        <div
          className="min-h-[60vh] px-2 py-4 whitespace-pre-wrap leading-relaxed"
          style={{ fontSize: `${settings.fontSize}px` }}
        >
          {simplifiedText || (
            <span style={{ color: textColor + "40" }}>
              Content will appear here...
            </span>
          )}
        </div>

        {navButtons}
      </div>
    </main>
  );
}
