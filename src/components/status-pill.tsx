import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  "Chờ": "bg-status-waiting-bg text-status-waiting",
  "Tiếp nhận": "bg-status-received-bg text-status-received",
  "Đủ tiêu chuẩn": "bg-status-qualified-bg text-status-qualified",
  "Spam": "bg-status-spam-bg text-status-spam",
};

const DEFAULT_STYLE = "bg-status-waiting-bg text-status-waiting";

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? DEFAULT_STYLE;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        style
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
