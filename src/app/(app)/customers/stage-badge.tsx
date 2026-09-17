import { CUSTOMER_STAGE } from "@/lib/interactions/constants";

// Bảng màu riêng cho phễu tư vấn ghi danh — khác STATUS_STYLES (status-pill.tsx)
// vì đây là 1 thang tiến triển nhiều bước (không chỉ vài trạng thái rời rạc),
// cần đủ sắc độ riêng để phân biệt từng mốc. 2 mốc CUỐI (Không quan tâm/Đã
// chốt) dùng lại đúng token destructive/status-qualified sẵn có của app để
// nhất quán với ngữ nghĩa "rớt"/"thành công" ở những nơi khác.
const STAGE_STYLES: Record<string, string> = {
  [CUSTOMER_STAGE.CALLED]: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  [CUSTOMER_STAGE.INTERESTED]: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  [CUSTOMER_STAGE.NOT_INTERESTED]: "bg-destructive/10 text-destructive",
  [CUSTOMER_STAGE.TEST_SCHEDULED]: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  [CUSTOMER_STAGE.TESTED]: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
  [CUSTOMER_STAGE.TRIAL_SCHEDULED]: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  [CUSTOMER_STAGE.TRIALED]: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300",
  [CUSTOMER_STAGE.ENROLLED]: "bg-status-qualified-bg text-status-qualified",
};

const NOT_CALLED_STYLE = "bg-status-waiting-bg text-status-waiting";
const UNASSIGNED_STYLE = "bg-secondary text-muted-foreground";

/** Chip màu cho 1 mốc tư vấn ghi danh — bao gồm cả 2 trạng thái "ảo" (chưa có
 * giá trị stage thật): "Chưa phân bổ" (chưa có Sale) và "Chưa gọi" (có Sale,
 * chưa từng cập nhật mốc nào). */
export function StageBadge({ stage, assigned }: { stage: string | null; assigned: boolean }) {
  if (!stage) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${assigned ? NOT_CALLED_STYLE : UNASSIGNED_STYLE}`}>
        <span className="size-1.5 rounded-full bg-current" />
        {assigned ? "Chưa gọi" : "Chưa phân bổ"}
      </span>
    );
  }
  const style = STAGE_STYLES[stage] ?? NOT_CALLED_STYLE;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {stage}
    </span>
  );
}
