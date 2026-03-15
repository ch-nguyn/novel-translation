"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { SavedChapter, ReaderSettings, getTextColor } from "./lib/types";
import {
  getSavedChapters,
  saveChapter,
  clearNovelChapters,
  extractNovelSlug,
  getCurrentUrl,
  setCurrentUrl,
  getSettings,
  saveSettings,
} from "./lib/storage";
import { fetchChapterContent, simplifyText, translateTitle } from "./lib/api";
import SettingsPanel from "./components/SettingsPanel";
import SavedChaptersList from "./components/SavedChaptersList";
import SavedNovelsList from "./components/SavedNovelsList";
import NavButtons from "./components/NavButtons";

type Panel = "none" | "chapters" | "novels" | "settings";

export default function Home() {
  const [url, setUrl] = useState("");
  const [simplifiedText, setSimplifiedText] = useState("");
  const [fetching, setFetching] = useState(false);
  const [simplifying, setSimplifying] = useState(false);
  const [title, setTitle] = useState("");
  const [novelName, setNovelName] = useState("");
  const [chapterName, setChapterName] = useState("");
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [nextUrl, setNextUrl] = useState<string | null>(null);
  const [savedChapters, setSavedChapters] = useState<SavedChapter[]>([]);
  const [activePanel, setActivePanel] = useState<Panel>("none");
  const [settings, setSettings] = useState<ReaderSettings>({
    bgColor: "#f5f5dc",
    fontSize: 18,
    apiKey: "",
    aiModel: "gpt-4o",
  });
  const abortRef = useRef<AbortController | null>(null);

  const currentNovelSlug = url ? extractNovelSlug(url) : null;

  const currentNovelChapters = currentNovelSlug
    ? savedChapters.filter((c) => c.novelSlug === currentNovelSlug)
    : [];

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

  function togglePanel(panel: Panel) {
    setActivePanel((prev) => (prev === panel ? "none" : panel));
  }

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
      setNovelName("");
      setChapterName("");
      setPrevUrl(null);
      setNextUrl(null);
      if (targetUrl) setUrl(targetUrl);

      try {
        const data = await fetchChapterContent(fetchUrl, controller.signal);
        let chapterTitle = data.title;

        setTitle(chapterTitle);
        setNovelName(data.novelName);
        setChapterName(data.chapterName);
        setPrevUrl(data.prevUrl);
        setNextUrl(data.nextUrl);
        setFetching(false);
        setSimplifying(true);

        const result = await simplifyText(
          data.text,
          settings.apiKey,
          settings.aiModel,
          data.lang,
          controller.signal,
          setSimplifiedText
        );

        // Translate title if Chinese
        if (data.lang === "zh") {
          try {
            if (data.chapterName) {
              const title = await translateTitle(
                data.chapterName,
                settings.apiKey,
                settings.aiModel,
                "Dịch tiêu đề truyện sau từ tiếng Trung sang tiếng Việt (ưu tiên Hán Việt) phổ thông dễ hiểu. Giữ nguyên dấu '-' phân cách giữa tên truyện và tên chương. Chỉ trả về bản dịch, không giải thích."
              );
              const [tNovel,tChapter] = title.split(/\s*-\s*/);

              setChapterName(tChapter);
              setNovelName(tNovel);
              setTitle(tNovel);
              data.novelName = tNovel;
              data.chapterName = tChapter;
            }
          } catch { /* keep original */ }
        }

        saveChapter({
          url: fetchUrl,
          title: data.chapterName || chapterTitle || fetchUrl,
          novelName: data.novelName || "",
          novelSlug: extractNovelSlug(fetchUrl),
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
    [url, fetching, simplifying, settings.apiKey, settings.aiModel]
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
    setNovelName(chapter.novelName || "");
    setChapterName(chapter.title || "");
    setSimplifiedText(chapter.simplifiedText);
    setPrevUrl(chapter.prevUrl || null);
    setNextUrl(chapter.nextUrl || null);
    setActivePanel("none");
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

  function handleSelectNovel(slug: string) {
    const novelChapters = savedChapters.filter((c) => c.novelSlug === slug);
    const latest = novelChapters.reduce((a, b) => (a.savedAt > b.savedAt ? a : b));
    loadSavedChapter(latest);
  }

  function handleClearNovel(novelSlug: string) {
    clearNovelChapters(novelSlug);
    refreshSaved();
    if (url && extractNovelSlug(url) === novelSlug) {
      setSimplifiedText("");
      setTitle("");
      setUrl("");
      setPrevUrl(null);
      setNextUrl(null);
    }
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
      : "Translate";
  const textColor = getTextColor(settings.bgColor);
  const btnStyle = { borderColor: textColor + "30", color: textColor, backgroundColor: settings.bgColor };
  const btnClass = "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer hover:opacity-70";

  return (
    <main
      className="min-h-screen transition-colors duration-200"
      style={{ backgroundColor: settings.bgColor, color: textColor }}
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h1 className="text-lg sm:text-xl font-bold">Novel Translator</h1>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => togglePanel("chapters")}
              disabled={!currentNovelSlug || currentNovelChapters.length === 0}
              className={btnClass + " text-xs sm:text-sm disabled:opacity-30 disabled:cursor-not-allowed"}
              style={btnStyle}
            >
              Chapters ({currentNovelChapters.length})
            </button>
            <button
              onClick={() => togglePanel("novels")}
              className={btnClass + " text-xs sm:text-sm"}
              style={btnStyle}
            >
              Novels
            </button>
            <button
              onClick={() => togglePanel("settings")}
              className={btnClass + " text-xs sm:text-sm"}
              style={btnStyle}
            >
              Settings
            </button>
          </div>
        </div>

        {activePanel === "settings" && (
          <SettingsPanel settings={settings} textColor={textColor} onUpdate={updateSettings} />
        )}

        {activePanel === "novels" && (
          <SavedNovelsList
            chapters={savedChapters}
            settings={settings}
            textColor={textColor}
            currentNovelSlug={currentNovelSlug}
            onSelectNovel={handleSelectNovel}
            onClearNovel={handleClearNovel}
          />
        )}

        {activePanel === "chapters" && (
          <SavedChaptersList
            chapters={currentNovelChapters}
            settings={settings}
            textColor={textColor}
            onLoad={loadSavedChapter}
          />
        )}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Paste chapter link..."
            className="flex-1 px-3 sm:px-4 py-2.5 rounded-lg border text-sm min-w-0"
            style={{ backgroundColor: settings.bgColor, borderColor: textColor + "30", color: textColor }}
          />
          <button
            onClick={() => handleFetchAndSimplify()}
            disabled={isLoading || !url.trim() || !settings.apiKey?.trim()}
            className="px-5 py-2.5 cursor-pointer bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {buttonLabel}
          </button>
        </div>

        {(novelName || chapterName || title) && (
          <div className="text-center mb-4">
            {novelName && (
              <h2 className="text-lg font-semibold">{novelName}</h2>
            )}
            {chapterName && (
              <p className="text-sm mt-1" style={{ color: textColor + "80" }}>{chapterName}</p>
            )}
            {!novelName && !chapterName && title && (
              <h2 className="text-lg font-semibold">{title}</h2>
            )}
          </div>
        )}

        <NavButtons prevUrl={prevUrl} nextUrl={nextUrl} disabled={isLoading || !settings.apiKey?.trim()} textColor={textColor} onNavigate={navigateToChapter} />

        <div
          className="min-h-[60vh] px-1 sm:px-2 py-4 whitespace-pre-wrap leading-relaxed"
          style={{ fontSize: `${settings.fontSize}px` }}
        >
          {simplifiedText || (
            <span style={{ color: textColor + "40" }}>Content will appear here...</span>
          )}
        </div>

        <NavButtons prevUrl={prevUrl} nextUrl={nextUrl} disabled={isLoading || !settings.apiKey?.trim()} textColor={textColor} onNavigate={navigateToChapter} />
      </div>
    </main>
  );
}
