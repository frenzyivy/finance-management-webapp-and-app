import React from "react";

interface TabSwitcherProps<T extends string> {
  tabs: Array<{ key: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

/**
 * Pill-style tab switcher (MD §3.9).
 */
export function TabSwitcher<T extends string>({
  tabs,
  value,
  onChange,
}: TabSwitcherProps<T>) {
  return (
    <div className="px-6 mb-5 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className="transition-transform active:scale-[0.96] shrink-0"
            style={{
              padding: "8px 16px",
              borderRadius: 100,
              fontSize: 13,
              fontWeight: 500,
              background: active ? "var(--text-primary)" : "var(--surface)",
              color: active ? "var(--bg)" : "var(--text-secondary)",
              border: active ? "1px solid transparent" : "1px solid var(--border-soft)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
