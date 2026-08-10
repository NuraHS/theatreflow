import { DEFAULT_THEATRE_CONFIGURATION } from "@/lib/constants/theatre-locations";
import { getCurrentUserAccess, isRolePermissionEnforced } from "@/lib/services/access-control";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/server";
import type { CurrentUserAccess, TheatreConfiguration } from "@/lib/types/domain";

export async function getTheatreConfiguration(options: { scoped?: boolean } = {}): Promise<TheatreConfiguration> {
  const supabase = createServiceRoleSupabaseClient();
  let configuration = DEFAULT_THEATRE_CONFIGURATION;

  if (supabase) {
    const [suites, theatres, recoveryAreas] = await Promise.all([
      supabase.from("theatre_suites").select("*").eq("active", true).order("display_order"),
      supabase.from("theatres").select("*").eq("active", true).order("display_order"),
      supabase.from("recovery_areas").select("*").eq("active", true).order("display_order")
    ]);
    if (!suites.error && !theatres.error && !recoveryAreas.error && suites.data?.length) {
      configuration = {
        suites: suites.data,
        theatres: theatres.data,
        recovery_areas: recoveryAreas.data
      } as TheatreConfiguration;
    }
  }

  if (options.scoped === false || !isRolePermissionEnforced()) return configuration;
  return scopeTheatreConfiguration(configuration, await getCurrentUserAccess());
}

export function scopeTheatreConfiguration(configuration: TheatreConfiguration, access: CurrentUserAccess) {
  if (!access.authenticated || access.all_theatres || access.role === "administrator") return configuration;

  const explicitlyAccessibleTheatres = configuration.theatres.filter((theatre) =>
    access.theatre_ids.includes(theatre.id) || access.suite_ids.includes(theatre.suite_id)
  );
  const suiteIds = new Set([
    ...access.suite_ids,
    ...explicitlyAccessibleTheatres.map((theatre) => theatre.suite_id)
  ]);

  return {
    suites: configuration.suites.filter((suite) => suiteIds.has(suite.id)),
    theatres: explicitlyAccessibleTheatres,
    recovery_areas: configuration.recovery_areas.filter((area) => suiteIds.has(area.suite_id))
  };
}
