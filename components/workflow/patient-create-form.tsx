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
import {
  FREE_TEXT_OPERATION,
  getConsultantsForSpecialty,
  getOperationsForSpecialty,
  SUPPORTED_SPECIALTIES
} from "@/lib/constants/clinical-teams";
import { createPatientSchema, type CreatePatientInput } from "@/lib/services/schemas";

export function PatientCreateForm() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [operationSelection, setOperationSelection] = React.useState("");
  const defaultOperationDate = React.useMemo(() => toDateInputValue(new Date()), []);
  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      hospital_number: "",
      patient_name: "",
      consultant: "",
      specialty: "",
      procedure: "",
      cepod_priority: "P2",
      operation_date: defaultOperationDate,
      decision_to_operate_time: ""
    }
  });
  const selectedSpecialty = form.watch("specialty");
  const selectedProcedure = form.watch("procedure");
  const consultantOptions = React.useMemo(() => getConsultantsForSpecialty(selectedSpecialty), [selectedSpecialty]);
  const operationOptions = React.useMemo(() => getOperationsForSpecialty(selectedSpecialty), [selectedSpecialty]);
  const customOperation = operationSelection === FREE_TEXT_OPERATION;

  React.useEffect(() => {
    const currentConsultant = form.getValues("consultant");
    const currentProcedure = form.getValues("procedure");
    if (!selectedSpecialty) {
      if (currentConsultant) {
        form.setValue("consultant", "", { shouldDirty: true, shouldValidate: true });
      }
      if (currentProcedure) {
        form.setValue("procedure", "", { shouldDirty: true, shouldValidate: true });
      }
      setOperationSelection("");
      return;
    }

    if (!consultantOptions.includes(currentConsultant as never)) {
      form.setValue("consultant", "", { shouldDirty: true, shouldValidate: true });
    }

    if (operationSelection !== FREE_TEXT_OPERATION && currentProcedure && !operationOptions.includes(currentProcedure)) {
      form.setValue("procedure", "", { shouldDirty: true, shouldValidate: true });
      setOperationSelection("");
    }
  }, [consultantOptions, form, operationOptions, operationSelection, selectedSpecialty]);

  async function onSubmit(values: CreatePatientInput) {
    const payload = {
      ...values,
      decision_to_operate_time: values.decision_to_operate_time
        ? new Date(values.decision_to_operate_time).toISOString()
        : ""
    };
    const response = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = (await response.json()) as { error?: string; demo?: boolean };

    if (!response.ok) {
      toast.error(result.error ?? "Unable to create patient");
      return;
    }

    toast.success(result.demo ? "Demo patient created." : "Patient created.");
    form.reset({
      hospital_number: "",
      patient_name: "",
      consultant: "",
      specialty: "",
      procedure: "",
      cepod_priority: "P2",
      operation_date: toDateInputValue(new Date()),
      decision_to_operate_time: ""
    });
    setOperationSelection("");
    setOpen(false);
    router.refresh();
  }

  function setCurrentDateTime() {
    form.setValue("decision_to_operate_time", toDateTimeLocalValue(new Date()), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Create Patient</CardTitle>
            <CardDescription>Patient on list is the first workflow timestamp.</CardDescription>
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
            <Field label="Specialty" error={form.formState.errors.specialty?.message}>
              <Select {...form.register("specialty")}>
                <option value="">Select specialty</option>
                {SUPPORTED_SPECIALTIES.map((specialty) => (
                  <option key={specialty} value={specialty}>
                    {specialty}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Consultant" error={form.formState.errors.consultant?.message}>
              <Select {...form.register("consultant")} disabled={!selectedSpecialty}>
                <option value="">{selectedSpecialty ? "Select consultant" : "Select specialty first"}</option>
                {consultantOptions.map((consultant) => (
                  <option key={consultant} value={consultant}>
                    {consultant}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="space-y-2">
              <Label htmlFor="operation-select">Operation</Label>
              <Select
                id="operation-select"
                value={operationSelection}
                disabled={!selectedSpecialty}
                onChange={(event) => {
                  const value = event.target.value;
                  setOperationSelection(value);
                  form.setValue("procedure", value === FREE_TEXT_OPERATION ? "" : value, {
                    shouldDirty: true,
                    shouldValidate: true
                  });
                }}
              >
                <option value="">{selectedSpecialty ? "Select operation" : "Select specialty first"}</option>
                {operationOptions.map((operation) => (
                  <option key={operation} value={operation}>
                    {operation}
                  </option>
                ))}
                <option value={FREE_TEXT_OPERATION}>Free text</option>
              </Select>
              {customOperation ? (
                <Input
                  className="mt-2"
                  placeholder="Type operation"
                  autoComplete="off"
                  value={customOperation ? selectedProcedure : ""}
                  onChange={(event) => {
                    form.setValue("procedure", event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true
                    });
                  }}
                />
              ) : null}
              {form.formState.errors.procedure?.message ? (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.procedure.message}</p>
              ) : null}
            </div>
            <Field label="Priority">
              <Select {...form.register("cepod_priority")}>
                <option value="P1">P1: Immediate (&lt;24hrs)</option>
                <option value="P2">P2: Urgent</option>
                <option value="P3">P3: Expedited</option>
                <option value="P4">P4: Elective</option>
              </Select>
            </Field>
            <Field label="Operation date">
              <Input type="date" {...form.register("operation_date")} />
            </Field>
            <div className="space-y-2">
              <Label htmlFor="patient-on-list-time">Patient on list time</Label>
              <div className="flex items-center gap-2">
                <Input id="patient-on-list-time" type="datetime-local" className="min-w-0 flex-1" {...form.register("decision_to_operate_time")} />
                <Button type="button" variant="outline" className="shrink-0 px-4" onClick={setCurrentDateTime}>
                  Now
                </Button>
              </div>
            </div>
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

function toDateTimeLocalValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function toDateInputValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
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
