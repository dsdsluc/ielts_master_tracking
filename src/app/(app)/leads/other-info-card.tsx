import { ExternalLink, MessageCircleMore, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { InfoRow } from "@/app/(app)/leads/info-row";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import type { InteractionDetail } from "@/app/(app)/leads/types";

/** Box "Thông tin khác" — dùng chung giữa trang chi tiết liên hệ đầy đủ
 * (leads/[id]/lead-workspace.tsx) và trang chi tiết yêu cầu chăm sóc lại
 * (followup-inbox/[id]/followup-detail-view.tsx). Thuần hiển thị, không có
 * state/hành vi sửa nên không cần "use client" riêng. */
export function OtherInfoCard({ detail }: { detail: InteractionDetail }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Thông tin khác</h2>
      <InfoRow label="Cơ sở gợi ý" value={detail.suggestedBranchCode} />
      <InfoRow label="Tư vấn viên" value={detail.consultantName ?? "Chưa gán"} />
      <InfoRow
        label="SĐT"
        value={
          detail.phoneNormalized ? (
            <span className="flex items-center justify-end gap-1.5 font-mono">
              <PhoneCall className="size-3.5" />
              {detail.phoneNormalized}
              <CopyButton value={detail.phoneNormalized} label="Đã copy số điện thoại" />
            </span>
          ) : (
            "Chưa có"
          )
        }
      />
      <InfoRow label="Tạo lúc" value={formatDateTime(detail.createdAt)} />
      {detail.closedAt && <InfoRow label="Đóng lúc" value={formatDateTime(detail.closedAt)} />}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          className="rounded-full border-status-received/25 bg-status-received-bg/50 text-status-received hover:bg-status-received-bg"
          render={<a href={detail.conversationLink ?? detail.canonicalLink} target="_blank" rel="noreferrer" />}
        >
          <MessageCircleMore className="size-3.5" />
          {detail.conversationLink ? "Mở hội thoại" : "Mở trang khách"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          className="rounded-full border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
          render={<a href={detail.canonicalLink} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink className="size-3.5" />
          Link chuẩn
        </Button>
      </div>
    </div>
  );
}
