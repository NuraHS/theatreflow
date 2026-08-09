import type { TheatreConfiguration } from "@/lib/types/domain";

export const DEFAULT_THEATRE_CONFIGURATION: TheatreConfiguration = {
  suites: [
    { id: "11111111-1111-4111-8111-111111111101", code: "st-james", name: "St James'", active: true, display_order: 1 },
    { id: "11111111-1111-4111-8111-111111111102", code: "atkinson-morley", name: "Atkinson Morley", active: true, display_order: 2 },
    { id: "11111111-1111-4111-8111-111111111103", code: "gynae", name: "Gynae", active: true, display_order: 3 }
  ],
  recovery_areas: [
    { id: "22222222-2222-4222-8222-222222222201", suite_id: "11111111-1111-4111-8111-111111111101", code: "st-james-recovery", name: "St James' Recovery", capacity: 8, active: true, display_order: 1 },
    { id: "22222222-2222-4222-8222-222222222202", suite_id: "11111111-1111-4111-8111-111111111102", code: "atkinson-morley-recovery", name: "Atkinson Morley Recovery", capacity: 6, active: true, display_order: 1 },
    { id: "22222222-2222-4222-8222-222222222203", suite_id: "11111111-1111-4111-8111-111111111103", code: "gynae-recovery", name: "Gynae Recovery", capacity: 6, active: true, display_order: 1 }
  ],
  theatres: [
    theatre("301", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "st-james", 1),
    theatre("302", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "st-james", 2),
    theatre("303", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "st-james", 3),
    theatre("304", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "st-james", 4),
    theatre("305", "11111111-1111-4111-8111-111111111101", "22222222-2222-4222-8222-222222222201", "st-james", 5),
    theatre("306", "11111111-1111-4111-8111-111111111102", "22222222-2222-4222-8222-222222222202", "atkinson-morley", 1),
    theatre("307", "11111111-1111-4111-8111-111111111102", "22222222-2222-4222-8222-222222222202", "atkinson-morley", 2),
    theatre("308", "11111111-1111-4111-8111-111111111102", "22222222-2222-4222-8222-222222222202", "atkinson-morley", 3),
    theatre("309", "11111111-1111-4111-8111-111111111103", "22222222-2222-4222-8222-222222222203", "gynae", 1),
    theatre("310", "11111111-1111-4111-8111-111111111103", "22222222-2222-4222-8222-222222222203", "gynae", 2),
    theatre("311", "11111111-1111-4111-8111-111111111103", "22222222-2222-4222-8222-222222222203", "gynae", 3)
  ]
};

function theatre(idSuffix: string, suiteId: string, recoveryId: string, suiteCode: string, number: number) {
  return {
    id: `33333333-3333-4333-8333-333333333${idSuffix}`,
    suite_id: suiteId,
    default_recovery_area_id: recoveryId,
    code: `${suiteCode}-theatre-${number}`,
    name: `Theatre ${number}`,
    active: true,
    display_order: number
  };
}
