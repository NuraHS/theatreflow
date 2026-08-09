"use client";

import { LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/constants/permissions";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUserAccess } from "@/lib/types/domain";

export function UserMenu({ access, enforced }: { access: CurrentUserAccess; enforced: boolean }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    toast.success("Signed out of Theatreflow.");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <div className="hidden min-w-0 text-right lg:block">
        <p className="max-w-48 truncate text-sm font-bold">{access.full_name || access.email || "Local demonstration"}</p>
        <p className="text-xs text-muted-foreground">{ROLE_LABELS[access.role]}</p>
      </div>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-muted" title={ROLE_LABELS[access.role]}>
        <UserRound className="h-5 w-5" aria-hidden="true" />
      </span>
      {enforced ? (
        <Button type="button" variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}>
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
