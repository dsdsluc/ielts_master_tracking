import { STUDENT_STAGE } from "@/lib/interactions/constants";

const STAGE_STYLES: Record<string, string> = {
  [STUDENT_STAGE.NOT_INTERESTED]: "bg-destructive/10 text-destructive",
  [STUDENT_STAGE.ENROLLED]: "bg-status-qualified-bg text-status-qualified",
};

export function StageBadge({ stage }: { stage: string | null }) {
  if (!stage) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-current" />
        Chưa gọi
      </span>
    );
  }
  const style = STAGE_STYLES[stage] ?? "bg-status-received-bg text-status-received";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {stage}
    </span>
  );
}
