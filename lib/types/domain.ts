export type UserRole =
  | "administrator"
  | "manager"
  | "clinical_lead"
  | "consultant"
  | "theatre_staff"
  | "read_only_auditor";

export type CepodPriority = "Immediate" | "Urgent" | "Expedited" | "Elective";

export type DelaySeverity = "low" | "medium" | "high" | "critical";

export type WorkflowBand =
  | "Waiting"
  | "Sent For"
  | "Arrived"
  | "Anaesthetic"
  | "Operating"
  | "Recovery"
  | "Ward";

export type Patient = {
  id: string;
  hospital_number: string;
  patient_name: string | null;
  consultant: string;
  specialty: string;
  procedure: string;
  cepod_priority: CepodPriority;
  created_at: string;
  current_stage: string;
  cancelled: boolean;
  cancellation_reason: string | null;
  workflow_id: string;
};

export type WorkflowStage = {
  id: string;
  workflow_id: string;
  name: string;
  display_order: number;
  colour: string;
  delay_threshold_minutes: number;
  board_band: WorkflowBand;
};

export type DelayReason = {
  id: string;
  label: string;
  active: boolean;
};

export type InfrastructureEvent = {
  id: string;
  type: string;
  start_time: string;
  end_time: string | null;
  description: string;
  severity: DelaySeverity;
  active: boolean;
};

export type WorkflowEvent = {
  id: string;
  patient_id: string;
  workflow_stage_id: string;
  timestamp: string;
  user_id: string | null;
  user_name: string;
  delay_reason_ids: string[];
  delay_comments: string | null;
  infrastructure_event_ids: string[];
};

export type PatientWithStage = Patient & {
  stage: WorkflowStage;
  last_event: WorkflowEvent | null;
  elapsed_minutes: number;
  delay_status: "green" | "amber" | "red";
};

export type DashboardFilters = {
  dateRange: "today" | "7d" | "month" | "year" | "custom";
  start?: string;
  end?: string;
  consultant?: string;
  specialty?: string;
  priority?: CepodPriority;
  procedure?: string;
  delayReason?: string;
  infrastructureEvent?: string;
};

export type MetricCard = {
  label: string;
  value: string;
  change: string;
  tone: "neutral" | "good" | "warning" | "danger";
};
