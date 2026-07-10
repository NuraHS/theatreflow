"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DelayReason, InfrastructureEvent, PatientWithStage, WorkflowEvent } from "@/lib/types/domain";
import { delayReasonSeries, heatmapHours, infrastructureSeries, stageOccupancySeries, trendSeries } from "@/lib/services/analytics";

const colors = ["#0891b2", "#059669", "#ca8a04", "#dc2626", "#7c3aed", "#2563eb", "#ea580c", "#0f766e"];

export function DashboardCharts({
  patients,
  events,
  delayReasons,
  infrastructureEvents
}: {
  patients: PatientWithStage[];
  events: WorkflowEvent[];
  delayReasons: DelayReason[];
  infrastructureEvents: InfrastructureEvent[];
}) {
  const delayData = delayReasonSeries(events, delayReasons);
  const occupancy = stageOccupancySeries(patients);
  const infrastructure = infrastructureSeries(infrastructureEvents);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Live stage occupancy">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={occupancy}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="cases" fill="#0891b2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Reasons for delays">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={delayData.length ? delayData : [{ name: "No delays", value: 1 }]} dataKey="value" nameKey="name" outerRadius={92} label>
              {(delayData.length ? delayData : [{ name: "No delays", value: 1 }]).map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Delay trend by day">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendSeries}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="delays" stroke="#dc2626" strokeWidth={3} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="cases" stroke="#0891b2" strokeWidth={3} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Infrastructure minutes lost">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={infrastructure}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="minutes" fill="#ca8a04" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <ChartCard title="Delays by hour">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {heatmapHours.map((item) => (
            <div key={item.hour} className="rounded-md border p-3 text-center" style={{ backgroundColor: `rgba(8, 145, 178, ${0.1 + item.delays / 12})` }}>
              <p className="text-sm font-semibold">{item.hour}</p>
              <p className="text-2xl font-bold">{item.delays}</p>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
