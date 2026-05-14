import * as React from "react"
import { cn } from "../../lib/utils"

type AlertVariant = "default" | "warning" | "destructive"

const alertVariantClassNames: Record<AlertVariant, string> = {
  default: "border-slate-200 bg-white text-slate-950",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  destructive: "border-red-500/50 text-red-600",
}

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: AlertVariant }
>(({ className, variant = "default", ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn("relative w-full rounded-lg border px-4 py-3 text-sm", alertVariantClassNames[variant], className)}
    {...props}
  />
))
Alert.displayName = "Alert"

export { Alert }
