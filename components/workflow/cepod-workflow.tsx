"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronDown, Clock, GripVertical, QrCode, Search, UserRound, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { AdvancePatientButton } from "@/components/workflow/advance-patient-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DelayReason, PatientWithStage, WorkflowStage } from "@/lib/types/domain";
import { getNextStage } from "@/lib/services/workflow-engine";
import { useRealtimeWorkflow } from "@/hooks/use-realtime-workflow";
import { cn } from "@/lib/utils/cn";
import { getDelayStatus } from "@/lib/utils/delay";
import { priorityLabel, priorityRowClasses, priorityTone } from "@/lib/utils/priority";
import { formatUnresolvedThreshold } from "@/lib/utils/reconciliation";

export function CepodWorkflow({
  patients,
  stages,
  delayReasons,
  todayIso,
  canManageWorkflow,
  createPatient
}: {
  patients: PatientWithStage[];
  stages: WorkflowStage[];
  delayReasons: DelayReason[];
  todayIso: string;
  canManageWorkflow: boolean;
  createPatient?: React.ReactNode;
}) {
  const router = useRouter();
  const refreshPatients = React.useCallback(() => router.refresh(), [router]);
  useRealtimeWorkflow(refreshPatients);
  const [query, setQuery] = React.useState("");
  const [expandedId, setExpandedId] = React.useState("");
  const [orderedIds, setOrderedIds] = React.useState(() => patients.map((patient) => patient.id));
  const [draggedId, setDraggedId] = React.useState<string | null>(null);
  const [movingPatientId, setMovingPatientId] = React.useState<string | null>(null);
  const initialDate = React.useMemo(() => new Date(todayIso), [todayIso]);
  const now = useMinuteClock();
  const displayDate = now ?? initialDate;
  const todayKey = toDateKey(displayDate);

  React.useEffect(() => {
    const intervalId = window.setInterval(refreshPatients, 60_000);
    return () => window.clearInterval(intervalId);
  }, [refreshPatients]);

  React.useEffect(() => {
    setOrderedIds((current) => {
      const incomingIds = patients.map((patient) => patient.id);
      const retained = current.filter((id) => incomingIds.includes(id));
      const added = incomingIds.filter((id) => !retained.includes(id));
      return [...retained, ...added];
    });
  }, [patients]);

  React.useEffect(() => {
    if (expandedId && !patients.some((patient) => patient.id === expandedId)) {
      setExpandedId("");
    }
  }, [patients, expandedId]);

  const livePatients = React.useMemo(
    () =>
      patients.map((patient) => {
        const stageStartedAt = patient.last_event?.timestamp ?? patient.created_at;
        const elapsed = now ? Math.max(0, Math.floor((now.getTime() - Date.parse(stageStartedAt)) / 60_000)) : patient.elapsed_minutes;
        return {
          ...patient,
          elapsed_minutes: elapsed,
          delay_status: getDelayStatus(elapsed, patient.stage.delay_threshold_minutes)
        };
      }),
    [patients, now]
  );

  const orderedPatients = React.useMemo(() => {
    const byId = new Map(livePatients.map((patient) => [patient.id, patient]));
    return orderedIds.map((id) => byId.get(id)).filter((patient): patient is PatientWithStage => Boolean(patient));
  }, [livePatients, orderedIds]);

  const unresolvedPatients = orderedPatients.filter((patient) => patient.unresolved);
  const livePatientsForLists = orderedPatients.filter((patient) => !patient.unresolved);
  const cepodPatients = livePatientsForLists.filter((patient) => isCepodDue(patient, displayDate));
  const plannedPatients = livePatientsForLists
    .filter((patient) => !isCepodDue(patient, displayDate))
    .sort((a, b) => getOperationDate(a).localeCompare(getOperationDate(b)) || Date.parse(a.created_at) - Date.parse(b.created_at));

  const cepodFilteredPatients = cepodPatients.filter(matchesQuery);
  const plannedFilteredPatients = plannedPatients.filter(matchesQuery);
  const unresolvedFilteredPatients = unresolvedPatients.filter(matchesQuery);

  const expandedPatient = expandedId ? orderedPatients.find((patient) => patient.id === expandedId) ?? null : null;

  function matchesQuery(patient: PatientWithStage) {
    const haystack = [
      patient.hospital_number,
      patient.patient_name ?? "",
      patient.specialty,
      patient.consultant,
      patient.procedure,
      patient.cepod_priority,
      patient.stage.name
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  }

  function movePatient(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;
    setOrderedIds((current) => {
      const next = [...current];
      const sourceIndex = next.indexOf(sourceId);
      const targetIndex = next.indexOf(targetId);
      if (sourceIndex === -1 || targetIndex === -1) return current;
      next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, sourceId);
      return next;
    });
  }

  async function movePatientToDate(patientId: string, operationDate: string, successMessage: string) {
    setMovingPatientId(patientId);
    const response = await fetch("/api/patients/list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient_id: patientId,
        operation_date: operationDate
      })
    });
    const result = (await response.json()) as { error?: string; demo?: boolean };
    setMovingPatientId(null);

    if (!response.ok) {
      toast.error(result.error ?? "Unable to move patient");
      return;
    }

    toast.success(result.demo ? "Demo list updated." : successMessage);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <PatientListCard
        title={`CEPOD list ${formatLongDate(displayDate)}`}
        description={canManageWorkflow ? "Drag patients to reorder the live list. Use the arrow to expand workflow details." : "Review the current CEPOD list. Use the arrow to view patient and pathway details."}
        firstColumnHeader="Order"
        query={query}
        onQueryChange={setQuery}
        patients={cepodFilteredPatients}
        emptyMessage="No CEPOD patients match this search."
        renderPatient={(patient, index) => (
          <PatientListEntry
            key={patient.id}
            listType="cepod"
            patient={patient}
            stages={stages}
            delayReasons={delayReasons}
            position={index + 1}
            firstColumnValue={`${index + 1}`}
            expanded={patient.id === expandedPatient?.id}
            dragging={draggedId === patient.id}
            moving={movingPatientId === patient.id}
            canManageWorkflow={canManageWorkflow}
            onToggle={() => setExpandedId((current) => (current === patient.id ? "" : patient.id))}
            onMoveToCepod={() => movePatientToDate(patient.id, todayKey, "Patient moved to CEPOD list.")}
            onMoveToPlanned={() => movePatientToDate(patient.id, tomorrowDateKey(displayDate), "Patient moved to planned list.")}
            onDragStart={() => setDraggedId(patient.id)}
            onDragEnd={() => setDraggedId(null)}
            onDrop={() => {
              if (draggedId) movePatient(draggedId, patient.id);
              setDraggedId(null);
            }}
          />
        )}
      />

      <PatientListCard
        title="Later planned cases"
        description="Future-dated and rolled-over cases. These move onto the CEPOD list when their operation date is due."
        firstColumnHeader="Date"
        query={query}
        onQueryChange={setQuery}
        patients={plannedFilteredPatients}
        emptyMessage="No later planned cases match this search."
        renderPatient={(patient) => (
          <PatientListEntry
            key={patient.id}
            listType="planned"
            patient={patient}
            stages={stages}
            delayReasons={delayReasons}
            firstColumnValue={formatShortDate(getOperationDate(patient))}
            expanded={patient.id === expandedPatient?.id}
            dragging={false}
            moving={movingPatientId === patient.id}
            canManageWorkflow={canManageWorkflow}
            onToggle={() => setExpandedId((current) => (current === patient.id ? "" : patient.id))}
            onMoveToCepod={() => movePatientToDate(patient.id, todayKey, "Patient moved to CEPOD list.")}
            onMoveToPlanned={() => movePatientToDate(patient.id, tomorrowDateKey(displayDate), "Patient moved to planned list.")}
            onDragStart={() => undefined}
            onDragEnd={() => undefined}
            onDrop={() => undefined}
          />
        )}
      />

      {createPatient}

      <WorkflowTimeline stages={stages} patient={expandedPatient} />

      <PatientListCard
        id="unresolved-cases"
        title={`Unresolved cases (${unresolvedPatients.length})`}
        description="These patients exceeded the safe review window. Confirm the current stage, advance the workflow, or cancel with a reason. No clinical outcome has been assumed."
        firstColumnHeader="Alert"
        query={query}
        onQueryChange={setQuery}
        patients={unresolvedFilteredPatients}
        emptyMessage={unresolvedPatients.length ? "No unresolved cases match this search." : "No unresolved cases require review."}
        alert
        collapsible
        initiallyCollapsed
        renderPatient={(patient) => (
          <PatientListEntry
            key={patient.id}
            listType="unresolved"
            patient={patient}
            stages={stages}
            delayReasons={delayReasons}
            firstColumnValue="Review"
            expanded={patient.id === expandedPatient?.id}
            dragging={false}
            moving={false}
            canManageWorkflow={canManageWorkflow}
            onToggle={() => setExpandedId((current) => (current === patient.id ? "" : patient.id))}
            onMoveToCepod={() => undefined}
            onMoveToPlanned={() => undefined}
            onDragStart={() => undefined}
            onDragEnd={() => undefined}
            onDrop={() => undefined}
          />
        )}
      />
    </div>
  );
}

function PatientListCard({
  id,
  title,
  description,
  firstColumnHeader,
  query,
  onQueryChange,
  patients,
  emptyMessage,
  renderPatient,
  alert = false,
  collapsible = false,
  initiallyCollapsed = false
}: {
  id?: string;
  title: string;
  description: string;
  firstColumnHeader: string;
  query: string;
  onQueryChange: (value: string) => void;
  patients: PatientWithStage[];
  emptyMessage: string;
  renderPatient: (patient: PatientWithStage, index: number) => React.ReactNode;
  alert?: boolean;
  collapsible?: boolean;
  initiallyCollapsed?: boolean;
}) {
  const [isOpen, setIsOpen] = React.useState(!initiallyCollapsed);
  const contentVisible = !collapsible || isOpen;
  const contentId = id ? `${id}-content` : undefined;

  return (
    <Card id={id} className={cn(alert && "border-red-300 bg-card dark:border-red-900 dark:bg-red-950/10")}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {alert ? <AlertTriangle className="h-5 w-5 text-red-700 dark:text-red-300" aria-hidden="true" /> : null}
              {title}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            {contentVisible ? (
              <div className="relative w-full lg:w-96">
                <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <Input className="pl-10" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search hospital, name, consultant, specialty" />
              </div>
            ) : null}
            {collapsible ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0"
                aria-expanded={isOpen}
                aria-controls={contentId}
                onClick={() => setIsOpen((current) => !current)}
              >
                {isOpen ? "Collapse" : "Expand"}
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "rotate-180")} aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {contentVisible ? <CardContent id={contentId} className="space-y-3">
        <div className="hidden rounded-md border bg-muted/70 px-3 py-2 text-xs font-bold uppercase tracking-normal text-muted-foreground lg:grid lg:grid-cols-[84px_1fr_1fr_1fr_1fr_1.3fr_90px_1.2fr_100px_80px_40px] lg:gap-3">
          <span>{firstColumnHeader}</span>
          <span>Hospital no.</span>
          <span>Patient</span>
          <span>Specialty</span>
          <span>Consultant</span>
          <span>Procedure</span>
          <span>Priority</span>
          <span>Current stage</span>
          <span>Started</span>
          <span>Elapsed</span>
          <span className="sr-only">Expand</span>
        </div>

        <div className="space-y-2">{patients.map(renderPatient)}</div>

        {!patients.length ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : null}
      </CardContent> : null}
    </Card>
  );
}

function PatientListEntry({
  listType,
  patient,
  stages,
  delayReasons,
  position,
  firstColumnValue,
  expanded,
  dragging,
  moving,
  canManageWorkflow,
  onToggle,
  onMoveToCepod,
  onMoveToPlanned,
  onDragStart,
  onDragEnd,
  onDrop
}: {
  listType: "cepod" | "planned" | "unresolved";
  patient: PatientWithStage;
  stages: WorkflowStage[];
  delayReasons: DelayReason[];
  position?: number;
  firstColumnValue: string;
  expanded: boolean;
  dragging: boolean;
  moving: boolean;
  canManageWorkflow: boolean;
  onToggle: () => void;
  onMoveToCepod: () => void;
  onMoveToPlanned: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const nextStage = getNextStage(stages, patient.current_stage);

  return (
    <article
      onDragOver={canManageWorkflow ? (event) => event.preventDefault() : undefined}
      onDrop={canManageWorkflow ? onDrop : undefined}
      className={cn(
        "rounded-lg border transition-colors duration-200",
        listType === "unresolved"
          ? "border-red-400 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/35 dark:text-red-50"
          : priorityRowClasses(patient.cepod_priority),
        expanded && "ring-4 ring-ring/20",
        dragging && "opacity-50"
      )}
    >
      <div className="grid grid-cols-[56px_1fr_auto] items-start gap-2 p-3 lg:grid-cols-[84px_1fr_1fr_1fr_1fr_1.3fr_90px_1.2fr_100px_80px_40px] lg:items-center lg:gap-3">
        <div className="flex items-center gap-1">
          {listType === "cepod" ? (
            canManageWorkflow ? (
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", patient.id);
                  onDragStart();
                }}
                onDragEnd={onDragEnd}
                aria-label={`Drag patient ${position}`}
                className="flex h-11 w-8 cursor-grab items-center justify-center rounded-md hover:bg-background/60 active:cursor-grabbing"
              >
                <GripVertical className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : <span className="h-11 w-2" aria-hidden="true" />
          ) : listType === "planned" ? (
            <CalendarDays className="ml-2 h-5 w-5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="ml-2 h-5 w-5 text-red-700 dark:text-red-300" aria-hidden="true" />
          )}
          <span className="min-w-6 text-center text-sm font-bold">{firstColumnValue}</span>
        </div>

        <div className="min-h-11 text-left lg:contents">
          <div>
            <p className="text-base font-bold">{patient.hospital_number}</p>
            <p className="text-sm font-semibold lg:hidden">{patient.patient_name || "Patient name not recorded"}</p>
          </div>
          <div className="hidden lg:block">{patient.patient_name || "Not recorded"}</div>
          <div className="hidden lg:block">{patient.specialty}</div>
          <div className="hidden lg:block">{patient.consultant}</div>
          <div className="hidden min-w-0 lg:block">
            <p className="truncate">{patient.procedure}</p>
          </div>
          <div className="hidden lg:block">
            <Badge tone={priorityTone(patient.cepod_priority)}>{priorityLabel(patient.cepod_priority)}</Badge>
          </div>
          <div className="hidden lg:block">{patient.stage.name}</div>
          <div className="hidden font-semibold lg:block">{stageStartedClock(patient)}</div>
          <div className="hidden font-semibold lg:block">{patient.elapsed_minutes}m</div>
        </div>

        <button type="button" onClick={onToggle} aria-label={expanded ? "Collapse patient details" : "Expand patient details"} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md hover:bg-background/60">
          <ChevronDown className={cn("h-5 w-5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>

        <div className="col-span-3 grid grid-cols-2 gap-2 text-sm lg:hidden">
          <Info label="Specialty" value={patient.specialty} />
          <Info label="Consultant" value={patient.consultant} />
          <Info label="Procedure" value={patient.procedure} className="col-span-2" />
          <Info label="Current stage" value={patient.stage.name} className="col-span-2" />
          <Info label="Started" value={stageStartedClock(patient)} />
          <Info label="Elapsed" value={`${patient.elapsed_minutes}m`} />
        </div>
      </div>

      {listType === "unresolved" ? (
        <div className="mx-3 mb-3 flex items-start gap-2 rounded-md border border-red-300 bg-white/70 px-3 py-2 text-sm font-semibold text-red-950 dark:border-red-800 dark:bg-red-950/50 dark:text-red-50" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            This patient has remained at “{patient.stage.name}” for more than {formatUnresolvedThreshold(patient.unresolved_threshold_minutes)}. Please update or confirm the stage before returning the patient to the live list.
          </p>
        </div>
      ) : null}

      {expanded ? (
        <div className="border-t border-current/15 bg-background/70 p-3 lg:p-4">
          <ExpandedPatientCard
            patient={patient}
            nextStage={nextStage}
            delayReasons={delayReasons}
            listType={listType}
            moving={moving}
            canManageWorkflow={canManageWorkflow}
            onMoveToCepod={onMoveToCepod}
            onMoveToPlanned={onMoveToPlanned}
          />
        </div>
      ) : null}
    </article>
  );
}

function ExpandedPatientCard({
  patient,
  nextStage,
  delayReasons,
  listType,
  moving,
  canManageWorkflow,
  onMoveToCepod,
  onMoveToPlanned
}: {
  patient: PatientWithStage;
  nextStage: WorkflowStage | null;
  delayReasons: DelayReason[];
  listType: "cepod" | "planned" | "unresolved";
  moving: boolean;
  canManageWorkflow: boolean;
  onMoveToCepod: () => void;
  onMoveToPlanned: () => void;
}) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reconcileOpen, setReconcileOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelling, setCancelling] = React.useState(false);
  const [reconciling, setReconciling] = React.useState(false);

  async function confirmStillActive() {
    setReconciling(true);
    const response = await fetch("/api/patients/reconcile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patient.id, action: "keep_active" })
    });
    const result = (await response.json()) as { error?: string; demo?: boolean };
    setReconciling(false);
    if (!response.ok) return toast.error(result.error ?? "Unable to reconcile patient");
    toast.success(result.demo ? "Demo patient returned to the live list." : "Patient confirmed active and returned to the live list.");
    setReconcileOpen(false);
    router.refresh();
  }

  async function cancelPatient() {
    setCancelling(true);
    const response = await fetch("/api/patients/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient_id: patient.id, reason: cancelReason })
    });
    const result = (await response.json()) as { error?: string; demo?: boolean };
    setCancelling(false);
    if (!response.ok) return toast.error(result.error ?? "Unable to cancel case");
    toast.success(result.demo ? "Demo cancellation recorded." : "Case cancelled and retained in the record.");
    setCancelOpen(false);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InfoBlock icon={<UserRound className="h-4 w-4" aria-hidden="true" />} label="Patient" value={patient.patient_name || "Not recorded"} />
        <InfoBlock label="Specialty" value={patient.specialty} />
        <InfoBlock label="Consultant" value={patient.consultant} />
        <InfoBlock label="Procedure" value={patient.procedure} />
        <InfoBlock label="Current stage" value={patient.stage.name} />
        <InfoBlock label="Stage started" value={stageStartedClock(patient)} />
        <InfoBlock label="Next stage" value={nextStage?.name ?? "Workflow complete"} className="sm:col-span-2 xl:col-span-1" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
          {patient.elapsed_minutes}m in current stage
        </div>
        {!canManageWorkflow ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm font-semibold text-muted-foreground">This is a read-only operational view. Sign in with an authorised management account to update the pathway.</div>
        ) : listType === "planned" ? (
          <Button type="button" size="lg" className="w-full" disabled={moving} onClick={onMoveToCepod}>
            {moving ? "Moving..." : "Move to CEPOD"}
          </Button>
        ) : listType === "unresolved" ? (
          <>
            <Button type="button" size="lg" className="w-full" onClick={() => setReconcileOpen(true)}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Confirm still active
            </Button>
            <AdvancePatientButton patient={patient} delayReasons={delayReasons} nextStage={nextStage} elapsedMinutes={patient.elapsed_minutes} />
          </>
        ) : (
          <>
            <AdvancePatientButton patient={patient} delayReasons={delayReasons} nextStage={nextStage} elapsedMinutes={patient.elapsed_minutes} />
            <Button type="button" variant="outline" className="w-full" disabled={moving} onClick={onMoveToPlanned}>
              {moving ? "Moving..." : "Move to planned list"}
            </Button>
          </>
        )}
        <Button type="button" variant="destructive" className="w-full" onClick={() => setCancelOpen(true)}>
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Cancel case
        </Button>
        <details className="rounded-md border bg-background/60 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <QrCode className="h-4 w-4" aria-hidden="true" />
            Patient QR
          </summary>
          <div className="mt-3 flex justify-center rounded-md bg-white p-3">
            <QRCodeSVG value={`/patients?hospital=${patient.hospital_number}`} size={132} />
          </div>
        </details>
      </div>
      {cancelOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-cyan-950/40 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-lg border bg-background p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby={`cancel-title-${patient.id}`}>
            <h2 id={`cancel-title-${patient.id}`} className="text-lg font-bold">Cancel this case?</h2>
            <p className="mt-1 text-sm text-muted-foreground">The patient will leave the active list, but the cancellation and reason remain in reports.</p>
            <label htmlFor={`cancel-reason-${patient.id}`} className="mt-4 block text-sm font-semibold">Reason for cancellation</label>
            <Textarea id={`cancel-reason-${patient.id}`} className="mt-2" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="For example: operation no longer needed" autoFocus />
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>Keep case</Button>
              <Button type="button" variant="destructive" disabled={cancelling || cancelReason.trim().length < 3} onClick={() => void cancelPatient()}>{cancelling ? "Recording..." : "Confirm cancellation"}</Button>
            </div>
          </div>
        </div>
      ) : null}
      {reconcileOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-cyan-950/40 p-3 sm:items-center sm:justify-center">
          <div className="w-full max-w-lg rounded-lg border bg-background p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby={`reconcile-title-${patient.id}`}>
            <h2 id={`reconcile-title-${patient.id}`} className="text-lg font-bold">Confirm this patient is still active?</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              This returns the patient to the live list at “{patient.stage.name}” and starts a new {formatUnresolvedThreshold(patient.unresolved_threshold_minutes)} review window. It does not change the clinical stage or its original start time.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setReconcileOpen(false)}>Keep unresolved</Button>
              <Button type="button" disabled={reconciling} onClick={() => void confirmStillActive()}>
                {reconciling ? "Confirming..." : "Confirm still active"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function WorkflowTimeline({ stages, patient }: { stages: WorkflowStage[]; patient: PatientWithStage | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {stages.map((stage) => {
            const active = stage.id === patient?.current_stage;
            const complete = patient ? stage.display_order < patient.stage.display_order : false;
            return (
              <li
                key={stage.id}
                className={cn(
                  "rounded-md border bg-card px-3 py-2 text-sm",
                  active && "border-primary bg-secondary",
                  complete && "bg-muted/70 text-muted-foreground"
                )}
              >
                <span className="font-semibold">{stage.display_order}. {stage.name}</span>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ icon, label, value, className }: { icon?: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function Info({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-semibold uppercase tracking-normal opacity-75">{label}</p>
      <p className="break-words font-semibold">{value}</p>
    </div>
  );
}

function stageStartedClock(patient: PatientWithStage) {
  const date = new Date(patient.last_event?.timestamp ?? patient.created_at);
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  const day = date.getDate();
  return `${weekday} ${day}${ordinalSuffix(day)} ${month}, ${time}`;
}

function getOperationDate(patient: PatientWithStage) {
  return patient.operation_date ?? patient.created_at.slice(0, 10);
}

function isCepodDue(patient: PatientWithStage, now: Date) {
  const operationDate = getOperationDate(patient);
  const today = toDateKey(now);

  if (operationDate < today) return true;
  if (operationDate > today) return false;
  if (patient.created_at.slice(0, 10) === today) return true;
  return now.getHours() >= 7;
}

function toDateKey(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 10);
}

function tomorrowDateKey(date: Date) {
  const tomorrow = new Date(date);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return toDateKey(tomorrow);
}

function formatLongDate(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "long" }).format(date);
  const day = date.getDate();
  return `${weekday} ${day}${ordinalSuffix(day)} ${month} ${date.getFullYear()}`;
}

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function ordinalSuffix(day: number) {
  if (day % 100 >= 11 && day % 100 <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function useMinuteClock() {
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return now;
}
