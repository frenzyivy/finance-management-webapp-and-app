"use client";

import {
  Users,
  User,
  Briefcase,
  Shield,
  Home,
  Heart,
  Car,
  GraduationCap,
  Plane,
  Gift,
  PiggyBank,
  Target,
  Star,
  TrendingUp,
  Wallet,
  BookOpen,
  Smartphone,
  Laptop,
  Bike,
  Baby,
  Dog,
  Cat,
  Camera,
  Music,
  Coffee,
  Utensils,
  ShoppingBag,
  Gem,
  Sparkles,
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Anchor,
  Tent,
  Mountain,
  Palette,
  Dumbbell,
  Stethoscope,
  Building2,
  type LucideIcon,
} from "lucide-react";

import { decodeIcon } from "@/types/goals-v2";

export const LUCIDE_ICON_MAP: Record<string, LucideIcon> = {
  Users,
  User,
  Briefcase,
  Shield,
  Home,
  Heart,
  Car,
  GraduationCap,
  Plane,
  Gift,
  PiggyBank,
  Target,
  Star,
  TrendingUp,
  Wallet,
  BookOpen,
  Smartphone,
  Laptop,
  Bike,
  Baby,
  Dog,
  Cat,
  Camera,
  Music,
  Coffee,
  Utensils,
  ShoppingBag,
  Gem,
  Sparkles,
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Anchor,
  Tent,
  Mountain,
  Palette,
  Dumbbell,
  Stethoscope,
  Building2,
};

export const LUCIDE_ICON_NAMES = Object.keys(LUCIDE_ICON_MAP);

const SIZE_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 16,
  md: 20,
  lg: 24,
};

interface GoalIconProps {
  stored: string | null | undefined;
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

export function GoalIcon({
  stored,
  size = "md",
  color,
  className,
}: GoalIconProps) {
  const ref = decodeIcon(stored);
  const px = SIZE_PX[size];

  if (ref.kind === "emoji") {
    return (
      <span
        className={className}
        style={{ fontSize: px + 2, lineHeight: 1 }}
        aria-hidden
      >
        {ref.value}
      </span>
    );
  }

  const Icon = LUCIDE_ICON_MAP[ref.value] ?? Target;
  return (
    <Icon
      size={px}
      color={color}
      strokeWidth={1.8}
      className={className}
      aria-hidden
    />
  );
}
