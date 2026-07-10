import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-4 focus-visible:ring-ring/30 md:text-sm",
      className
    )}
    ref={ref}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
