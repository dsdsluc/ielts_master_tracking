import { NotebookPen } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import type { FollowupTrackingRow } from "@/app/(app)/followup-tracking/followup-tracking-table";

/* eslint-disable react/no-unescaped-entities -- Quotation marks are intentional in the Vietnamese UI label. */

/** Liệt kê thẳng nội dung Sale ghi khi "Đánh dấu đã xử lý" (hoặc khi đổi
 * trạng thái lúc đang có yêu cầu chăm sóc lại) — đặt ngay dưới section thống
 * kê để Leader/Marketing xem nhanh không cần bấm vào từng dòng trong bảng. */
export function FollowupResolveNotesLog({ rows }: { rows: FollowupTrackingRow[] }) {
  const notedRows = rows
    .filter((r) => r.resolveNote)
    .sort((a, b) => new Date(b.followupHandledAt ?? 0).getTime() - new Date(a.followupHandledAt ?? 0).getTime());

  if (notedRows.length === 0) return null;

  return (
    <div className="shadow-bubble mb-6 overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="border-b border-border/70 px-5 py-3">
        <p className="flex items-center gap-1.5 font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <NotebookPen className="size-3.5" /> Ghi chú "Đánh dấu đã xử lý"
        </p>
      </div>
      <div className="flex max-h-96 flex-col gap-2.5 overflow-y-auto p-5">
        {notedRows.map((row) => (
          <div
            key={row.interactionId}
            className="flex flex-col gap-1.5 rounded-xl border border-border/60 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground" title={row.customerName}>{row.customerName}</p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap text-muted-foreground">{row.resolveNote}</p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
              <StatusPill status={row.status} />
              {row.followupHandledAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(row.followupHandledAt)}
                  {row.followupHandledByName ? ` · ${row.followupHandledByName}` : ""}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
