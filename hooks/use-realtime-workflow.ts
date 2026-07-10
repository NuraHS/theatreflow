"use client";

import * as React from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function useRealtimeWorkflow(onChange?: () => void) {
  React.useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    const channel = supabase
      .channel("theatreflow-workflow")
      .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => {
        toast.info("The live theatre board has changed.");
        onChange?.();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "workflow_events" }, () => {
        onChange?.();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "infrastructure_events" }, () => {
        toast.warning("Infrastructure status changed.");
        onChange?.();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [onChange]);
}
