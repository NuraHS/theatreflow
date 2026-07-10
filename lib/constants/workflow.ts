import type { DelayReason, InfrastructureEvent, WorkflowStage } from "@/lib/types/domain";

export const DEFAULT_WORKFLOW_ID = "cepod-emergency-theatres";

export const DEFAULT_WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: "decision-to-operate",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Decision to Operate",
    display_order: 1,
    colour: "#0f766e",
    delay_threshold_minutes: 30,
    board_band: "Waiting"
  },
  {
    id: "sent-for",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Sent For",
    display_order: 2,
    colour: "#0891b2",
    delay_threshold_minutes: 20,
    board_band: "Sent For"
  },
  {
    id: "patient-arrived",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Patient Arrived",
    display_order: 3,
    colour: "#2563eb",
    delay_threshold_minutes: 15,
    board_band: "Arrived"
  },
  {
    id: "anaesthetic-started",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Anaesthetic Started",
    display_order: 4,
    colour: "#7c3aed",
    delay_threshold_minutes: 35,
    board_band: "Anaesthetic"
  },
  {
    id: "knife-to-skin",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Knife to Skin",
    display_order: 5,
    colour: "#dc2626",
    delay_threshold_minutes: 120,
    board_band: "Operating"
  },
  {
    id: "procedure-finished",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Procedure Finished",
    display_order: 6,
    colour: "#ea580c",
    delay_threshold_minutes: 20,
    board_band: "Operating"
  },
  {
    id: "out-of-theatre",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Out of Theatre",
    display_order: 7,
    colour: "#ca8a04",
    delay_threshold_minutes: 15,
    board_band: "Recovery"
  },
  {
    id: "recovery-ready",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Recovery Ready for Discharge",
    display_order: 8,
    colour: "#16a34a",
    delay_threshold_minutes: 30,
    board_band: "Recovery"
  },
  {
    id: "left-recovery",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Left Recovery",
    display_order: 9,
    colour: "#15803d",
    delay_threshold_minutes: 25,
    board_band: "Ward"
  },
  {
    id: "returned-to-ward",
    workflow_id: DEFAULT_WORKFLOW_ID,
    name: "Returned to Ward",
    display_order: 10,
    colour: "#166534",
    delay_threshold_minutes: 60,
    board_band: "Ward"
  }
];

export const DEFAULT_DELAY_REASONS: DelayReason[] = [
  "Missing consent",
  "Consent form lost",
  "Patient eating",
  "Awaiting bloods",
  "Awaiting imaging",
  "Awaiting review",
  "Porter unavailable",
  "Ward delay",
  "Patient unavailable",
  "Lift failure",
  "Recovery full",
  "Ward bed unavailable",
  "ICU bed unavailable",
  "Anaesthetist unavailable",
  "Anaesthetist attending emergency",
  "Equipment unavailable",
  "Instrument unavailable",
  "Cleaning delay",
  "Previous case overran",
  "Unexpected difficult surgery",
  "Emergency interruption",
  "Staff unavailable",
  "Documentation unavailable",
  "Other"
].map((label) => ({
  id: label.toLowerCase().replaceAll(" ", "-"),
  label,
  active: true
}));

export const DEMO_INFRASTRUCTURE_EVENTS: InfrastructureEvent[] = [
  {
    id: "lift-west-2",
    type: "Lift failure",
    start_time: new Date(Date.now() - 54 * 60_000).toISOString(),
    end_time: null,
    description: "West theatre lift unavailable. Portering using east corridor.",
    severity: "high",
    active: true
  },
  {
    id: "recovery-pressure",
    type: "Recovery closed",
    start_time: new Date(Date.now() - 115 * 60_000).toISOString(),
    end_time: new Date(Date.now() - 45 * 60_000).toISOString(),
    description: "Recovery staffing reduced capacity to two bays.",
    severity: "medium",
    active: false
  }
];
