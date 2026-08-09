import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUserRole, isRolePermissionEnforced } from "@/lib/services/access-control";

export default async function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentUserRole();
  return <AppShell role={role} enforceRolePermissions={isRolePermissionEnforced()}>{children}</AppShell>;
}
