"use client";

interface Props {
  prevUrl: string | null;
  nextUrl: string | null;
  disabled: boolean;
  textColor: string;
  onNavigate: (url: string) => void;
}

export default function NavButtons({
  prevUrl,
  nextUrl,
  disabled,
  textColor,
  onNavigate,
}: Props) {
  return (
    <div className="flex justify-between py-3">
      <button
        onClick={() => prevUrl && onNavigate(prevUrl)}
        disabled={!prevUrl || disabled}
        className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ borderColor: textColor + "30", color: textColor }}
      >
        ← Previous
      </button>
      <button
        onClick={() => nextUrl && onNavigate(nextUrl)}
        disabled={!nextUrl || disabled}
        className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ borderColor: textColor + "30", color: textColor }}
      >
        Next →
      </button>
    </div>
  );
}
