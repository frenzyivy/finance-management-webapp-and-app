"use client";

import { useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { encodeIcon, type IconRef } from "@/types/goals-v2";

import { GoalIcon, LUCIDE_ICON_NAMES } from "./GoalIcon";

const EMOJI_CHOICES = [
  "🎯", "💰", "🏠", "✈️", "🚗", "🎓", "💍", "👶",
  "🐶", "🐱", "💻", "📱", "📷", "🎸", "☕", "🍽️",
  "🛍️", "💎", "✨", "🏆", "📚", "🎨", "🏋️", "🩺",
  "🏝️", "🏔️", "⛺", "🚴", "🎁", "🌟", "❤️", "🌿",
];

interface IconPickerProps {
  value: IconRef;
  onChange: (ref: IconRef) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [tab, setTab] = useState<"lucide" | "emoji">(value.kind);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as "lucide" | "emoji")}
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="lucide">Icons</TabsTrigger>
        <TabsTrigger value="emoji">Emoji</TabsTrigger>
      </TabsList>

      <TabsContent value="lucide" className="mt-3">
        <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {LUCIDE_ICON_NAMES.map((name) => {
            const selected = value.kind === "lucide" && value.value === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => onChange({ kind: "lucide", value: name })}
                className="flex items-center justify-center rounded-md p-2 transition-colors"
                style={{
                  background: selected ? "var(--accent-light)" : "var(--surface-alt)",
                  color: selected ? "var(--accent)" : "var(--text-secondary)",
                }}
                aria-label={name}
                aria-pressed={selected}
              >
                <GoalIcon stored={encodeIcon({ kind: "lucide", value: name })} size="md" />
              </button>
            );
          })}
        </div>
      </TabsContent>

      <TabsContent value="emoji" className="mt-3">
        <div className="grid grid-cols-8 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {EMOJI_CHOICES.map((emoji) => {
            const selected = value.kind === "emoji" && value.value === emoji;
            return (
              <button
                key={emoji}
                type="button"
                onClick={() => onChange({ kind: "emoji", value: emoji })}
                className="flex items-center justify-center rounded-md p-2 text-xl transition-colors"
                style={{
                  background: selected ? "var(--accent-light)" : "var(--surface-alt)",
                }}
                aria-pressed={selected}
              >
                {emoji}
              </button>
            );
          })}
        </div>
      </TabsContent>
    </Tabs>
  );
}
