"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Fingerprint, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ConversionPill } from "@/app/(app)/ads-performance/ads-performance-table";
import { formatDate, formatVnd } from "@/app/(app)/ads-cost/format";

export type AdIdRegistryRow = {
  adId: string;
  adName: string | null;
  sourceName: string | null;
  fanpageName: string | null;
  firstSeenAt: string | null;
  totalLeads: number;
  qualified: number;
  totalCost: number;
};

// Chỉ Ad ID ĐÃ có bản ghi "Chi phí quảng cáo" — Ad ID mới phát hiện (xuất
// hiện trong liên hệ nhưng chưa nhập chi phí) đã tách hẳn sang trang quản trị
// /admin/new-ad-ids, trang này chỉ còn đúng 1 việc: theo dõi hiệu quả Ad ID
// đã đăng ký, phù hợp hơn với vai trò Marketing (không lẫn việc "phát hiện").
export function AdIdRegistryView({ rows }: { rows: AdIdRegistryRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    if (!needle) return rows;
    return rows.filter(
      (r) => r.adId.toLocaleLowerCase("vi").includes(needle) || (r.adName?.toLocaleLowerCase("vi").includes(needle) ?? false)
    );
  }, [rows, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm Ad ID, tên quảng cáo…"
            className="h-10 rounded-xl bg-background pr-3 pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Fingerprint} title="Không có Ad ID nào" description="Chưa có Ad ID nào phù hợp với bộ lọc hiện tại." />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{filtered.length}</strong> Ad ID
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Nguồn / Fanpage</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Lần đầu thấy</TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Liên hệ</TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ</TableHead>
                  <TableHead className="px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chi phí</TableHead>
                  <TableHead className="hidden px-4 text-right font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">CP/liên hệ</TableHead>
                  <TableHead className="w-36 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const rate = row.totalLeads > 0 ? (row.qualified / row.totalLeads) * 100 : 0;
                  const costPerLead = row.totalCost > 0 && row.totalLeads > 0 ? row.totalCost / row.totalLeads : null;
                  return (
                    <TableRow key={row.adId} className="odd:bg-secondary/10">
                      <TableCell className="min-w-40 px-5 py-3.5">
                        <p className="max-w-56 truncate font-medium text-foreground" title={row.adName ?? row.adId}>{row.adName ?? row.adId}</p>
                        <p className="max-w-56 truncate font-mono text-[11px] text-muted-foreground" title={row.adId}>{row.adId}</p>
                      </TableCell>
                      <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                        {row.sourceName ? (
                          <p className="max-w-40 truncate" title={`${row.sourceName} · ${row.fanpageName}`}>
                            {row.sourceName} · {row.fanpageName}
                          </p>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">
                        {row.firstSeenAt ? formatDate(row.firstSeenAt) : "—"}
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{row.totalLeads}</TableCell>
                      <TableCell className="px-4 text-center">
                        {row.totalLeads > 0 ? <ConversionPill rate={rate} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="px-4 text-right">
                        <span className="font-mono text-sm text-foreground">{formatVnd(row.totalCost)}</span>
                      </TableCell>
                      <TableCell className="hidden px-4 text-right font-mono text-xs text-muted-foreground md:table-cell">
                        {costPerLead != null ? formatVnd(Math.round(costPerLead)) : "—"}
                      </TableCell>
                      <TableCell className="pr-5 pl-1 text-right">
                        <Link
                          href={`/ads-performance/${encodeURIComponent(row.adId)}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-status-received hover:underline"
                        >
                          Xem chi tiết <ArrowRight className="size-3.5" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
