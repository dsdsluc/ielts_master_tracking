"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { createAdsCost } from "@/app/(app)/ads-cost/actions";
import { formatDate } from "@/app/(app)/ads-cost/format";
import { cn } from "@/lib/utils";

export type NewAdIdRow = {
  adId: string;
  leadCount: number;
  firstSeenAt: string;
  suggestedSourceName: string;
  suggestedFanpageName: string;
  suggestedBranchCode: string;
};

type EditableRow = NewAdIdRow & {
  adName: string;
  sourceName: string;
  fanpageName: string;
  branchCode: string;
  periodStart: string;
  periodEnd: string;
  costVnd: string;
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toEditable(row: NewAdIdRow): EditableRow {
  return {
    ...row,
    adName: "",
    sourceName: row.suggestedSourceName,
    fanpageName: row.suggestedFanpageName,
    branchCode: row.suggestedBranchCode,
    periodStart: row.firstSeenAt.slice(0, 10),
    periodEnd: todayStr(),
    costVnd: "",
  };
}

export function NewAdIdsView({
  rows: initialRows,
  sourceOptions,
  fanpageOptions,
  branchOptions,
}: {
  rows: NewAdIdRow[];
  sourceOptions: string[];
  fanpageOptions: { name: string; defaultSourceName: string }[];
  branchOptions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [rows, setRows] = useState<EditableRow[]>(() => initialRows.map(toEditable));
  const [savingAll, setSavingAll] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateRow<K extends keyof EditableRow>(adId: string, key: K, value: EditableRow[K]) {
    setRows((prev) => prev.map((r) => (r.adId === adId ? { ...r, [key]: value } : r)));
  }

  function dismissRow(adId: string) {
    setRows((prev) => prev.filter((r) => r.adId !== adId));
  }

  function isValid(row: EditableRow) {
    return !!(row.adName.trim() && row.costVnd.trim() && row.periodStart && row.periodEnd);
  }

  const validRows = rows.filter(isValid);

  function toPayload(row: EditableRow) {
    return {
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      adId: row.adId,
      adName: row.adName,
      sourceName: row.sourceName,
      fanpageName: row.fanpageName,
      branchCode: row.branchCode,
      costVnd: row.costVnd,
    };
  }

  async function handleSaveOne(row: EditableRow) {
    setSavingId(row.adId);
    try {
      await createAdsCost(toPayload(row));
      toast.success(`Đã lưu chi phí cho Ad ID ${row.adId}.`);
      dismissRow(row.adId);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Không lưu được Ad ID ${row.adId}.`);
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveAll() {
    setSavingAll(true);
    const targets = validRows;
    const failedIds = new Set<string>();
    try {
      for (const row of targets) {
        try {
          await createAdsCost(toPayload(row));
        } catch {
          failedIds.add(row.adId);
        }
      }
      const successCount = targets.length - failedIds.size;
      setRows((prev) => prev.filter((r) => !targets.some((t) => t.adId === r.adId) || failedIds.has(r.adId)));
      if (failedIds.size === 0) {
        toast.success(`Đã lưu ${successCount} Ad ID.`);
      } else {
        toast.error(`Đã lưu ${successCount}/${targets.length} Ad ID — ${failedIds.size} dòng lỗi, vẫn giữ lại để bạn sửa.`);
      }
      router.refresh();
    } finally {
      setSavingAll(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="shadow-bubble flex flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card p-10 text-center">
        <CheckCircle2 className="size-6 text-status-qualified" />
        <p className="text-sm font-medium text-foreground">Đã xử lý hết Ad ID mới.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            <strong className="font-mono text-foreground">{rows.length}</strong> Ad ID mới ·{" "}
            <span className={validRows.length === rows.length ? "text-status-qualified" : "text-status-waiting"}>
              {validRows.length} sẵn sàng lưu
            </span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table className="min-w-[1180px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 px-3" />
                <TableHead className="min-w-44 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
                <TableHead className="min-w-48 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên quảng cáo</TableHead>
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Nguồn</TableHead>
                <TableHead className="min-w-44 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Fanpage</TableHead>
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                <TableHead className="min-w-56 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Kỳ báo cáo</TableHead>
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chi phí (VND)</TableHead>
                <TableHead className="w-24 px-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const valid = isValid(row);
                const filteredFanpages = row.sourceName
                  ? fanpageOptions.filter((f) => f.defaultSourceName === row.sourceName)
                  : fanpageOptions;
                const fanpageList = filteredFanpages.length > 0 ? filteredFanpages : fanpageOptions;
                const saving = savingId === row.adId;
                return (
                  <TableRow key={row.adId} className="odd:bg-secondary/10 align-top">
                    <TableCell className="px-3 py-3">
                      {valid ? (
                        <CheckCircle2 className="size-4 text-status-qualified" />
                      ) : (
                        <TriangleAlert className="size-4 text-status-waiting" />
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <p className="font-mono text-xs text-foreground">{row.adId}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {row.leadCount} liên hệ · thấy lần đầu {formatDate(row.firstSeenAt)}
                      </p>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        value={row.adName}
                        onChange={(e) => updateRow(row.adId, "adName", e.target.value)}
                        placeholder="Tên chiến dịch/quảng cáo"
                        className={cn("h-9 rounded-lg", !row.adName.trim() && "border-destructive/50")}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Select value={row.sourceName} onValueChange={(v) => updateRow(row.adId, "sourceName", v ?? "")}>
                        <SelectTrigger className="h-9 w-full rounded-lg">
                          <SelectValue placeholder="Chọn nguồn" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceOptions.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Select value={row.fanpageName} onValueChange={(v) => updateRow(row.adId, "fanpageName", v ?? "")}>
                        <SelectTrigger className="h-9 w-full rounded-lg">
                          <SelectValue placeholder="Chọn fanpage" />
                        </SelectTrigger>
                        <SelectContent>
                          {fanpageList.map((f) => (
                            <SelectItem key={f.name} value={f.name}>
                              {f.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Select value={row.branchCode} onValueChange={(v) => updateRow(row.adId, "branchCode", v ?? "")}>
                        <SelectTrigger className="h-9 w-full rounded-lg">
                          <SelectValue placeholder="Chọn cơ sở" />
                        </SelectTrigger>
                        <SelectContent>
                          {branchOptions.map((b) => (
                            <SelectItem key={b.code} value={b.code}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="date"
                          value={row.periodStart}
                          onChange={(e) => updateRow(row.adId, "periodStart", e.target.value)}
                          className="h-9 rounded-lg"
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input
                          type="date"
                          value={row.periodEnd}
                          onChange={(e) => updateRow(row.adId, "periodEnd", e.target.value)}
                          className="h-9 rounded-lg"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        step="1000"
                        value={row.costVnd}
                        onChange={(e) => updateRow(row.adId, "costVnd", e.target.value)}
                        placeholder="0"
                        className={cn("h-9 rounded-lg", !row.costVnd.trim() && "border-destructive/50")}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-9 rounded-full px-3"
                          disabled={!valid || saving}
                          onClick={() => handleSaveOne(row)}
                        >
                          {saving ? <LoaderCircle className="animate-spin" /> : "Lưu"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground hover:text-foreground"
                          aria-label="Bỏ qua Ad ID này"
                          onClick={() => dismissRow(row.adId)}
                        >
                          <X className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="shadow-bubble flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Sẵn sàng lưu <strong className="font-mono text-foreground">{validRows.length}</strong>/{rows.length} Ad ID
        </p>
        <Button
          type="button"
          className="glossy shadow-bubble rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
          disabled={validRows.length === 0 || savingAll}
          onClick={handleSaveAll}
        >
          {savingAll && <LoaderCircle className="animate-spin" />}
          Lưu tất cả ({validRows.length})
        </Button>
      </div>
    </div>
  );
}
