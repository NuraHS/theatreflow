"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { LockKeyhole, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ASSIGNABLE_ROLES } from "@/lib/constants/permissions";
import { createClient } from "@/lib/supabase/client";
import type { CurrentUserAccess } from "@/lib/types/domain";

export function AdminAccessButton({ access, enforced }: { access: CurrentUserAccess; enforced: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const titleId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const isManagementUser = access.authenticated && access.active && ASSIGNABLE_ROLES.includes(access.role);

  React.useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  function closeDialog() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const supabase = createClient();

    if (!supabase) {
      setLoading(false);
      if (!enforced) {
        closeDialog();
        router.push("/admin");
        return;
      }
      toast.error("Supabase authentication is not configured on this installation.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Unable to sign in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role,active")
      .eq("id", data.user.id)
      .maybeSingle();
    const managementRole = profile?.role as CurrentUserAccess["role"] | undefined;

    if (profileError || !managementRole || !ASSIGNABLE_ROLES.includes(managementRole) || profile?.active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error(profileError ? "The management profile could not be verified." : "This account does not have an active management role.");
      return;
    }

    setLoading(false);
    closeDialog();
    toast.success("Management access confirmed.");
    router.push(managementRole === "administrator" ? "/admin" : "/dashboards");
    router.refresh();
  }

  function openDemoDashboard() {
    closeDialog();
    router.push("/admin");
  }

  if (isManagementUser) {
    const destination = access.role === "administrator" ? "/admin" : "/dashboards";
    return (
      <Link href={destination} className="flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        {access.role === "administrator" ? "Admin dashboard" : "Management dashboard"}
      </Link>
    );
  }

  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)} className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Admin login
      </button>

      {open ? createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <Card role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={handleDialogKeyDown} className="max-h-[92vh] w-full max-w-lg overflow-y-auto">
            <CardHeader className="relative pr-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LockKeyhole className="h-6 w-6" aria-hidden="true" />
              </div>
              <CardTitle id={titleId} className="text-xl">Management login</CardTitle>
              <CardDescription>Sign in with an active administrator, theatre manager, clinical lead, service manager or divisional leadership account.</CardDescription>
              <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-4" aria-label="Close administrator login" onClick={closeDialog}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {!enforced ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
                  <p className="font-bold">Local demonstration mode</p>
                  <p className="mt-1">Role enforcement is currently off. You can test an administrator login or open the demonstration dashboard.</p>
                </div>
              ) : null}
              <form onSubmit={signIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email address</Label>
                  <Input id="admin-email" name="email" type="email" autoComplete="email" autoFocus required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <Input id="admin-password" name="password" type="password" autoComplete="current-password" required />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading ? "Checking management access..." : "Sign in to Admin"}
                </Button>
              </form>
              {!enforced ? <Button type="button" variant="outline" className="w-full" onClick={openDemoDashboard}>Open demo Admin dashboard</Button> : null}
            </CardContent>
          </Card>
        </div>
      , document.body) : null}
    </>
  );
}
