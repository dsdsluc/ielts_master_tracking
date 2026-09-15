import Link from "next/link";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  accentClassName = "bg-primary",
  href,
}: {
  label: string;
  value: string | number;
  accentClassName?: string;
  /** Có thì cả card thành 1 link bấm được (điều hướng nhanh sang trang liên
   * quan) — không truyền thì giữ nguyên hành vi cũ (chỉ hiển thị số liệu). */
  href?: string;
}) {
  const content = (
    <>
      <span className={cn("h-9 w-1 shrink-0 rounded-full", accentClassName)} />
      <div className="flex flex-col">
        <span className="font-heading text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-secondary/40"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      {content}
    </div>
  );
}
