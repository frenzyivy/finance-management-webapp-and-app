"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PiggyBank, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card transition-transform duration-300 lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <Link href="/" className="flex items-center gap-2">
            <PiggyBank className="h-7 w-7" style={{ color: "var(--komalfin-primary)" }} />
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: "var(--komalfin-primary)" }}
            >
              KomalFin
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Button
                key={item.href}
                variant="ghost"
                asChild
                className={cn(
                  "w-full justify-start gap-3 text-sm font-medium",
                  isActive &&
                    "bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800 dark:bg-teal-950 dark:text-teal-300 dark:hover:bg-teal-900"
                )}
              >
                <Link href={item.href} onClick={onClose}>
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isActive
                        ? "text-teal-600 dark:text-teal-400"
                        : "text-muted-foreground"
                    )}
                  />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* Bottom user section */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700 dark:bg-teal-900 dark:text-teal-300">
              K
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium leading-none">User</p>
              <p className="text-xs text-muted-foreground">user@email.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
