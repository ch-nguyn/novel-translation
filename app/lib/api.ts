export interface FetchContentResult {
  text: string;
  title: string;
  novelName: string;
  chapterName: string;
  prevUrl: string | null;
  nextUrl: string | null;
  lang: string;
}

async function fetchViaProxy(url: string): Promise<string> {
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
  return res.text();
}

async function parseContent(
  url: string,
  html: string | null,
  signal?: AbortSignal
): Promise<FetchContentResult> {
  const res = await fetch("/api/fetch-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, html }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch content");
  }

  const data = await res.json();

  // Server returned BLOCKED — need client-side proxy
  if (data.error === "BLOCKED") {
    return null as unknown as FetchContentResult;
  }

  return {
    text: data.text,
    title: data.title || "",
    novelName: data.novelName || "",
    chapterName: data.chapterName || "",
    prevUrl: data.prevUrl || null,
    nextUrl: data.nextUrl || null,
    lang: data.lang || "vi",
  };
}

export async function fetchChapterContent(
  url: string,
  signal?: AbortSignal
): Promise<FetchContentResult> {
  // Try server-side fetch first
  const result = await parseContent(url, null, signal);
  if (result) return result;

  // Server was blocked — fetch via CORS proxy and send HTML for parsing
  const html = await fetchViaProxy(url);
  return parseContent(url, html, signal);
}

export async function translateTitle(
  title: string,
  apiKey: string,
  model: string,
  prompt?: string
): Promise<string> {
  if (!title.trim() || !apiKey) return title;

  try {
    const res = await fetch("/api/translate-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, apiKey, model, prompt }),
    });

    if (!res.ok) return title;

    const data = await res.json();
    return data.translated || title;
  } catch {
    return title;
  }
}

export async function simplifyText(
  text: string,
  apiKey: string,
  model: string,
  lang?: string,
  signal?: AbortSignal,
  onChunk?: (accumulated: string) => void
): Promise<string> {
  const res = await fetch("/api/simplify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, apiKey, model, lang: lang || "vi" }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to simplify");
  }

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let result = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      onChunk?.(result);
    }
  }

  return result;
}
