"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import {
  CLIENT_STATUSES,
  ENGAGEMENT_TYPES,
} from "@/lib/constants/business-categories";
import type { BusinessClient } from "@/types/business";

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

const formSchema = z.object({
  name: z.string().min(1, { message: "Client name is required" }).max(100),
  industry: z.string().max(100).nullable(),
  country: z.string().max(100).nullable(),
  contact_name: z.string().max(100).nullable(),
  contact_email: z.string().email().nullable().or(z.literal("")),
  contact_phone: z.string().max(20).nullable(),
  engagement_type: z.enum(["project", "retainer", "hourly", "pilot", "one_off"]).nullable(),
  monthly_value: z.coerce.number().min(0).nullable(),
  start_date: z.string().nullable(),
  status: z.enum(["active", "prospect", "churned", "paused"]),
  notes: z.string().max(500).nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface BusinessClientFormProps {
  entry?: BusinessClient;
  onSuccess: () => void;
  onCancel: () => void;
}

export function BusinessClientForm({ entry, onSuccess, onCancel }: BusinessClientFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const isEditing = !!entry;

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      name: entry?.name ?? "",
      industry: entry?.industry ?? null,
      country: entry?.country ?? null,
      contact_name: entry?.contact_name ?? null,
      contact_email: entry?.contact_email ?? null,
      contact_phone: entry?.contact_phone ?? null,
      engagement_type: entry?.engagement_type ?? null,
      monthly_value: entry?.monthly_value ?? null,
      start_date: entry?.start_date ?? null,
      status: entry?.status ?? "active",
      notes: entry?.notes ?? null,
    },
  });

  const selectedEngagement = watch("engagement_type");
  const selectedStatus = watch("status");

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const payload = {
        name: values.name,
        industry: values.industry || null,
        country: values.country || null,
        contact_name: values.contact_name || null,
        contact_email: values.contact_email || null,
        contact_phone: values.contact_phone || null,
        engagement_type: values.engagement_type || null,
        monthly_value: values.monthly_value || null,
        start_date: values.start_date || null,
        status: values.status,
        notes: values.notes || null,
      };

      if (isEditing) {
        const { error } = await supabase.from("business_clients").update(payload).eq("id", entry.id);
        if (error) throw error;
        toast.success("Client updated");
      } else {
        const { error } = await supabase.from("business_clients").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success("Client added");
      }
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Client / Business Name</Label>
        <Input id="name" placeholder="e.g. Dr. Singh Dental Clinic" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="industry">Industry (optional)</Label>
          <Input id="industry" placeholder="e.g. Dental, SaaS" {...register("industry")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="country">Country (optional)</Label>
          <Input id="country" placeholder="e.g. India, Germany" {...register("country")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="contact_name">Contact Name</Label>
          <Input id="contact_name" placeholder="Name" {...register("contact_name")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact_email">Contact Email</Label>
          <Input id="contact_email" type="email" placeholder="email@example.com" {...register("contact_email")} />
          {errors.contact_email && <p className="text-xs text-destructive">{errors.contact_email.message}</p>}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact_phone">Contact Phone</Label>
          <Input id="contact_phone" placeholder="+91 98765 43210" {...register("contact_phone")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Engagement Type</Label>
          <Select value={selectedEngagement ?? ""} onValueChange={(val) => setValue("engagement_type", val as FormValues["engagement_type"])}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {ENGAGEMENT_TYPES.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Status</Label>
          <Select value={selectedStatus} onValueChange={(val) => setValue("status", val as FormValues["status"])}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLIENT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="monthly_value">Monthly Value (optional)</Label>
          <Input id="monthly_value" type="number" step="0.01" placeholder="0.00" {...register("monthly_value")} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="start_date">Start Date (optional)</Label>
        <Input id="start_date" type="date" {...register("start_date")} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <textarea id="notes" rows={2} placeholder="Any additional details..." className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" {...register("notes")} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {isEditing ? "Update" : "Add Client"}
        </Button>
      </div>
    </form>
  );
}
