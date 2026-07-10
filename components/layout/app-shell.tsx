import Link from "next/link";
import { Activity, BarChart3, ClipboardList, FileDown, LayoutDashboard, Settings, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";

const nav = [
  { href: "/patients", label: "Patients", icon: ClipboardList },
  { href: "/board", label: "Live Board", icon: LayoutDashboard },
  { href: "/dashboards", label: "Dashboards", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileDown },
  { href: "/insights", label: "Insights", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/patients" className="flex min-h-11 items-center gap-3 rounded-md focus-visible:ring-4 focus-visible:ring-ring/30">
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
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-3">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-6">{children}</main>
    </div>
  );
}
