"use client";

import { ReaderSettings, BG_OPTIONS } from "../lib/types";

interface Props {
  settings: ReaderSettings;
  textColor: string;
  onUpdate: (patch: Partial<ReaderSettings>) => void;
}

export default function SettingsPanel({ settings, textColor, onUpdate }: Props) {
  return (
    <div
      className="mb-4 p-4 rounded-lg border"
      style={{ borderColor: textColor + "20" }}
    >
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium block mb-2">Background</label>
          <div className="flex gap-2">
            {BG_OPTIONS.map((opt) => (
              <button
                key={opt.bg}
                onClick={() => onUpdate({ bgColor: opt.bg })}
                className="w-10 h-10 rounded-lg border-2 transition-transform"
                style={{
                  backgroundColor: opt.bg,
                  borderColor:
                    settings.bgColor === opt.bg ? "#3b82f6" : textColor + "20",
                  transform:
                    settings.bgColor === opt.bg ? "scale(1.1)" : "scale(1)",
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
                onUpdate({ fontSize: Math.max(12, settings.fontSize - 2) })
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
                onUpdate({ fontSize: parseInt(e.target.value, 10) })
              }
              className="flex-1"
            />
            <button
              onClick={() =>
                onUpdate({ fontSize: Math.min(32, settings.fontSize + 2) })
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
  );
}
