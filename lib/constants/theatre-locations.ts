import type { TheatreConfiguration } from "@/lib/types/domain";

export const DEFAULT_THEATRE_CONFIGURATION: TheatreConfiguration = {
  suites: [
    { id: "11111111-1111-4111-8111-111111111102", code: "st-helier-a2", name: "St Helier A2 Theatres", active: true, display_order: 1 },
    { id: "11111111-1111-4111-8111-111111111103", code: "st-helier-b4", name: "B4 Theatres", active: true, display_order: 2 },
    { id: "11111111-1111-4111-8111-111111111101", code: "epsom-main", name: "Epsom Main Theatres", active: true, display_order: 3 }
  ],
  recovery_areas: [
    { id: "22222222-2222-4222-8222-222222222201", suite_id: "11111111-1111-4111-8111-111111111101", code: "epsom-main-recovery", name: "Epsom Main Recovery", capacity: null, active: true, display_order: 1 },
    { id: "22222222-2222-4222-8222-222222222202", suite_id: "11111111-1111-4111-8111-111111111102", code: "st-helier-a2-recovery", name: "St Helier A2 Recovery", capacity: null, active: true, display_order: 1 },
    { id: "22222222-2222-4222-8222-222222222203", suite_id: "11111111-1111-4111-8111-111111111103", code: "st-helier-b4-recovery", name: "B4 Recovery", capacity: null, active: true, display_order: 1 }
  ],
  theatres: [
    theatre("306", "11111111-1111-4111-8111-111111111102", "22222222-2222-4222-8222-222222222202", "st-helier-a2", 1, "CEPOD Theatre 1"),
    theatre("307", "11111111-1111-4111-8111-111111111102", "22222222-2222-4222-8222-222222222202", "st-helier-a2", 2),
    theatre("308", "11111111-1111-4111-8111-111111111102", "22222222-2222-4222-8222-222222222202", "st-helier-a2", 3, "Trauma Theatre 3"),
    theatre("309", "11111111-1111-4111-8111-111111111103", "22222222-2222-4222-8222-222222222203", "st-helier-b4", 1),
    theatre("310", "11111111-1111-4111-8111-111111111103", "22222222-2222-4222-8222-222222222203", "st-helier-b4", 2),
    theatre("301", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "epsom-main", 1),
    theatre("302", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "epsom-main", 2),
    theatre("303", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "epsom-main", 3),
    theatre("304", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "epsom-main", 4),
    theatre("305", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "epsom-main", 5)
  ]
};

function theatre(idSuffix: string, suiteId: string, recoveryId: string, suiteCode: string, number: number, name = `Theatre ${number}`) {
  return {
    id: `33333333-3333-4333-8333-333333333${idSuffix}`,
    suite_id: suiteId,
    default_recovery_area_id: recoveryId,
    code: `${suiteCode}-theatre-${number}`,
    name,
    active: true,
    display_order: number
  };
}
