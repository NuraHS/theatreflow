import Link from "next/link";
import { ArrowRight, HeartPulse, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { requirePagePermission } from "@/lib/services/access-control";

const adminAreas = [
  {
    href: "/admin/users",
    title: "Users and access",
    description: "Create login accounts, assign staff roles and control access to theatre suites and individual theatres.",
    icon: UsersRound
  },
  {
    href: "/admin/system-health",
    title: "System health",
    description: "Review application, database, storage and installation health and export a support bundle.",
    icon: HeartPulse
  },
  {
    href: "/admin/diagnostics",
    title: "Diagnostics",
    description: "Run live component checks, record technical incidents and review the health audit history.",
    icon: Stethoscope
  }
] as const;

export default async function AdminDashboardPage() {
  await requirePagePermission("manageUsers");

  return (
    <div className="space-y-5">
      <section className="clinical-card rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
              <h1 className="text-2xl font-bold tracking-normal">Admin dashboard</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Secure access to user management, system monitoring and technical support tools.</p>
          </div>
          <Badge tone="blue">Administrator only</Badge>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {adminAreas.map((area) => (
          <Link key={area.href} href={area.href} className="clinical-card group flex min-h-56 cursor-pointer flex-col rounded-lg border bg-card p-5 text-card-foreground transition-colors duration-200 hover:border-primary hover:bg-cyan-50 focus-visible:ring-4 focus-visible:ring-ring/30 dark:hover:bg-cyan-950/20">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <area.icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-lg font-bold">{area.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{area.description}</p>
            <span className="mt-5 flex items-center gap-2 text-sm font-bold text-primary">Open {area.title.toLowerCase()}<ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" /></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
