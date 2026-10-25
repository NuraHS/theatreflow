import type { ConnectionDiagnosticCode, SystemHealthStatus } from "@/lib/types/system-health";

// Only return curated guidance: provider errors may contain URLs or credentials.
export function connectionFailure(error: { code?: string; message?: string; details?: string; status?: number }, status?: number): { status: SystemHealthStatus; detail: string; diagnostic_code: ConnectionDiagnosticCode } {
  const code = error.code ?? "";
  const httpStatus = status ?? error.status;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (httpStatus === 401 || httpStatus === 403 || ["42501", "PGRST301", "PGRST302"].includes(code)) {
    return { status: "critical", diagnostic_code: "credentials", detail: "Supabase rejected the server credentials or permissions. Check that the database URL and server-side service-role key in this installation belong together, then restart or redeploy. This does not establish a Supabase service outage." };
  }
  if (["42P01", "PGRST205", "PGRST202"].includes(code)) {
    return { status: "warning", diagnostic_code: "schema", detail: "Supabase responded, but a required table or function is missing. Apply the Theatreflow database migrations and refresh the Supabase schema cache." };
  }
  if (httpStatus === 540) {
    return { status: "critical", diagnostic_code: "paused", detail: "The Supabase project is paused. Resume the project in the Supabase dashboard, then refresh this check." };
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return { status: "critical", diagnostic_code: "dns", detail: "The Supabase project address could not be resolved. Check the configured database URL, local DNS and network. For hosted Supabase, also check whether the project is active." };
  }
  if (/fetch failed|network|timeout|timed out|abort/i.test(text) || httpStatus === 0) {
    return { status: "critical", diagnostic_code: "network", detail: "The server could not reach Supabase. Check the database services, configured URL and installation network. For hosted Supabase, also check that the project is active. A failed request alone does not identify the cause." };
  }
  return { status: "critical", diagnostic_code: "request", detail: "The Supabase check failed. Check the project status, server configuration and provider logs. This result does not establish a service-wide outage." };
}

export function isManagedHosting() {
  return process.env.VERCEL === "1" || process.env.THEATREFLOW_DEPLOYMENT_MODE === "cloud";
}
