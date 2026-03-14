import * as cheerio from "cheerio";

interface SiteConfig {
  content: string;
  lang?: "vi" | "zh";
  removeSelectors?: string[];
}

const SITE_SELECTORS: Record<string, SiteConfig> = {
  "webnovel.vn": {
    content: ".reader__content",
  },
  "tvtruyen.com": {
    content: "#chapter-content",
  },
  "69shuba": {
    content: "div.txtnav",
    lang: "zh",
    removeSelectors: ["h1", "div.txtinfo", "div#txtright", "script", ".ad", ".ads"],
  },
  "69shu": {
    content: "div.txtnav",
    lang: "zh",
    removeSelectors: ["h1", "div.txtinfo", "div#txtright", "script", ".ad", ".ads"],
  },
};

function rewriteUrl(url: string): string {
  if (url.includes("69shuba.tw")) {
    throw new Error(
      "69shuba.tw is blocked by CAPTCHA. Use 69shuba.com instead (same novels, e.g. https://www.69shuba.com/book/NOVEL_ID.htm)"
    );
  }
  return url;
}

function getSiteConfig(url: string) {
  for (const [domain, config] of Object.entries(SITE_SELECTORS)) {
    if (url.includes(domain)) return config;
  }
  return null;
}

function extractNav($: cheerio.CheerioAPI): { prevUrl: string | null; nextUrl: string | null } {
  let prevUrl: string | null = null;
  let nextUrl: string | null = null;

  const relPrev = $('a[rel="prev"]').attr("href");
  const relNext = $('a[rel="next"]').attr("href");
  if (relPrev) prevUrl = relPrev;
  if (relNext) nextUrl = relNext;

  if (!prevUrl || !nextUrl) {
    $("a").each((_, el) => {
      const text = $(el).text().trim();
      const href = $(el).attr("href");
      if (!href) return;
      if (!prevUrl && (text === "Chương trước" || text === "上一章")) prevUrl = href;
      if (!nextUrl && (text === "Tiếp theo" || text === "Chương sau" || text === "下一章")) nextUrl = href;
    });
  }

  if (!prevUrl) prevUrl = $("a.truoc").attr("href") || null;
  if (!nextUrl) nextUrl = $("a.sau").attr("href") || null;

  return { prevUrl, nextUrl };
}

function extractTitle($: cheerio.CheerioAPI): string {
  return $("h1").first().text().trim() || $("title").text().trim() || "";
}

function parseHtml(html: string, siteConfig: SiteConfig, baseUrl: string) {
  const $ = cheerio.load(html);

  if (siteConfig.removeSelectors) {
    for (const sel of siteConfig.removeSelectors) {
      $(siteConfig.content).find(sel).remove();
    }
  }

  const contentEl = $(siteConfig.content);
  if (!contentEl.length) {
    throw new Error("Could not find chapter content on this page");
  }

  const text = contentEl.text();
  const titleStr = extractTitle($);
  let { prevUrl, nextUrl } = extractNav($);

  // Make relative URLs absolute
  const origin = new URL(baseUrl).origin;
  if (prevUrl && !prevUrl.startsWith("http")) prevUrl = origin + prevUrl;
  if (nextUrl && !nextUrl.startsWith("http")) nextUrl = origin + nextUrl;

  return { text, titleStr, prevUrl, nextUrl };
}

export async function POST(req: Request) {
  try {
    const { url, html } = await req.json();

    if (!url || typeof url !== "string") {
      return Response.json({ error: "Missing URL" }, { status: 400 });
    }

    const siteConfig = getSiteConfig(url);
    if (!siteConfig) {
      const supported = Object.keys(SITE_SELECTORS).join(", ");
      return Response.json(
        { error: `Unsupported site. Supported: ${supported}` },
        { status: 400 }
      );
    }

    rewriteUrl(url);

    let pageHtml = html;

    // If no HTML provided, try fetching server-side
    if (!pageHtml) {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,vi;q=0.6",
          "Referer": new URL(url).origin + "/",
        },
      });

      if (!res.ok) {
        return Response.json(
          { error: "BLOCKED", status: res.status },
          { status: 200 }
        );
      }

      pageHtml = await res.text();
    }

    const result = parseHtml(pageHtml, siteConfig, url);

    if (!result.text.trim()) {
      return Response.json(
        { error: "Could not find chapter content on this page" },
        { status: 422 }
      );
    }

    const cleaned = result.text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    let novelName = "";
    let chapterName = "";
    const titleStr = result.titleStr || "";

    if (siteConfig.lang === "zh") {
      const parts = titleStr.split(" - ");
      if (parts.length >= 3) {
        novelName = parts[0].trim();
        chapterName = parts[1].trim();
      } else if (parts.length === 2) {
        novelName = parts[0].trim();
        chapterName = parts[1].trim();
      } else {
        chapterName = titleStr;
      }
    }

    return Response.json({
      text: cleaned,
      prevUrl: result.prevUrl,
      nextUrl: result.nextUrl,
      title: titleStr,
      novelName,
      chapterName,
      lang: siteConfig.lang || "vi",
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
