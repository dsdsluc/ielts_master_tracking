"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CUSTOMER_STAGE_VALUES } from "@/lib/interactions/constants";

// "none" là sentinel cho "Chưa gọi" (stage null) — mirror customers/page.tsx.
const ALL = "all";

export function CustomersStageFilter({ value }: { value: string | null }) {
  const router = useRouter();

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(v) => router.push(v && v !== ALL ? `/customers?stage=${encodeURIComponent(v)}` : "/customers")}
      items={{ [ALL]: "Tất cả mốc tư vấn", none: "Chưa gọi", ...Object.fromEntries(CUSTOMER_STAGE_VALUES.map((s) => [s, s])) }}
    >
      <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-52">
        <SelectValue placeholder="Lọc theo mốc tư vấn" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>Tất cả mốc tư vấn</SelectItem>
        <SelectItem value="none">Chưa gọi</SelectItem>
        {CUSTOMER_STAGE_VALUES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
