"use client";

import { useMemo, useState } from "react";
import type { EditFieldSaveResult } from "@/app/(app)/leads/edit-field-dialog";
import type { EditableFieldKey } from "@/app/(app)/leads/contact-info-card";
import { detectSourceName, type LeadFormOptions } from "@/app/(app)/leads/lead-form-options";
import { updateInteractionInfo, type LeadInfoPayload } from "@/app/(app)/leads/leads-api";
import type { InteractionDetail } from "@/app/(app)/leads/types";
import { useToast } from "@/hooks/use-toast";

function buildFieldPayload(
  field: EditableFieldKey,
  newValue: string,
  duplicateReason: string | undefined,
  detail: InteractionDetail
): LeadInfoPayload & { expectedVersion: number } {
  const payload: LeadInfoPayload & { expectedVersion: number } = {
    rawLink: detail.rawLink,
    customerName: detail.customerName,
    fanpageName: detail.fanpageName,
    adId: detail.adId ?? undefined,
    customerObjectName: detail.customerObjectName,
    assignedBranchCode: detail.assignedBranchCode,
    conversationLink: detail.conversationLink ?? undefined,
    duplicateConfirmed: duplicateReason ? true : undefined,
    duplicateReason,
    expectedVersion: detail.version,
  };
  switch (field) {
    case "rawLink":
      payload.rawLink = newValue;
      break;
    case "customerName":
      payload.customerName = newValue;
      break;
    case "fanpageName":
      payload.fanpageName = newValue;
      break;
    case "adId":
      payload.adId = newValue || undefined;
      break;
    case "customerObjectName":
      payload.customerObjectName = newValue;
      break;
    case "assignedBranchCode":
      payload.assignedBranchCode = newValue;
      break;
    case "conversationLink":
      payload.conversationLink = newValue || undefined;
      break;
  }
  return payload;
}

/** State + hành vi sửa từng field của box "Thông tin liên hệ" (ContactInfoCard)
 * — dùng chung giữa trang chi tiết liên hệ đầy đủ (leads/[id]) và trang chi
 * tiết yêu cầu chăm sóc lại (followup-inbox/[id]) để 2 nơi luôn sửa đúng như
 * nhau. `onSaved` gọi sau khi lưu thành công (mỗi nơi tự làm mới dữ liệu theo
 * cách riêng — refresh() của hook client ở 1 nơi, router.refresh() ở nơi kia). */
export function useContactInfoEditor(detail: InteractionDetail | null, options: LeadFormOptions, onSaved: () => void) {
  const { toast } = useToast();
  const [editingField, setEditingField] = useState<EditableFieldKey | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Nguồn suy ra từ link HIỆN TẠI của liên hệ (dialog chỉ sửa 1 trường —
  // filter fanpage vẫn phải bám theo rawLink đã lưu của liên hệ, không phải
  // link đang gõ dở trong dialog khác).
  const detectedSourceName = useMemo(
    () => (detail ? detectSourceName(detail.rawLink, options.sourceDomains) : null),
    [detail, options.sourceDomains]
  );
  const filteredFanpages = useMemo(
    () => (detectedSourceName ? options.fanpages.filter((f) => f.defaultSourceName === detectedSourceName) : options.fanpages),
    [detectedSourceName, options.fanpages]
  );

  function fieldSelectOptions(field: EditableFieldKey): { value: string; label: string }[] | undefined {
    switch (field) {
      case "fanpageName":
        return filteredFanpages.map((f) => ({ value: f.name, label: f.name }));
      case "customerObjectName":
        return options.objects.map((o) => ({ value: o, label: o }));
      case "assignedBranchCode":
        return options.branches.map((b) => ({ value: b.code, label: b.name }));
      default:
        return undefined;
    }
  }

  function openEditDialog(field: EditableFieldKey) {
    setEditingField(field);
    setEditDialogOpen(true);
  }

  async function handleFieldSave(field: EditableFieldKey, newValue: string, duplicateReason?: string): Promise<EditFieldSaveResult> {
    if (!detail) return { ok: true };
    const result = await updateInteractionInfo(detail.interactionId, buildFieldPayload(field, newValue, duplicateReason, detail));
    if ("status" in result && result.status === 409) {
      return { ok: false, duplicate: result.duplicate };
    }
    toast.success("Đã lưu thay đổi.");
    onSaved();
    return { ok: true };
  }

  return {
    editingField,
    editDialogOpen,
    setEditDialogOpen,
    detectedSourceName,
    openEditDialog,
    fieldSelectOptions,
    handleFieldSave,
  };
}
