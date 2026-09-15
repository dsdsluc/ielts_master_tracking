"use client";

import { useRouter } from "next/navigation";
import { UserRoundPlus } from "lucide-react";
import { NewLeadDialog } from "@/app/(app)/leads/new-lead-dialog";
import type { LeadFormOptions } from "@/app/(app)/leads/lead-form-options";

// Cùng hình dạng box với 3 box nhiệm vụ còn lại (icon tròn + tiêu đề + số liệu)
// nhưng thay ChevronRight bằng chính nút "Thêm liên hệ mới" — tạo liên hệ là
// hành động Sale tự khởi tạo (không phải điều hướng tới 1 danh sách có sẵn),
// nên phải bấm được ngay tại đây thay vì chỉ link sang trang khác.
export function CreateLeadTaskCard({ options, createdToday }: { options: LeadFormOptions; createdToday: number }) {
  const router = useRouter();

  return (
    <div className="shadow-bubble flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received">
          <UserRoundPlus className="size-4" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Tạo liên hệ</p>
          <p className="text-xs text-muted-foreground">{createdToday} liên hệ mới hôm nay</p>
        </div>
      </div>
      <NewLeadDialog options={options} onCreated={() => router.refresh()} />
    </div>
  );
}
