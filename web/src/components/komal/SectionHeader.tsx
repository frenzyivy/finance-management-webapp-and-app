import React from "react";
import Link from "next/link";

interface SectionHeaderProps {
  title: string;
  linkLabel?: string;
  linkHref?: string;
  right?: React.ReactNode;
}

/**
 * Section header with optional right-aligned link (MD §3.7).
 */
export function SectionHeader({
  title,
  linkLabel,
  linkHref,
  right,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 mb-[14px]">
      <h2
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: "var(--text-primary)",
        }}
      >
        {title}
      </h2>
      {right ? (
        right
      ) : linkHref && linkLabel ? (
        <Link
          href={linkHref}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--accent)",
          }}
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}
