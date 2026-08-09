import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserAccess, isRolePermissionEnforced } from "@/lib/services/access-control";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const access = await getCurrentUserAccess();
  return <AppShell access={access} enforceRolePermissions={isRolePermissionEnforced()}>{children}</AppShell>;
}
