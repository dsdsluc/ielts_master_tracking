import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import type { LucideIcon } from "lucide-react";

export type RankRow = {
  key: string;
  label: string;
  sub?: string;
  total: number;
  qualified: number;
};

function ratePillClass(rate: number) {
  if (rate >= 30) return "bg-status-qualified-bg text-status-qualified";
  if (rate >= 10) return "bg-status-received-bg text-status-received";
  return "bg-secondary text-muted-foreground";
}

export function MiniRankTable({
  title,
  rows,
  viewAllHref,
  emptyIcon,
  emptyText,
  rowHref,
}: {
  title: string;
  rows: RankRow[];
  viewAllHref: string;
  emptyIcon: LucideIcon;
  emptyText: string;
  rowHref?: (key: string) => string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Link href={viewAllHref} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          Xem tất cả <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={emptyIcon} title="Chưa có dữ liệu" description={emptyText} />
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {rows.map((row) => {
              const rate = row.total > 0 ? (row.qualified / row.total) * 100 : 0;
              const content = (
                <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{row.label}</p>
                    {row.sub && <p className="truncate text-xs text-muted-foreground">{row.sub}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{row.total} liên hệ</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-medium ${ratePillClass(rate)}`}>
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
              return rowHref ? (
                <Link key={row.key} href={rowHref(row.key)} className="block hover:bg-secondary/40">
                  {content}
                </Link>
              ) : (
                <div key={row.key}>{content}</div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
