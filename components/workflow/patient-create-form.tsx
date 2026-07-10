"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createPatientSchema, type CreatePatientInput } from "@/lib/services/schemas";

export function PatientCreateForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      hospital_number: "",
      patient_name: "",
      consultant: "",
      specialty: "",
      procedure: "",
      cepod_priority: "Urgent",
      decision_to_operate_time: ""
    }
  });

  async function onSubmit(values: CreatePatientInput) {
    const response = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    const result = (await response.json()) as { error?: string; demo?: boolean };

    if (!response.ok) {
      toast.error(result.error ?? "Unable to create patient");
      return;
    }

    toast.success(result.demo ? "Demo patient created." : "Patient created.");
    form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Create Patient</CardTitle>
            <CardDescription>Decision to Operate is the first workflow timestamp.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => setOpen((current) => !current)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            New
          </Button>
        </div>
      </CardHeader>
      {open ? (
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <Field label="Hospital Number" error={form.formState.errors.hospital_number?.message}>
              <Input {...form.register("hospital_number")} autoComplete="off" />
            </Field>
            <Field label="Patient Name (optional)">
              <Input {...form.register("patient_name")} autoComplete="off" />
            </Field>
            <Field label="Consultant" error={form.formState.errors.consultant?.message}>
              <Input {...form.register("consultant")} />
            </Field>
            <Field label="Specialty" error={form.formState.errors.specialty?.message}>
              <Input {...form.register("specialty")} />
            </Field>
            <Field label="Procedure" error={form.formState.errors.procedure?.message}>
              <Input {...form.register("procedure")} />
            </Field>
            <Field label="Priority">
              <Select {...form.register("cepod_priority")}>
                <option>Immediate</option>
                <option>Urgent</option>
                <option>Expedited</option>
                <option>Elective</option>
              </Select>
            </Field>
            <Field label="Decision to Operate time">
              <Input type="datetime-local" {...form.register("decision_to_operate_time")} />
            </Field>
            <div className="flex items-end">
              <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating..." : "Create Patient"}
              </Button>
            </div>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {React.isValidElement(children) ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id }) : children}
      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
