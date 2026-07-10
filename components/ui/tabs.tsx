"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Tabs({
  tabs,
  defaultValue,
  children
}: {
  tabs: { value: string; label: string }[];
  defaultValue: string;
  children: React.ReactNode;
}) {
  const [active, setActive] = React.useState(defaultValue);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActive(tab.value)}
            className={cn(
              "min-h-10 cursor-pointer whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors",
              active === tab.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div data-active-tab={active}>{children}</div>
    </div>
  );
}
