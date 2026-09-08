const STEPS = [
  { label: "Chờ", color: "bg-status-waiting" },
  { label: "Tiếp nhận", color: "bg-status-received" },
  { label: "Đủ tiêu chuẩn", color: "bg-status-qualified" },
] as const;

/** The signature element for the login screen: the same 4-status pipeline
 * every Sale works inside all day (plans/plan.txt §3), rendered as a
 * compact strip — not decoration, the literal mental model of the product. */
export function AuthPipelineStrip() {
  return (
    <div className="glossy shadow-bubble flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-5 py-4">
      <div className="flex flex-1 items-center gap-2">
        {STEPS.map((step, i) => (
          <div key={step.label} className="flex flex-1 items-center gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <span className={`size-2.5 shrink-0 rounded-full ${step.color}`} />
              <span className="font-condensed text-[9px] whitespace-nowrap text-muted-foreground uppercase tracking-wide">
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="h-px flex-1 bg-border" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-1.5 border-l border-border pl-4">
        <span className="size-2.5 shrink-0 rounded-full bg-status-spam" />
        <span className="font-condensed text-[9px] whitespace-nowrap text-muted-foreground uppercase tracking-wide">
          Spam
        </span>
      </div>
    </div>
  );
}
