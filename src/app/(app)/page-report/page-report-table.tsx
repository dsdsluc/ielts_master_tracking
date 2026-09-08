"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Lock, LockOpen } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/app/(app)/leads/lead-format";

export type PageReportRow = {
  fanpageName: string;
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  closed: boolean;
  closedAt: string | null;
  closedByName: string | null;
};

function ConversionPill({ rate }: { rate: number }) {
  const style =
    rate >= 30
      ? "bg-status-qualified-bg text-status-qualified"
      : rate >= 10
        ? "bg-status-received-bg text-status-received"
        : "bg-secondary text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${style}`}>{rate.toFixed(1)}%</span>;
}

function StatusBadge({ closed }: { closed: boolean }) {
  const style = closed ? "bg-status-qualified-bg text-status-qualified" : "bg-status-waiting-bg text-status-waiting";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {closed ? "Đã chốt" : "Đang cập nhật"}
    </span>
  );
}

export function PageReportTable({
  rows,
  date,
  canClose,
  isAdmin,
}: {
  rows: PageReportRow[];
  date: string;
  canClose: boolean;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [closingAll, setClosingAll] = useState(false);

  const openCount = rows.filter((r) => !r.closed).length;

  async function handleClose(fanpageName: string) {
    setPendingKey(fanpageName);
    try {
      const res = await fetch("/api/marketing/page-report/close", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, fanpageName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      toast.success(`Đã chốt báo cáo Page "${fanpageName}".`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không chốt được báo cáo.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleReopen(fanpageName: string) {
    setPendingKey(fanpageName);
    try {
      const res = await fetch("/api/marketing/page-report/reopen", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, fanpageName }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      toast.success(`Đã mở lại báo cáo Page "${fanpageName}".`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không mở lại được.");
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCloseAll() {
    setClosingAll(true);
    try {
      const res = await fetch("/api/marketing/page-report/close-all", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      toast.success(`Đã chốt ${body.closed} Page.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không chốt được báo cáo.");
    } finally {
      setClosingAll(false);
    }
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{rows.length}</strong> Page ·{" "}
          <strong className="font-mono text-foreground">{openCount}</strong> chưa chốt
        </p>
        {canClose && openCount > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={handleCloseAll}
            disabled={closingAll}
          >
            {closingAll ? <LoaderCircle className="animate-spin" /> : <Lock className="size-3.5" />}
            Chốt tất cả ({openCount})
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[840px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Page</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tin nhắn nhận được</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách xin SĐT</TableHead>
              <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ chuyển đổi</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Chốt bởi</TableHead>
              <TableHead className="w-16 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const pending = pendingKey === row.fanpageName;
              return (
                <TableRow key={row.fanpageName} className="odd:bg-secondary/10">
                  <TableCell className="px-5 py-3.5 font-medium text-foreground">{row.fanpageName}</TableCell>
                  <TableCell className="px-4 text-center font-mono text-sm text-foreground">{row.totalLeads}</TableCell>
                  <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{row.qualifiedLeads}</TableCell>
                  <TableCell className="px-4 text-center">
                    <ConversionPill rate={row.conversionRate} />
                  </TableCell>
                  <TableCell className="px-4">
                    <StatusBadge closed={row.closed} />
                  </TableCell>
                  <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">
                    {row.closed ? (
                      <>
                        {row.closedByName ?? "—"}
                        {row.closedAt && <span className="block">{formatDateTime(row.closedAt)}</span>}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="pr-5 pl-1 text-right">
                    {row.closed ? (
                      isAdmin && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground hover:text-foreground"
                          aria-label="Mở lại báo cáo"
                          onClick={() => handleReopen(row.fanpageName)}
                          disabled={pending}
                        >
                          {pending ? <LoaderCircle className="animate-spin" /> : <LockOpen className="size-3.5" />}
                        </Button>
                      )
                    ) : (
                      canClose && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => handleClose(row.fanpageName)}
                          disabled={pending}
                        >
                          {pending ? <LoaderCircle className="animate-spin" /> : <Lock className="size-3.5" />}
                          Chốt
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
