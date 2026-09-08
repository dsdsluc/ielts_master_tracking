import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Inline ok/error line for a form submit result — one icon+color
 * convention reused everywhere a form reports back. */
export function FormMessage({
  kind,
  children,
  className,
}: {
  kind: "ok" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = kind === "ok" ? CheckCircle2 : AlertCircle;
  return (
    <p
      className={cn(
        "flex items-center gap-2 text-sm",
        kind === "ok" ? "text-status-qualified" : "text-destructive",
        className
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {children}
    </p>
  );
}
