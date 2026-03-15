export interface SavedChapter {
  url: string;
  title: string;
  novelName: string;
  novelSlug: string;
  simplifiedText: string;
  prevUrl: string | null;
  nextUrl: string | null;
  savedAt: number;
}

export type AIProvider = "openai" | "gemini" | "claude";

export interface AIModelOption {
  provider: AIProvider;
  label: string;
  models: string[];
}

export const AI_MODEL_OPTIONS: AIModelOption[] = [
  {
    provider: "openai",
    label: "OpenAI",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4-turbo",
      "o4-mini",
      "o3",
      "o3-mini",
    ],
  },
  {
    provider: "gemini",
    label: "Google Gemini",
    models: [
      "gemini-2.5-flash-preview-05-20",
      "gemini-2.5-pro-preview-05-06",
      "gemini-2.0-flash",
      "gemini-2.0-flash-lite",
      "gemini-1.5-pro",
      "gemini-1.5-flash",
    ],
  },
  {
    provider: "claude",
    label: "Anthropic Claude",
    models: [
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-haiku-4-5-20251001",
      "claude-3-5-sonnet-20241022",
    ],
  },
];

export interface ReaderSettings {
  bgColor: string;
  fontSize: number;
  apiKey: string;
  aiModel: string;
}

export const BG_OPTIONS = [
  { bg: "#ffffff", text: "#1a1a1a", label: "White" },
  { bg: "#f5f5dc", text: "#3b3024", label: "Sepia" },
  { bg: "#d4edda", text: "#1b3a26", label: "Green" },
  { bg: "#1a1a2e", text: "#d4d4d4", label: "Dark" },
  { bg: "#0d0d0d", text: "#cccccc", label: "Black" },
];

export function getTextColor(bgColor: string): string {
  return BG_OPTIONS.find((o) => o.bg === bgColor)?.text ?? "#1a1a1a";
}
