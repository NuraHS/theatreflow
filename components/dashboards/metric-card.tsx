import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MetricCard as MetricCardType } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const toneClasses: Record<MetricCardType["tone"], string> = {
  neutral: "text-primary",
  good: "text-emerald-600 dark:text-emerald-300",
  warning: "text-amber-600 dark:text-amber-300",
  danger: "text-red-600 dark:text-red-300"
};

export function MetricCard({ metric }: { metric: MetricCardType }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{metric.label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold tracking-normal", toneClasses[metric.tone])}>{metric.value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{metric.change}</p>
      </CardContent>
    </Card>
  );
}
