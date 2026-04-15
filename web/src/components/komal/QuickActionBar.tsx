import React from "react";

interface Action {
  label: string;
  onClick?: () => void;
  href?: string;
  icon: React.ReactNode;
}

interface QuickActionBarProps {
  actions: Action[];
}

/**
 * Three-item horizontal quick action row (MD §3.5).
 * Used on the Dashboard just below the hero card.
 */
export function QuickActionBar({ actions }: QuickActionBarProps) {
  return (
    <div className="mx-6 mb-6 flex gap-[10px]">
      {actions.map((a, i) => {
        const Tag: React.ElementType = a.href ? "a" : "button";
        return (
          <Tag
            key={i}
            href={a.href}
            onClick={a.onClick}
            type={a.href ? undefined : "button"}
            className="flex-1 flex items-center justify-center gap-2 transition-transform active:scale-[0.97]"
            style={{
              padding: "13px 12px",
              background: "var(--surface)",
              borderRadius: 12,
              border: "1px solid var(--border-soft)",
              color: "var(--text-primary)",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <span style={{ color: "var(--accent)", display: "inline-flex" }}>
              {a.icon}
            </span>
            <span>{a.label}</span>
          </Tag>
        );
      })}
    </div>
  );
}
