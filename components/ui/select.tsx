import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full cursor-pointer rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm focus-visible:ring-4 focus-visible:ring-ring/30 md:text-sm",
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
