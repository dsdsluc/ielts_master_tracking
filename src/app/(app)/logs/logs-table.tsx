"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { actionLabel, buildDetailDiffRows, fieldLabel, formatDetailValue, resultLabel } from "@/app/(app)/logs/format";

export type LogRow = {
  logId: string;
  loggedAt: string;
  actorName: string;
  actorEmail: string | null;
  actorRole: string;
  action: string;
  result: string;
  interactionId: string | null;
  customerName: string | null;
  detailOld: unknown;
  detailNew: unknown;
  technicalInfo: string | null;
};

const RESULT_STYLES: Record<string, string> = {
  SUCCESS: "bg-status-qualified-bg text-status-qualified",
  FAIL: "bg-destructive/10 text-destructive",
};

function ResultPill({ result }: { result: string }) {
  const style = RESULT_STYLES[result] ?? "bg-secondary text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {resultLabel(result)}
    </span>
  );
}

function hasDetail(row: LogRow) {
  return row.detailOld != null || row.detailNew != null || !!row.technicalInfo;
}

export function LogsTable({ rows }: { rows: LogRow[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[920px]">
        <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 pl-5" />
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Thời gian</TableHead>
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Người thực hiện</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Vai trò</TableHead>
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Hành động</TableHead>
            <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Liên hệ liên quan</TableHead>
            <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Kết quả</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const expandable = hasDetail(row);
            const expanded = expandedId === row.logId;
            const diffRows = expandable ? buildDetailDiffRows(row.detailOld, row.detailNew) : null;
            return (
              <Fragment key={row.logId}>
                <TableRow
                  className={`odd:bg-secondary/10 ${expandable ? "cursor-pointer" : ""}`}
                  onClick={expandable ? () => setExpandedId(expanded ? null : row.logId) : undefined}
                >
                  <TableCell className="pl-5">
                    {expandable && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground"
                        aria-label={expanded ? "Thu gọn chi tiết" : "Xem chi tiết"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedId(expanded ? null : row.logId);
                        }}
                      >
                        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="min-w-36 px-4 text-sm text-muted-foreground">{formatDateTime(row.loggedAt)}</TableCell>
                  <TableCell className="min-w-40 px-4">
                    <p className="truncate font-medium text-foreground">{row.actorName}</p>
                    {row.actorEmail && <p className="truncate text-xs text-muted-foreground">{row.actorEmail}</p>}
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{row.actorRole}</TableCell>
                  <TableCell className="px-4 text-sm text-foreground">{actionLabel(row.action)}</TableCell>
                  <TableCell className="hidden px-4 text-sm md:table-cell">
                    {row.interactionId ? (
                      <Link
                        href={`/leads/${row.interactionId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-status-received underline underline-offset-2 hover:text-status-received/80"
                      >
                        {row.customerName ?? row.interactionId}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <ResultPill result={row.result} />
                  </TableCell>
                </TableRow>
                {expandable && expanded && (
                  <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                    <TableCell />
                    <TableCell colSpan={6} className="px-4 py-4">
                      {diffRows && diffRows.length > 0 && (
                        <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border/60 bg-secondary/40">
                                <th className="px-3 py-1.5 text-left font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trường</th>
                                <th className="px-3 py-1.5 text-left font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trước</th>
                                <th className="px-3 py-1.5 text-left font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sau</th>
                              </tr>
                            </thead>
                            <tbody>
                              {diffRows.map((d) => (
                                <tr key={d.key} className="border-b border-border/40 last:border-0">
                                  <td className="px-3 py-1.5 text-muted-foreground">{fieldLabel(d.key)}</td>
                                  <td className={`px-3 py-1.5 ${d.hasBefore ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-muted-foreground/50"}`}>
                                    {d.hasBefore ? formatDetailValue(d.before) : "—"}
                                  </td>
                                  <td className={`px-3 py-1.5 ${d.hasAfter ? "font-medium text-foreground" : "text-muted-foreground/50"}`}>
                                    {d.hasAfter ? formatDetailValue(d.after) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {row.technicalInfo && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">Ghi chú kỹ thuật: </span>
                          {row.technicalInfo}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
