"use client";

import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function DashboardFilters() {
  return (
    <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Select aria-label="Date range">
        <option>Today</option>
        <option>Last 7 days</option>
        <option>Last month</option>
        <option>Last year</option>
        <option>Custom</option>
      </Select>
      <Input placeholder="Consultant" />
      <Input placeholder="Specialty" />
      <Input placeholder="Procedure" />
      <Select aria-label="Priority">
        <option>All priorities</option>
        <option>Immediate</option>
        <option>Urgent</option>
        <option>Expedited</option>
      </Select>
      <Input placeholder="Delay reason" />
      <Input placeholder="Infrastructure event" />
      <Button type="button" variant="outline">
        <Filter className="h-4 w-4" aria-hidden="true" />
        Apply filters
      </Button>
    </div>
  );
}
