"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SavedChapter, ReaderSettings, getTextColor } from "./lib/types";
import {
  getSavedChapters,
  saveChapter,
  deleteChapter,
  getCurrentUrl,
  setCurrentUrl,
  getSettings,
  saveSettings,
} from "./lib/storage";
import { fetchChapterContent, simplifyText } from "./lib/api";
import SettingsPanel from "./components/SettingsPanel";
import SavedChaptersList from "./components/SavedChaptersList";
import NavButtons from "./components/NavButtons";

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
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>({
    bgColor: "#f5f5dc",
    fontSize: 18,
  });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSavedChapters(getSavedChapters());
    setSettings(getSettings());

    const currentUrl = getCurrentUrl();
    if (currentUrl) {
      const chapter = getSavedChapters().find((c) => c.url === currentUrl);
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
    saveSettings(updated);
  }

  function refreshSaved() {
    setSavedChapters(getSavedChapters());
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
        const data = await fetchChapterContent(fetchUrl, controller.signal);
        setTitle(data.title);
        setPrevUrl(data.prevUrl);
        setNextUrl(data.nextUrl);
        setFetching(false);
        setSimplifying(true);

        const result = await simplifyText(
          data.text,
          controller.signal,
          setSimplifiedText
        );

        saveChapter({
          url: fetchUrl,
          title: data.title || fetchUrl,
          simplifiedText: result,
          prevUrl: data.prevUrl,
          nextUrl: data.nextUrl,
          savedAt: Date.now(),
        });
        refreshSaved();
        setCurrentUrl(fetchUrl);
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") {
          setSimplifiedText(`Error: ${e.message}`);
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
      await handleFetchAndSimplify(targetUrl);
    }
  }

  async function loadSavedChapter(chapter: SavedChapter) {
    setUrl(chapter.url);
    setTitle(chapter.title);
    setSimplifiedText(chapter.simplifiedText);
    setPrevUrl(chapter.prevUrl || null);
    setNextUrl(chapter.nextUrl || null);
    setShowSaved(false);
    setCurrentUrl(chapter.url);

    if (!chapter.prevUrl && !chapter.nextUrl) {
      try {
        const data = await fetchChapterContent(chapter.url);
        setPrevUrl(data.prevUrl);
        setNextUrl(data.nextUrl);
        saveChapter({ ...chapter, prevUrl: data.prevUrl, nextUrl: data.nextUrl });
        refreshSaved();
      } catch {
        // Ignore
      }
    }
  }

  function handleDelete(chapterUrl: string) {
    deleteChapter(chapterUrl);
    refreshSaved();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleFetchAndSimplify();
    }
  }

  const isLoading = fetching || simplifying;
  const buttonLabel = fetching
    ? "Fetching..."
    : simplifying
      ? "Simplifying..."
      : "Translate (⌘+Enter)";
  const textColor = getTextColor(settings.bgColor);

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
              style={{ borderColor: textColor + "30", color: textColor, backgroundColor: settings.bgColor }}
            >
              Saved ({savedChapters.length})
            </button>
            <button
              onClick={() => { setShowSettings(!showSettings); setShowSaved(false); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
              style={{ borderColor: textColor + "30", color: textColor, backgroundColor: settings.bgColor }}
            >
              Settings
            </button>
          </div>
        </div>

        {showSettings && (
          <SettingsPanel settings={settings} textColor={textColor} onUpdate={updateSettings} />
        )}

        {showSaved && (
          <SavedChaptersList
            chapters={savedChapters}
            settings={settings}
            textColor={textColor}
            onLoad={loadSavedChapter}
            onDelete={handleDelete}
          />
        )}

        <div className="flex gap-2 mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste chapter link..."
            className="flex-1 px-4 py-2.5 rounded-lg border text-sm"
            style={{ backgroundColor: settings.bgColor, borderColor: textColor + "30", color: textColor }}
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
          <h2 className="text-center text-lg font-semibold mb-4">{title}</h2>
        )}

        <NavButtons prevUrl={prevUrl} nextUrl={nextUrl} disabled={isLoading} textColor={textColor} onNavigate={navigateToChapter} />

        <div
          className="min-h-[60vh] px-2 py-4 whitespace-pre-wrap leading-relaxed"
          style={{ fontSize: `${settings.fontSize}px` }}
        >
          {simplifiedText || (
            <span style={{ color: textColor + "40" }}>Content will appear here...</span>
          )}
        </div>

        <NavButtons prevUrl={prevUrl} nextUrl={nextUrl} disabled={isLoading} textColor={textColor} onNavigate={navigateToChapter} />
      </div>
    </main>
  );
}
