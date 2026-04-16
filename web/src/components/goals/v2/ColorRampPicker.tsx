"use client";

import { GOAL_COLOR_RAMPS, type GoalColorRamp } from "@/types/goals-v2";

interface ColorRampPickerProps {
  value: GoalColorRamp;
  onChange: (next: GoalColorRamp) => void;
}

export function ColorRampPicker({ value, onChange }: ColorRampPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {GOAL_COLOR_RAMPS.map((ramp) => {
        const selected = ramp.key === value;
        return (
          <button
            key={ramp.key}
            type="button"
            onClick={() => onChange(ramp.key)}
            aria-label={ramp.label}
            aria-pressed={selected}
            className="relative rounded-full transition-transform active:scale-95"
            style={{
              width: 32,
              height: 32,
              background: ramp.bg,
              border: `2px solid ${selected ? ramp.fill : "transparent"}`,
              boxShadow: selected ? `0 0 0 2px ${ramp.bg}` : "none",
            }}
          >
            <span
              className="absolute inset-1.5 rounded-full"
              style={{ background: ramp.fill }}
            />
          </button>
        );
      })}
    </div>
  );
}
