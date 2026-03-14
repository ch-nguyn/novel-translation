"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface SavedChapter {
  url: string;
  title: string;
  originalText: string;
  simplifiedText: string;
  prevUrl: string | null;
  nextUrl: string | null;
  savedAt: number;
}

const STORAGE_KEY = "novel-translator-chapters";
const CURRENT_KEY = "novel-translator-current";

function getSavedChapters(): SavedChapter[] {
  try {
    const chapters: SavedChapter[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
    // Ensure old saved chapters have nav fields
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

export default function Home() {
  const [url, setUrl] = useState("");
  const [originalText, setOriginalText] = useState("");
  const [simplifiedText, setSimplifiedText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [title, setTitle] = useState("");
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSavedChapters(getSavedChapters());

    // Restore last reading chapter
    const currentUrl = localStorage.getItem(CURRENT_KEY);
    if (currentUrl) {
      const chapters = getSavedChapters();
      const chapter = chapters.find((c) => c.url === currentUrl);
      if (chapter) {
        setUrl(chapter.url);
        setTitle(chapter.title);
        setOriginalText(chapter.originalText);
        setSimplifiedText(chapter.simplifiedText);
        setPrevUrl(chapter.prevUrl || null);
        setNextUrl(chapter.nextUrl || null);
      } else {
        setUrl(currentUrl);
      }
    }
  }, []);

  const handleFetchAndSimplify = useCallback(
    async (targetUrl?: string) => {
      const fetchUrl = targetUrl || url;
      if (!fetchUrl.trim() || fetching || simplifying) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFetching(true);
      setOriginalText("");
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
          setOriginalText(
            `Error: ${err.error || "Failed to fetch content"}`
          );
          return;
        }

        const data = await fetchRes.json();
        setOriginalText(data.text);
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

        // Auto-save after simplification completes
        const chapter: SavedChapter = {
          url: fetchUrl,
          title: data.title || fetchUrl,
          originalText: data.text,
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
          setOriginalText("Error: Failed to process");
        }
      } finally {
        setFetching(false);
        setSimplifying(false);
      }
    },
    [url, fetching, simplifying]
  );

  async function loadSavedChapter(chapter: SavedChapter) {
    setUrl(chapter.url);
    setTitle(chapter.title);
    setOriginalText(chapter.originalText);
    setSimplifiedText(chapter.simplifiedText);
    setPrevUrl(chapter.prevUrl || null);
    setNextUrl(chapter.nextUrl || null);
    setShowSaved(false);
    localStorage.setItem(CURRENT_KEY, chapter.url);

    // If nav URLs are missing, fetch them from the page
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
          // Update saved chapter with nav URLs
          const updated: SavedChapter = {
            ...chapter,
            prevUrl: data.prevUrl || null,
            nextUrl: data.nextUrl || null,
          };
          saveChapter(updated);
          setSavedChapters(getSavedChapters());
        }
      } catch {
        // Ignore — nav just won't be available
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

  const isLoading = fetching || simplifying;
  const buttonLabel = fetching
    ? "Fetching content..."
    : simplifying
      ? "Simplifying..."
      : "Translate (⌘+Enter)";

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-center mb-2">
        Novel Translator
      </h1>
      {title && (
        <p className="text-center text-lg text-gray-700 mb-4">{title}</p>
      )}

      <div className="flex gap-2 mb-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste chapter link (tangthuvien.net, webnovel.vn, tvtruyen.com)..."
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <button
          onClick={() => handleFetchAndSimplify()}
          disabled={isLoading || !url.trim()}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {buttonLabel}
        </button>
        <button
          onClick={() => setShowSaved(!showSaved)}
          className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors whitespace-nowrap border border-gray-300"
        >
          Saved ({savedChapters.length})
        </button>
      </div>

      {showSaved && (
        <div className="mb-4 border border-gray-200 rounded-lg bg-white max-h-64 overflow-auto">
          {savedChapters.length === 0 ? (
            <p className="p-4 text-gray-400 text-center">No saved chapters</p>
          ) : (
            savedChapters.map((ch) => (
              <div
                key={ch.url}
                className="flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
              >
                <button
                  onClick={() => loadSavedChapter(ch)}
                  className="text-left flex-1 mr-4"
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {ch.title}
                  </p>
                  <p className="text-xs text-gray-400">
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
      )}

      <div className="flex justify-between mb-4">
        <button
          onClick={() => prevUrl && handleFetchAndSimplify(prevUrl)}
          disabled={!prevUrl || isLoading}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous Chapter
        </button>
        <button
          onClick={() => nextUrl && handleFetchAndSimplify(nextUrl)}
          disabled={!nextUrl || isLoading}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next Chapter →
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-600">
            Original
          </label>
          <div className="w-full h-[70vh] p-4 border border-gray-200 rounded-lg bg-white overflow-auto whitespace-pre-wrap text-sm">
            {originalText || (
              <span className="text-gray-400">
                Original content will appear here...
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-600">
            Simplified
          </label>
          <div className="w-full h-[70vh] p-4 border border-gray-200 rounded-lg bg-white overflow-auto whitespace-pre-wrap text-sm">
            {simplifiedText || (
              <span className="text-gray-400">
                Simplified text will appear here...
              </span>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
