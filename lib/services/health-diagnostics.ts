import type { SystemHealthStatus } from "@/lib/types/system-health";

// Only return curated guidance: provider errors may contain URLs or credentials.
export function connectionFailure(error: { code?: string; message?: string; details?: string; status?: number }, status?: number): { status: SystemHealthStatus; detail: string } {
  const code = error.code ?? "";
  const httpStatus = status ?? error.status;
  const text = `${error.message ?? ""} ${error.details ?? ""}`;
  if (httpStatus === 401 || httpStatus === 403 || ["42501", "PGRST301", "PGRST302"].includes(code)) {
    return { status: "critical", detail: "Supabase rejected the server credentials or permissions. Check that the project URL and server-side service-role key in Vercel belong to the same project, then redeploy. This does not establish a Supabase service outage." };
  }
  if (["42P01", "PGRST205", "PGRST202"].includes(code)) {
    return { status: "warning", detail: "Supabase responded, but a required table or function is missing. Apply the Theatreflow database migrations and refresh the Supabase schema cache." };
  }
  if (httpStatus === 540) {
    return { status: "critical", detail: "The Supabase project is paused. Resume the project in the Supabase dashboard, then refresh this check." };
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(text)) {
    return { status: "critical", detail: "The Supabase project address could not be resolved. Check the project URL and whether the project is active in Supabase; also check the hosting environment's network connection." };
  }
  if (/fetch failed|network|timeout|timed out|abort/i.test(text) || httpStatus === 0) {
    return { status: "critical", detail: "The server could not reach Supabase. Check that the project is active, the project URL is correct, and the hosting environment can connect. A failed request alone does not identify the cause." };
  }
  return { status: "critical", detail: "The Supabase check failed. Check the project status, server configuration and provider logs. This result does not establish a service-wide outage." };
}

export function isManagedHosting() {
  return process.env.VERCEL === "1" || process.env.THEATREFLOW_DEPLOYMENT_MODE === "cloud";
}
