import {
  DEFAULT_DELAY_REASONS,
  DEFAULT_WORKFLOW_ID,
  DEFAULT_WORKFLOW_STAGES,
  DEMO_INFRASTRUCTURE_EVENTS
} from "@/lib/constants/workflow";
import type { Patient, WorkflowEvent } from "@/lib/types/domain";

const now = Date.now();

export const demoPatients: Patient[] = [
  {
    id: "pt-001",
    hospital_number: "H456221",
    patient_name: "Hidden in live mode",
    consultant: "Mr Ahmed",
    specialty: "General Surgery",
    procedure: "Emergency laparotomy",
    cepod_priority: "Immediate",
    created_at: new Date(now - 196 * 60_000).toISOString(),
    current_stage: "knife-to-skin",
    cancelled: false,
    cancellation_reason: null,
    workflow_id: DEFAULT_WORKFLOW_ID
  },
  {
    id: "pt-002",
    hospital_number: "H219084",
    patient_name: null,
    consultant: "Ms Morgan",
    specialty: "Trauma & Orthopaedics",
    procedure: "Washout and debridement",
    cepod_priority: "Urgent",
    created_at: new Date(now - 78 * 60_000).toISOString(),
    current_stage: "sent-for",
    cancelled: false,
    cancellation_reason: null,
    workflow_id: DEFAULT_WORKFLOW_ID
  },
  {
    id: "pt-003",
    hospital_number: "H884210",
    patient_name: null,
    consultant: "Dr Patel",
    specialty: "Urology",
    procedure: "Stent insertion",
    cepod_priority: "Expedited",
    created_at: new Date(now - 38 * 60_000).toISOString(),
    current_stage: "decision-to-operate",
    cancelled: false,
    cancellation_reason: null,
    workflow_id: DEFAULT_WORKFLOW_ID
  },
  {
    id: "pt-004",
    hospital_number: "H770450",
    patient_name: null,
    consultant: "Mr Ahmed",
    specialty: "General Surgery",
    procedure: "Appendicectomy",
    cepod_priority: "Urgent",
    created_at: new Date(now - 252 * 60_000).toISOString(),
    current_stage: "recovery-ready",
    cancelled: false,
    cancellation_reason: null,
    workflow_id: DEFAULT_WORKFLOW_ID
  }
];

export const demoEvents: WorkflowEvent[] = [
  {
    id: "evt-001",
    patient_id: "pt-001",
    workflow_stage_id: "decision-to-operate",
    timestamp: new Date(now - 196 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Theatre Coordinator",
    delay_reason_ids: [],
    delay_comments: null,
    infrastructure_event_ids: []
  },
  {
    id: "evt-002",
    patient_id: "pt-001",
    workflow_stage_id: "sent-for",
    timestamp: new Date(now - 151 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Theatre Coordinator",
    delay_reason_ids: ["porter-unavailable", "lift-failure"],
    delay_comments: "Transport route changed due to lift outage.",
    infrastructure_event_ids: ["lift-west-2"]
  },
  {
    id: "evt-003",
    patient_id: "pt-001",
    workflow_stage_id: "patient-arrived",
    timestamp: new Date(now - 112 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Anaesthetic Practitioner",
    delay_reason_ids: [],
    delay_comments: null,
    infrastructure_event_ids: []
  },
  {
    id: "evt-004",
    patient_id: "pt-001",
    workflow_stage_id: "anaesthetic-started",
    timestamp: new Date(now - 92 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Anaesthetic Practitioner",
    delay_reason_ids: [],
    delay_comments: null,
    infrastructure_event_ids: []
  },
  {
    id: "evt-005",
    patient_id: "pt-001",
    workflow_stage_id: "knife-to-skin",
    timestamp: new Date(now - 41 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Scrub Nurse",
    delay_reason_ids: [],
    delay_comments: null,
    infrastructure_event_ids: []
  },
  {
    id: "evt-006",
    patient_id: "pt-002",
    workflow_stage_id: "sent-for",
    timestamp: new Date(now - 44 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Theatre Coordinator",
    delay_reason_ids: ["ward-delay"],
    delay_comments: "Ward preparing paperwork.",
    infrastructure_event_ids: []
  },
  {
    id: "evt-007",
    patient_id: "pt-003",
    workflow_stage_id: "decision-to-operate",
    timestamp: new Date(now - 38 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Clinical Lead",
    delay_reason_ids: [],
    delay_comments: null,
    infrastructure_event_ids: []
  },
  {
    id: "evt-008",
    patient_id: "pt-004",
    workflow_stage_id: "recovery-ready",
    timestamp: new Date(now - 58 * 60_000).toISOString(),
    user_id: "demo-user",
    user_name: "Recovery Nurse",
    delay_reason_ids: ["ward-bed-unavailable", "recovery-full"],
    delay_comments: "Awaiting ward bed allocation.",
    infrastructure_event_ids: ["recovery-pressure"]
  }
];

export const demoData = {
  patients: demoPatients,
  stages: DEFAULT_WORKFLOW_STAGES,
  delayReasons: DEFAULT_DELAY_REASONS,
  infrastructureEvents: DEMO_INFRASTRUCTURE_EVENTS,
  events: demoEvents
};
