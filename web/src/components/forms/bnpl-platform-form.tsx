"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { BNPL_PLATFORM_TYPES } from "@/lib/constants/categories";
import {
  BNPL_PLATFORM_TEMPLATES,
  type BnplPlatformTemplate,
} from "@/lib/constants/bnpl-templates";
import type { BnplPlatform } from "@/types/bnpl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const platformFormSchema = z.object({
  name: z.string().min(1, { error: "Platform name is required" }).max(100),
  platform_type: z.enum(["bnpl_app", "credit_card_emi", "store_emi", "finance_company"], {
    error: "Please select a platform type",
  }),
  credit_limit: z.coerce
    .number({ error: "Must be a number" })
    .positive({ error: "Must be greater than 0" })
    .optional()
    .or(z.literal("")),
  billing_day: z.coerce
    .number({ error: "Must be a number" })
    .int()
    .min(1, { error: "Day must be 1-31" })
    .max(31, { error: "Day must be 1-31" })
    .optional()
    .or(z.literal("")),
  color: z.string().min(1),
  notes: z.string().max(500).optional().or(z.literal("")),
});

type PlatformFormValues = z.infer<typeof platformFormSchema>;

interface BnplPlatformFormProps {
  platform?: BnplPlatform;
  onSubmit: (
    data: Omit<BnplPlatform, "id" | "user_id" | "created_at" | "updated_at">
  ) => Promise<{ error: unknown }>;
  onUpdate?: (
    id: string,
    data: Partial<Pick<BnplPlatform, "name" | "platform_type" | "credit_limit" | "billing_day" | "color" | "status" | "notes">>
  ) => Promise<{ error: unknown }>;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BnplPlatformForm({
  platform,
  onSubmit,
  onUpdate,
  onSuccess,
  onCancel,
}: BnplPlatformFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!platform;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PlatformFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(platformFormSchema) as any,
    defaultValues: {
      name: platform?.name ?? "",
      platform_type: platform?.platform_type ?? undefined,
      credit_limit: platform?.credit_limit ?? "",
      billing_day: platform?.billing_day ?? "",
      color: platform?.color ?? "#6b7280",
      notes: platform?.notes ?? "",
    },
  });

  const handleTemplateSelect = (template: BnplPlatformTemplate) => {
    setValue("name", template.name, { shouldValidate: true });
    setValue("platform_type", template.platform_type, { shouldValidate: true });
    setValue("color", template.color);
  };

  const selectedType = watch("platform_type");

  const handleFormSubmit = async (values: PlatformFormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        name: values.name,
        platform_type: values.platform_type,
        credit_limit:
          values.credit_limit !== "" && values.credit_limit !== undefined
            ? Number(values.credit_limit)
            : null,
        billing_day:
          values.billing_day !== "" && values.billing_day !== undefined
            ? Number(values.billing_day)
            : null,
        color: values.color,
        status: platform?.status ?? ("active" as const),
        notes: values.notes || null,
      };

      if (isEditing && onUpdate) {
        const { error } = await onUpdate(platform.id, payload);
        if (error) throw error;
        toast.success("Platform updated successfully");
      } else {
        const { error } = await onSubmit(payload);
        if (error) throw error;
        toast.success("Platform added successfully");
      }

      onSuccess();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Something went wrong";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="grid gap-4">
      {/* Quick templates */}
      {!isEditing && (
        <div className="grid gap-2">
          <Label>Quick Select (optional)</Label>
          <div className="flex flex-wrap gap-1.5">
            {BNPL_PLATFORM_TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => handleTemplateSelect(t)}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Name + Type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="platform_name">Platform Name</Label>
          <Input
            id="platform_name"
            placeholder="e.g. Amazon Pay Later"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>

        <div className="grid gap-2">
          <Label>Platform Type</Label>
          <Select
            value={selectedType ?? ""}
            onValueChange={(val) =>
              val && setValue("platform_type", val as PlatformFormValues["platform_type"], {
                shouldValidate: true,
              })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {BNPL_PLATFORM_TYPES.map((pt) => (
                <SelectItem key={pt.value} value={pt.value}>
                  {pt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.platform_type && (
            <p className="text-xs text-destructive">
              {errors.platform_type.message}
            </p>
          )}
        </div>
      </div>

      {/* Credit Limit + Billing Day */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="credit_limit">Credit Limit (optional)</Label>
          <Input
            id="credit_limit"
            type="number"
            step="0.01"
            placeholder="e.g. 50000"
            {...register("credit_limit")}
          />
          {errors.credit_limit && (
            <p className="text-xs text-destructive">
              {errors.credit_limit.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="billing_day">Billing Day (optional)</Label>
          <Input
            id="billing_day"
            type="number"
            min={1}
            max={31}
            placeholder="e.g. 1"
            {...register("billing_day")}
          />
          <p className="text-[10px] text-muted-foreground">
            Set to group EMIs into monthly bills due on this day
          </p>
          {errors.billing_day && (
            <p className="text-xs text-destructive">
              {errors.billing_day.message}
            </p>
          )}
        </div>
      </div>

      {/* Color */}
      <div className="grid gap-2">
        <Label htmlFor="color">Color</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            id="color"
            className="h-9 w-12 cursor-pointer rounded-md border border-input"
            {...register("color")}
          />
          <Input readOnly value={watch("color")} className="flex-1" />
        </div>
      </div>

      {/* Notes */}
      <div className="grid gap-2">
        <Label htmlFor="platform_notes">Notes (optional)</Label>
        <textarea
          id="platform_notes"
          rows={2}
          placeholder="Any additional details..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          {...register("notes")}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Update Platform" : "Add Platform"}
        </Button>
      </div>
    </form>
  );
}
