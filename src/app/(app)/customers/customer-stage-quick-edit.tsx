"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/form-message";
import { StageBadge } from "@/app/(app)/customers/stage-badge";
import { updateCustomerStage } from "@/app/(app)/customers/customers-api";
import { CUSTOMER_STAGE, CUSTOMER_STAGE_VALUES } from "@/lib/interactions/constants";
import { useToast } from "@/hooks/use-toast";

// Cho Leader/Admin cập nhật nhanh mốc tư vấn ngay trên bảng /customers, không
// cần bấm vào từng khách — dùng cho ca khách đến trung tâm walk-in nhưng Sale
// phụ trách không có mặt. Chỉ đổi `stage`/`stageReason`, các field khác của
// khách (appointmentAt/caseDeadline/needsLeaderSupport) được GIỮ NGUYÊN đúng
// giá trị hiện có — updateCustomerStage() ghi đè toàn bộ 4 field này mỗi lần
// gọi (xem lib/customers/mutations.ts) nên phải truyền lại y nguyên, không
// truyền thì sẽ vô tình xoá mất ngày hẹn/hạn xử lý đang có của khách.
export function CustomerStageQuickEdit({
  customerKey,
  stage,
  assigned,
  stageReason,
  appointmentAt,
  caseDeadline,
  needsLeaderSupport,
}: {
  customerKey: string;
  stage: string | null;
  assigned: boolean;
  stageReason: string | null;
  appointmentAt: Date | null;
  caseDeadline: Date | null;
  needsLeaderSupport: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draftStage, setDraftStage] = useState(stage ?? "");
  const [draftReason, setDraftReason] = useState(stageReason ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNotInterested = draftStage === CUSTOMER_STAGE.NOT_INTERESTED;
  const reasonMissing = isNotInterested && !draftReason.trim();

  function openChange(next: boolean) {
    setOpen(next);
    if (next) {
      setDraftStage(stage ?? "");
      setDraftReason(stageReason ?? "");
      setError(null);
    }
  }

  async function handleSave() {
    if (!draftStage || reasonMissing) return;
    setPending(true);
    setError(null);
    try {
      await updateCustomerStage(customerKey, {
        stage: draftStage,
        stageReason: draftReason || null,
        appointmentAt,
        caseDeadline,
        needsLeaderSupport,
      });
      toast.success("Đã cập nhật mốc tư vấn.");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger
        render={<button type="button" className="group inline-flex items-center gap-1 rounded-full outline-none" aria-label={`Cập nhật mốc tư vấn cho ${customerKey}`} />}
      >
        <StageBadge stage={stage} assigned={assigned} />
        <ChevronDown className="size-3 text-muted-foreground/60 group-hover:text-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="mb-2 text-xs font-medium text-foreground">Cập nhật mốc tư vấn</p>
        <div className="flex flex-col gap-2.5">
          <Select value={draftStage} onValueChange={(v) => setDraftStage(v ?? "")}>
            <SelectTrigger className="h-9 w-full rounded-lg bg-background text-xs normal-case">
              <SelectValue placeholder="Chưa gọi" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_STAGE_VALUES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isNotInterested && (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`stage-reason-${customerKey}`} className="text-[11px] normal-case">
                Lý do không quan tâm
              </Label>
              <Input
                id={`stage-reason-${customerKey}`}
                value={draftReason}
                onChange={(e) => setDraftReason(e.target.value)}
                className="h-9 rounded-lg text-xs normal-case"
                aria-invalid={reasonMissing}
              />
            </div>
          )}
          {error && <FormMessage kind="error">{error}</FormMessage>}
          <Button type="button" size="sm" className="h-8 w-fit rounded-full normal-case" disabled={pending || !draftStage || reasonMissing} onClick={handleSave}>
            {pending && <LoaderCircle className="animate-spin" />}
            Lưu
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
