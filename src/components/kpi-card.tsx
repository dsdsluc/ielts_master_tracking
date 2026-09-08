import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  accentClassName = "bg-primary",
}: {
  label: string;
  value: string | number;
  accentClassName?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <span className={cn("h-9 w-1 shrink-0 rounded-full", accentClassName)} />
      <div className="flex flex-col">
        <span className="font-heading text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
