import { z } from "zod";

export const createPatientSchema = z.object({
  hospital_number: z.string().min(3, "Hospital number is required"),
  patient_name: z.string().optional(),
  consultant: z.string().min(2, "Consultant is required"),
  specialty: z.string().min(2, "Specialty is required"),
  procedure: z.string().min(2, "Procedure is required"),
  cepod_priority: z.enum(["Immediate", "Urgent", "Expedited", "Elective"]),
  decision_to_operate_time: z.string().optional()
});

export const advanceWorkflowSchema = z.object({
  patient_id: z.string().min(1),
  current_stage_id: z.string().min(1),
  delay_reason_ids: z.array(z.string()).default([]),
  delay_comments: z.string().optional()
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type AdvanceWorkflowInput = z.infer<typeof advanceWorkflowSchema>;
