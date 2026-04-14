"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PiggyBank, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_SECTIONS } from "@/lib/constants/navigation";
import type { NavItem, NavSection } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { SyncStatusIndicator } from "@/components/layout/sync-status";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/business") return pathname === "/business";
  return pathname.startsWith(href);
}

const accentStyles = {
  teal: {
    active: "bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-800 dark:bg-teal-950 dark:text-teal-300 dark:hover:bg-teal-900",
    icon: "text-teal-600 dark:text-teal-400",
  },
  blue: {
    active: "bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900",
    icon: "text-blue-600 dark:text-blue-400",
  },
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "user@email.com";
  const userInitial = userName.charAt(0).toUpperCase();

  async function handleLogout() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to log out. Please try again.");
      return;
    }
    router.push("/login");
    router.refresh();
  }

  function renderNavItem(item: NavItem, section: NavSection) {
    const isActive = isItemActive(pathname, item.href);
    const Icon = item.icon;
    const accent = section.accent || "teal";
    const styles = accentStyles[accent];

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
          isActive && styles.active
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            isActive ? styles.icon : "text-muted-foreground"
          )}
        />
        {item.label}
      </Link>
    );
  }

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
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="mb-4">
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => renderNavItem(item, section))}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom user section */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700 dark:bg-teal-900 dark:text-teal-300">
              {userInitial}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium leading-none truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
              <SyncStatusIndicator />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-destructive"
              onClick={handleLogout}
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
