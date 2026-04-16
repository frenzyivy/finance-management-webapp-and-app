"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoalsStore } from "@/lib/stores/goals-store";
import {
  encodeIcon,
  type GoalColorRamp,
  type IconRef,
} from "@/types/goals-v2";

import { createCategory } from "@/app/(dashboard)/goals/v2/actions";
import { IconPicker } from "./IconPicker";
import { ColorRampPicker } from "./ColorRampPicker";

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCategoryDialog({
  open,
  onOpenChange,
}: CreateCategoryDialogProps) {
  const upsertCategory = useGoalsStore((s) => s.upsertCategory);
  const [name, setName] = useState("");
  const [color, setColor] = useState<GoalColorRamp>("teal");
  const [icon, setIcon] = useState<IconRef>({ kind: "lucide", value: "Target" });
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setColor("teal");
    setIcon({ kind: "lucide", value: "Target" });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    startTransition(async () => {
      try {
        const cat = await createCategory({
          name: trimmed,
          icon: encodeIcon(icon),
          color,
        });
        upsertCategory(cat);
        toast.success("Category created");
        reset();
        onOpenChange(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create";
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New category</DialogTitle>
          <DialogDescription>
            Group your goals by theme. Pick an icon and color.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="e.g. Travel"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Color</Label>
            <ColorRampPicker value={color} onChange={setColor} />
          </div>

          <div className="grid gap-1.5">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
