import Link from "next/link";
import { Activity, BarChart3, ClipboardList, FileDown, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import { AdminAccessButton } from "@/components/layout/admin-access-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { can, type Permission } from "@/lib/constants/permissions";
import type { CurrentUserAccess } from "@/lib/types/domain";

const nav: Array<{ href: string; label: string; icon: typeof Activity; permission: Permission }> = [
  { href: "/patients", label: "Patients", icon: ClipboardList, permission: "viewPatients" },
  { href: "/board", label: "Live Board", icon: LayoutDashboard, permission: "viewLiveBoard" },
  { href: "/dashboards", label: "Dashboards", icon: BarChart3, permission: "viewDashboards" },
  { href: "/reports", label: "Reports", icon: FileDown, permission: "exportReports" },
  { href: "/insights", label: "Insights", icon: Sparkles, permission: "viewInsights" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "manageSettings" }
];

export function AppShell({ children, access, enforceRolePermissions }: { children: React.ReactNode; access: CurrentUserAccess; enforceRolePermissions: boolean }) {
  const visibleNav = nav.filter((item) => !enforceRolePermissions || can(access.role, item.permission));
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-40 border-b border-[#183b56] bg-card/95 backdrop-blur dark:border-border dark:bg-background/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex min-h-11 items-center gap-3 rounded-md focus-visible:ring-4 focus-visible:ring-ring/30">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold tracking-normal">Theatreflow</span>
              <span className="hidden text-xs text-muted-foreground sm:block">Emergency theatre workflow</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Badge tone="green" className="hidden sm:inline-flex">Realtime ready</Badge>
            <ThemeToggle />
            <UserMenu access={access} enforced={enforceRolePermissions} />
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
          <AdminAccessButton access={access} enforced={enforceRolePermissions} />
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
