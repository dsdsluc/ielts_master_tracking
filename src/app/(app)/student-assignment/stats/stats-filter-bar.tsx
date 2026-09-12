"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS_OPTIONS = [
  { value: "7", label: "7 ngày gần nhất" },
  { value: "30", label: "30 ngày gần nhất" },
  { value: "90", label: "90 ngày gần nhất" },
];

export function StatsFilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const days = searchParams.get("days") ?? "30";
  const daysItems = Object.fromEntries(DAYS_OPTIONS.map((o) => [o.value, o.label]));

  function updateDays(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", value);
    router.push(`/student-assignment/stats?${params.toString()}`);
  }

  return (
    <Select items={daysItems} value={days} onValueChange={(v) => updateDays(v ?? "30")}>
      <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DAYS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
