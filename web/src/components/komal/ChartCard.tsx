import React from "react";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  legend?: Array<{ color: string; label: string }>;
  children: React.ReactNode;
}

/**
 * Chart container — surface, title, legend (MD §3.10).
 */
export function ChartCard({ title, subtitle, legend, children }: ChartCardProps) {
  return (
    <div
      className="mx-6 mb-4"
      style={{
        background: "var(--surface)",
        borderRadius: 16,
        padding: 20,
        border: "1px solid var(--border-soft)",
      }}
    >
      <div className="flex items-start justify-between">
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </div>
          {subtitle ? (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-tertiary)",
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          ) : null}
        </div>
        {legend && legend.length ? (
          <div className="flex items-center gap-4">
            {legend.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className="inline-block rounded-full"
                  style={{ width: 8, height: 8, background: l.color }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {l.label}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
