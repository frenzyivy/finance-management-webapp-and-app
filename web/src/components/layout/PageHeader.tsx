import React from "react";

interface PageHeaderProps {
  title: string;
  /** Optional right-aligned icon buttons (rendered inside a flex row). */
  actions?: React.ReactNode;
  /** Optional small subtitle/greeting above the title. */
  eyebrow?: string;
}

/**
 * Shared page header — Instrument Serif title + optional icon buttons.
 * Matches KOMALFI_DESIGN_SYSTEM.md §3.1 (dashboard) and §3.2 (inner screens).
 */
export function PageHeader({ title, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 pt-[52px] pb-5">
      <div className="flex flex-col">
        {eyebrow ? (
          <span className="text-[13px] font-medium text-[var(--text-secondary)] mb-0.5">
            {eyebrow}
          </span>
        ) : null}
        <h1
          className="font-[family-name:var(--font-instrument-serif)] text-[28px] leading-none text-[var(--text-primary)]"
          style={{ letterSpacing: "-0.01em" }}
        >
          {title}
        </h1>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/** 40px circular icon button used in PageHeader actions. */
export function HeaderIconButton({ children, className = "", ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border-soft)] flex items-center justify-center text-[var(--text-primary)] transition-transform active:scale-[0.94] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
