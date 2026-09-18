"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, ExternalLink, LoaderCircle, Lock, LockOpen, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiErrorMessage } from "@/lib/api-client";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import type { PageReportLeadDetail, SourceBreakdownRow } from "@/lib/marketing/page-report";

export type PageReportRow = {
  fanpageName: string;
  totalLeads: number;
  qualifiedLeads: number;
  conversionRate: number;
  closed: boolean;
  closedAt: string | null;
  closedByName: string | null;
  sourceBreakdown?: SourceBreakdownRow[];
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

/** Danh sách liên hệ cụ thể đã gộp thành số của 1 Page trong ngày — cho phép
 * Marketing đối chiếu với số thấy trực tiếp trên Page trước khi chốt/yêu cầu
 * sửa lại, thay vì chỉ nhìn 1 con số tổng không giải thích được. */
function PageReportDetailPanel({
  fanpageName,
  totalLeads,
  detail,
}: {
  fanpageName: string;
  totalLeads: number;
  detail: PageReportLeadDetail[] | "loading" | "error" | undefined;
}) {
  if (detail === "loading" || detail === undefined) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Đang tải danh sách liên hệ của &quot;{fanpageName}&quot;…
      </div>
    );
  }
  if (detail === "error") {
    return <p className="py-3 text-sm text-destructive">Không tải được danh sách liên hệ — vui lòng thử lại.</p>;
  }
  if (detail.length === 0) {
    return <EmptyState icon={Users} title="Chưa có liên hệ nào" description="Không có liên hệ nào tạo trong ngày này cho Page trên." />;
  }

  return (
    <div className="flex flex-col gap-2 py-2">
      <p className="text-xs text-muted-foreground">
        <strong className="font-mono text-foreground">{detail.length}</strong> liên hệ tính vào {totalLeads} &quot;tin nhắn nhận được&quot; — đối chiếu
        với số thấy trực tiếp trên Page. Thiếu/sai thì mở từng liên hệ để kiểm tra hoặc yêu cầu Sale bổ sung.
      </p>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <Table>
          <TableHeader className="bg-secondary/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Nguồn</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tạo lúc</TableHead>
              <TableHead className="w-10 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.map((item) => (
              <TableRow key={item.interactionId} className="odd:bg-secondary/10">
                <TableCell className="min-w-40 px-4 py-2.5">
                  <p className="max-w-52 truncate font-medium text-foreground" title={item.customerName}>{item.customerName}</p>
                  {item.phoneNormalized && <p className="font-mono text-xs text-muted-foreground">{item.phoneNormalized}</p>}
                </TableCell>
                <TableCell className="px-4 text-sm text-muted-foreground">{item.sourceName}</TableCell>
                <TableCell className="px-4">
                  <StatusPill status={item.statusName} />
                </TableCell>
                <TableCell className="px-4 text-xs text-muted-foreground">{formatDateTime(item.createdLeadAt)}</TableCell>
                <TableCell className="pr-4 text-right">
                  <Link href={`/leads/${item.interactionId}`} className="inline-flex text-muted-foreground hover:text-primary" aria-label="Mở liên hệ">
                    <ExternalLink className="size-3.5" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailsByKey, setDetailsByKey] = useState<Record<string, PageReportLeadDetail[] | "loading" | "error">>({});

  async function toggleExpand(fanpageName: string) {
    if (expandedKey === fanpageName) {
      setExpandedKey(null);
      return;
    }
    setExpandedKey(fanpageName);
    if (detailsByKey[fanpageName]) return;
    setDetailsByKey((prev) => ({ ...prev, [fanpageName]: "loading" }));
    try {
      const data = await apiFetch<{ rows: PageReportLeadDetail[] }>(
        `/api/marketing/page-report/detail?date=${encodeURIComponent(date)}&fanpageName=${encodeURIComponent(fanpageName)}`,
        { cache: "no-store" }
      );
      setDetailsByKey((prev) => ({ ...prev, [fanpageName]: data.rows }));
    } catch {
      setDetailsByKey((prev) => ({ ...prev, [fanpageName]: "error" }));
    }
  }

  const openCount = rows.filter((r) => !r.closed).length;
  // Đã chốt lên trước để thấy ngay những gì đã xong, phần còn cần xử lý
  // (chưa chốt) dồn xuống dưới thay vì xen kẽ theo thứ tự Page.
  const sortedRows = [...rows].sort((a, b) => Number(b.closed) - Number(a.closed));

  async function handleClose(fanpageName: string) {
    setPendingKey(fanpageName);
    try {
      await apiFetch("/api/marketing/page-report/close", {
        method: "POST",
        body: JSON.stringify({ date, fanpageName }),
      });
      toast.success(`Đã chốt báo cáo Page "${fanpageName}".`);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPendingKey(null);
    }
  }

  async function handleReopen(fanpageName: string) {
    setPendingKey(fanpageName);
    try {
      await apiFetch("/api/marketing/page-report/reopen", {
        method: "POST",
        body: JSON.stringify({ date, fanpageName }),
      });
      toast.success(`Đã mở lại báo cáo Page "${fanpageName}".`);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPendingKey(null);
    }
  }

  async function handleCloseAll() {
    setClosingAll(true);
    try {
      const data = await apiFetch<{ closed: number }>("/api/marketing/page-report/close-all", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      toast.success(`Đã chốt ${data.closed} Page.`);
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
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
            {sortedRows.map((row) => {
              const pending = pendingKey === row.fanpageName;
              const expanded = expandedKey === row.fanpageName;
              const detail = detailsByKey[row.fanpageName];
              return (
                <Fragment key={row.fanpageName}>
                <TableRow className="odd:bg-secondary/10">
                  <TableCell className="px-5 py-3.5 font-medium text-foreground">
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-left hover:text-primary"
                      onClick={() => toggleExpand(row.fanpageName)}
                    >
                      {expanded ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                      {row.fanpageName}
                    </button>
                    {row.sourceBreakdown && row.sourceBreakdown.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 pl-5">
                        {row.sourceBreakdown.map((b) => (
                          <span key={b.sourceName} className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {b.sourceName} {b.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </TableCell>
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
                {expanded && (
                  <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                    <TableCell colSpan={7} className="px-5 py-3">
                      <PageReportDetailPanel fanpageName={row.fanpageName} totalLeads={row.totalLeads} detail={detail} />
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
