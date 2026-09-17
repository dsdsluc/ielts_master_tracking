"use client";

import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoRow } from "@/app/(app)/leads/info-row";
import type { InteractionDetail } from "@/app/(app)/leads/types";

export type EditableFieldKey =
  | "rawLink"
  | "customerName"
  | "fanpageName"
  | "adId"
  | "customerObjectName"
  | "assignedBranchCode"
  | "conversationLink";

export const FIELD_LABELS: Record<EditableFieldKey, string> = {
  rawLink: "Link khách hàng",
  customerName: "Tên khách",
  fanpageName: "Fanpage",
  adId: "Ad ID",
  customerObjectName: "Đối tượng",
  assignedBranchCode: "Cơ sở phụ trách",
  conversationLink: "Link hội thoại",
};

export function fieldKind(field: EditableFieldKey): "text" | "select" {
  return field === "fanpageName" || field === "customerObjectName" || field === "assignedBranchCode" ? "select" : "text";
}

export function getFieldValue(field: EditableFieldKey, detail: InteractionDetail): string {
  switch (field) {
    case "rawLink":
      return detail.rawLink;
    case "customerName":
      return detail.customerName;
    case "fanpageName":
      return detail.fanpageName;
    case "adId":
      return detail.adId ?? "";
    case "customerObjectName":
      return detail.customerObjectName;
    case "assignedBranchCode":
      return detail.assignedBranchCode;
    case "conversationLink":
      return detail.conversationLink ?? "";
  }
}

/** Đánh dấu trường bắt buộc — đặt ngay sau text của Label, mirror `Req` trong
 * new-lead-dialog.tsx (tab Facebook) để 2 nơi hiển thị nhất quán. */
function Req() {
  return (
    <span className="text-destructive" aria-hidden>
      {" "}
      *
    </span>
  );
}

/** Icon bút cuối mỗi input — bấm mở dialog sửa ĐÚNG trường đó (xem
 * edit-field-dialog.tsx). Input trong form chính LUÔN khóa (disabled), không
 * gõ trực tiếp được — đổi giá trị chỉ qua dialog rồi bấm Lưu, đúng lúc đó
 * server mới ghi đè + ghi log thay đổi. */
function FieldEditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
      aria-label={`Sửa ${label}`}
    >
      <Pencil className="size-3.5" />
    </button>
  );
}

/** Box "Thông tin liên hệ" — dùng chung giữa trang chi tiết liên hệ đầy đủ
 * (leads/[id]/lead-workspace.tsx) và trang chi tiết yêu cầu chăm sóc lại
 * (followup-inbox/[id]/followup-detail-view.tsx), để 2 nơi luôn hiển thị và
 * sửa được đúng như nhau — không lệch khi 1 bên đổi mà quên cập nhật bên kia. */
export function ContactInfoCard({
  detail,
  canEdit,
  detectedSourceName,
  onEdit,
}: {
  detail: InteractionDetail;
  canEdit: boolean;
  detectedSourceName: string | null;
  onEdit: (field: EditableFieldKey) => void;
}) {
  return (
    <div className="shadow-bubble rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Thông tin liên hệ</h2>
        {!canEdit && <span className="text-xs text-muted-foreground">Chỉ xem — không thể chỉnh sửa hội thoại này</span>}
      </div>

      {canEdit ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="view-rawLink" className="text-sm font-medium">
                Link khách hàng
                <Req />
              </Label>
              {detectedSourceName && (
                <span className="rounded-full bg-status-received-bg px-2 py-0.5 font-condensed text-[10px] font-semibold tracking-wide text-status-received uppercase">
                  Nguồn: {detectedSourceName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input id="view-rawLink" value={detail.rawLink} disabled className="h-10 flex-1 rounded-lg text-sm disabled:opacity-100" />
              <FieldEditButton label={FIELD_LABELS.rawLink} onClick={() => onEdit("rawLink")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-customerName" className="text-sm font-medium">
                Tên khách
                <Req />
              </Label>
              <div className="flex items-center gap-2">
                <Input id="view-customerName" value={detail.customerName} disabled className="h-10 flex-1 rounded-lg text-sm disabled:opacity-100" />
                <FieldEditButton label={FIELD_LABELS.customerName} onClick={() => onEdit("customerName")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-adId" className="text-sm font-medium">
                Ad ID (tuỳ chọn)
              </Label>
              <div className="flex items-center gap-2">
                <Input id="view-adId" value={detail.adId ?? "Chưa có"} disabled className="h-10 flex-1 rounded-lg text-sm disabled:opacity-100" />
                <FieldEditButton label={FIELD_LABELS.adId} onClick={() => onEdit("adId")} />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-fanpageName" className="text-sm font-medium">
                Fanpage
                <Req />
              </Label>
              <div className="flex items-center gap-2">
                <Input id="view-fanpageName" value={detail.fanpageName} disabled className="h-10 flex-1 rounded-lg text-sm disabled:opacity-100" />
                <FieldEditButton label={FIELD_LABELS.fanpageName} onClick={() => onEdit("fanpageName")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-customerObjectName" className="text-sm font-medium">
                Đối tượng
              </Label>
              <div className="flex items-center gap-2">
                <Input id="view-customerObjectName" value={detail.customerObjectName} disabled className="h-10 flex-1 rounded-lg text-sm disabled:opacity-100" />
                <FieldEditButton label={FIELD_LABELS.customerObjectName} onClick={() => onEdit("customerObjectName")} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="view-assignedBranchCode" className="text-sm font-medium">
                Cơ sở phụ trách
              </Label>
              <div className="flex items-center gap-2">
                <Input id="view-assignedBranchCode" value={detail.assignedBranchCode} disabled className="h-10 flex-1 rounded-lg text-sm disabled:opacity-100" />
                <FieldEditButton label={FIELD_LABELS.assignedBranchCode} onClick={() => onEdit("assignedBranchCode")} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="view-conversationLink" className="text-sm font-medium">
              Link hội thoại
              <Req />
            </Label>
            <div className="flex items-center gap-2">
              <Input id="view-conversationLink" value={detail.conversationLink ?? "Chưa có"} disabled className="h-10 flex-1 rounded-lg text-sm disabled:opacity-100" />
              <FieldEditButton label={FIELD_LABELS.conversationLink} onClick={() => onEdit("conversationLink")} />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <InfoRow
            label="Link khách hàng"
            value={
              <a className="underline underline-offset-2" href={detail.canonicalLink} target="_blank" rel="noreferrer">
                {detail.rawLink}
              </a>
            }
          />
          <InfoRow label="Tên khách" value={detail.customerName} />
          <InfoRow label="Fanpage" value={detail.fanpageName} />
          <InfoRow label="Ad ID" value={detail.adId ?? "Chưa có"} />
          <InfoRow label="Đối tượng" value={detail.customerObjectName} />
          <InfoRow label="Cơ sở phụ trách" value={detail.assignedBranchCode} />
          <InfoRow label="Link hội thoại" value={detail.conversationLink ?? "Chưa có"} />
        </div>
      )}
    </div>
  );
}
