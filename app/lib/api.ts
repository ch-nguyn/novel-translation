export interface FetchContentResult {
  text: string;
  title: string;
  prevUrl: string | null;
  nextUrl: string | null;
}

export async function fetchChapterContent(
  url: string,
  signal?: AbortSignal
): Promise<FetchContentResult> {
  const res = await fetch("/api/fetch-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to fetch content");
  }

  const data = await res.json();
  return {
    text: data.text,
    title: data.title || "",
    prevUrl: data.prevUrl || null,
    nextUrl: data.nextUrl || null,
  };
}

export async function simplifyText(
  text: string,
  signal?: AbortSignal,
  onChunk?: (accumulated: string) => void
): Promise<string> {
  const res = await fetch("/api/simplify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
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
