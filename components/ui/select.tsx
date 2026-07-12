import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "theatre-select flex h-11 w-full cursor-pointer appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-11 text-base text-foreground shadow-sm focus-visible:ring-4 focus-visible:ring-ring/30 md:text-sm",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
