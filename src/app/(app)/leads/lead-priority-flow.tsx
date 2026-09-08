import { ChevronRight } from "lucide-react";

const STEPS = [
  "Mới đang Chờ",
  "Sắp/đã quá SLA",
  "Cần chăm sóc lại",
  "Tiếp nhận, chưa có SĐT",
];

export function LeadPriorityFlow() {
  return (
    <div className="flex w-full flex-wrap items-center gap-y-1.5 gap-x-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 sm:w-auto">
      {STEPS.map((step, i) => (
        <div key={step} className="flex shrink-0 items-center gap-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {i + 1}
          </span>
          <span className="text-xs font-medium whitespace-nowrap text-foreground sm:text-sm">
            {step}
          </span>
          {i < STEPS.length - 1 && (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50" />
          )}
        </div>
      ))}
    </div>
  );
}
