import { UsersRound } from "lucide-react";
import { UserAccessPanel } from "@/components/admin/user-access-panel";
import { getTheatreConfiguration } from "@/lib/repositories/theatre-repository";
import { requirePagePermission } from "@/lib/services/access-control";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requirePagePermission("manageUsers");
  const locations = await getTheatreConfiguration({ scoped: false });
  return (
    <div className="space-y-5">
      <section className="clinical-card rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-primary" aria-hidden="true" /><h1 className="text-2xl font-bold">Users &amp; Access</h1></div>
        <p className="mt-1 text-sm text-muted-foreground">Create local login accounts, assign roles, and limit operational users to specific theatre suites or theatres.</p>
      </section>
      <UserAccessPanel locations={locations} />
    </div>
  );
}
