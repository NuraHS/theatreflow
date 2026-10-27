type ListBooking = { operation_date?: string | null; created_at: string };

function localDateKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

// Shared by the theatre list and Live Board, including the 07:00 planned-list rollover.
export function isPatientDueForTheatreList(patient: ListBooking, now: Date) {
  const operationDate = patient.operation_date ?? patient.created_at.slice(0, 10);
  const today = localDateKey(now);
  if (operationDate < today) return true;
  if (operationDate > today) return false;
  return patient.created_at.slice(0, 10) === today || now.getHours() >= 7;
}

type BoardBooking = ListBooking & {
  cancelled: boolean;
  current_stage: string;
  completed_at?: string | null;
  last_event?: { timestamp: string } | null;
};

export function selectLiveBoardPatients<T extends BoardBooking>(patients: T[], now: Date): T[] {
  const today = localDateKey(now);
  return patients.filter((patient) => {
    if (patient.cancelled || !isPatientDueForTheatreList(patient, now)) return false;
    if (patient.current_stage !== "patient-out-of-recovery") return true;
    // Preserve today's completed-patient column without bringing old completed cases back.
    const completedAt = patient.completed_at ?? patient.last_event?.timestamp ?? patient.created_at;
    return localDateKey(new Date(completedAt)) === today;
  });
}
