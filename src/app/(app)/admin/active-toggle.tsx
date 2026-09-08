"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Badge bấm được để đảo trạng thái Hoạt động — dùng chung Nguồn/Fanpage/...
 * Nhận thẳng Server Action + key thay vì 1 closure bọc quanh nó — React không
 * cho truyền closure tạo trên server (không tuần tự hoá được) qua Client
 * Component, chỉ cho truyền chính tham chiếu Server Action.
 */
export function ActiveToggle({
  active,
  entityKey,
  action,
}: {
  active: boolean;
  entityKey: string;
  action: (key: string, active: boolean) => Promise<void>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    setPending(true);
    try {
      await action(entityKey, !active);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button type="button" onClick={handleClick} disabled={pending} className="inline-flex cursor-pointer disabled:cursor-wait" aria-label={active ? "Bấm để ngừng hoạt động" : "Bấm để kích hoạt lại"}>
      <Badge variant={active ? "default" : "outline"}>
        {pending && <LoaderCircle className="size-3 animate-spin" />}
        {active ? "Hoạt động" : "Ngừng"}
      </Badge>
    </button>
  );
}
