"use client";

import { Fragment, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { detectSourceName, type LeadFormOptions } from "@/app/(app)/leads/lead-form-options";
import { createInteraction } from "@/app/(app)/leads/leads-api";
import type { DuplicateConflict } from "@/app/(app)/leads/types";
import { cn } from "@/lib/utils";

type ImportRow = {
  id: string;
  rawLink: string;
  customerName: string;
  fanpageName: string;
  adId: string;
  customerObjectName: string;
  conversationLink: string;
};

const TEMPLATE_HEADERS = ["Link khách hàng", "Tên khách", "Fanpage", "Ad ID", "Đối tượng", "Link hội thoại"] as const;

// Khớp tên cột linh hoạt (thường/hoa, khoảng trắng thừa) — nếu file không khớp
// tên cột nào cả thì rơi về đúng thứ tự cột như file mẫu.
const HEADER_FIELD_MAP: Record<string, keyof Omit<ImportRow, "id">> = {
  "link khách hàng": "rawLink",
  "link khach hang": "rawLink",
  "tên khách": "customerName",
  "ten khach": "customerName",
  "tên khách hàng": "customerName",
  fanpage: "fanpageName",
  "ad id": "adId",
  adid: "adId",
  "đối tượng": "customerObjectName",
  "doi tuong": "customerObjectName",
  "link hội thoại": "conversationLink",
  "link hoi thoai": "conversationLink",
};
const POSITIONAL_FIELDS: (keyof Omit<ImportRow, "id">)[] = [
  "rawLink",
  "customerName",
  "fanpageName",
  "adId",
  "customerObjectName",
  "conversationLink",
];

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; hyperlink?: unknown };
    if ("text" in v && v.text != null) return String(v.text).trim();
    if ("result" in v && v.result != null) return String(v.result).trim();
    if ("hyperlink" in v && v.hyperlink != null) return String(v.hyperlink).trim();
  }
  return String(value).trim();
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Liên hệ");
  sheet.addRow([...TEMPLATE_HEADERS]);
  sheet.addRow(["https://facebook.com/vidu.khach", "Nguyễn Văn A", "", "", "", ""]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 26));
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mau-nhap-lien-he.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

async function parseWorkbook(file: File): Promise<ImportRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const colToField = new Map<number, keyof Omit<ImportRow, "id">>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const normalized = cellText(cell.value).toLowerCase().trim();
    const field = HEADER_FIELD_MAP[normalized];
    if (field) colToField.set(colNumber, field);
  });
  // Không khớp tên cột nào -> coi cột 1..6 theo đúng thứ tự file mẫu.
  if (colToField.size === 0) {
    POSITIONAL_FIELDS.forEach((field, i) => colToField.set(i + 1, field));
  }

  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const draft: Partial<Record<keyof Omit<ImportRow, "id">, string>> = {};
    colToField.forEach((field, colNumber) => {
      draft[field] = cellText(row.getCell(colNumber).value);
    });
    const isBlank = Object.values(draft).every((v) => !v);
    if (isBlank) return;
    rows.push({
      id: makeId(),
      rawLink: draft.rawLink ?? "",
      customerName: draft.customerName ?? "",
      fanpageName: draft.fanpageName ?? "",
      adId: draft.adId ?? "",
      customerObjectName: draft.customerObjectName ?? "",
      conversationLink: draft.conversationLink ?? "",
    });
  });
  return rows;
}

function RowFanpageSelect({
  row,
  options,
  onChange,
}: {
  row: ImportRow;
  options: LeadFormOptions;
  onChange: (v: string) => void;
}) {
  const detectedSourceName = detectSourceName(row.rawLink, options.sourceDomains);
  const filtered = detectedSourceName ? options.fanpages.filter((f) => f.defaultSourceName === detectedSourceName) : options.fanpages;
  const list = filtered.length > 0 ? filtered : options.fanpages;
  return (
    <Select value={row.fanpageName} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger className={cn("h-9 w-full rounded-lg", !row.fanpageName && "border-destructive/50")}>
        <SelectValue placeholder="Chọn fanpage" />
      </SelectTrigger>
      <SelectContent>
        {list.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function LeadsImportView({
  options,
  branchLocked,
  lockedBranchCode,
  lockedBranchName,
}: {
  options: LeadFormOptions;
  branchLocked: boolean;
  lockedBranchCode: string | null;
  lockedBranchName: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [targetBranchCode, setTargetBranchCode] = useState(lockedBranchCode ?? options.branches[0]?.code ?? "");
  const [accepting, setAccepting] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Record<string, DuplicateConflict["duplicate"]>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const parsed = await parseWorkbook(file);
      setRows(parsed);
      setFileName(file.name);
      if (parsed.length === 0) {
        toast.error("Không đọc được dòng dữ liệu nào từ file này.");
      } else {
        toast.success(`Đã tải ${parsed.length} dòng từ "${file.name}".`);
      }
    } catch {
      toast.error("Không đọc được file — hãy chắc đây là file Excel (.xlsx) hợp lệ.");
    } finally {
      setParsing(false);
    }
  }

  function updateRow<K extends keyof ImportRow>(id: string, key: K, value: ImportRow[K]) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    // Sửa dòng nghĩa là người dùng đang xử lý cảnh báo cũ (trùng/lỗi) —
    // bỏ cảnh báo để tránh hiển thị thông tin không còn đúng với dữ liệu mới.
    setRowErrors((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setDuplicates((prev) => {
      if (!(id in prev)) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function reset() {
    setRows([]);
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const validRows = rows.filter((r) => r.rawLink.trim() && r.customerName.trim() && r.fanpageName.trim());
  const invalidCount = rows.length - validRows.length;

  function toPayload(row: ImportRow, duplicateReason?: string) {
    return {
      rawLink: row.rawLink,
      customerName: row.customerName,
      fanpageName: row.fanpageName,
      adId: row.adId || undefined,
      customerObjectName: row.customerObjectName,
      assignedBranchCode: targetBranchCode,
      conversationLink: row.conversationLink || undefined,
      duplicateConfirmed: duplicateReason ? true : undefined,
      duplicateReason,
    };
  }

  // Xử lý tuần tự (không Promise.all) — 2 dòng import trùng link với nhau vẫn
  // cần được đối chiếu nghi trùng với NHAU, không chỉ với dữ liệu đã có sẵn.
  async function handleAccept() {
    setAccepting(true);
    const targets = validRows;
    const nextErrors: Record<string, string> = {};
    const nextDuplicates: Record<string, DuplicateConflict["duplicate"]> = {};
    let successCount = 0;
    try {
      for (const row of targets) {
        try {
          const result = await createInteraction(toPayload(row));
          if ("status" in result && result.status === 409) {
            nextDuplicates[row.id] = result.duplicate;
          } else {
            successCount++;
          }
        } catch (err) {
          nextErrors[row.id] = err instanceof Error ? err.message : "Không tạo được liên hệ.";
        }
      }
      setRows((prev) => prev.filter((r) => !targets.some((t) => t.id === r.id) || nextErrors[r.id] || nextDuplicates[r.id]));
      setRowErrors(nextErrors);
      setDuplicates(nextDuplicates);

      const dupCount = Object.keys(nextDuplicates).length;
      const errCount = Object.keys(nextErrors).length;
      if (dupCount === 0 && errCount === 0) {
        toast.success(`Đã tạo ${successCount} liên hệ.`);
      } else {
        toast.error(
          `Đã tạo ${successCount}/${targets.length} liên hệ` +
            (dupCount > 0 ? ` — ${dupCount} dòng nghi trùng cần xác nhận` : "") +
            (errCount > 0 ? ` — ${errCount} dòng lỗi` : "") +
            "."
        );
      }
      if (successCount > 0) router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  async function handleConfirmDuplicate(row: ImportRow) {
    setConfirmingId(row.id);
    try {
      const result = await createInteraction(toPayload(row, "Nhập từ Excel, xác nhận vẫn tạo mới"));
      if ("status" in result && result.status === 409) {
        setDuplicates((prev) => ({ ...prev, [row.id]: result.duplicate }));
        toast.error("Vẫn còn nghi trùng — vui lòng kiểm tra lại dòng này.");
        return;
      }
      removeRow(row.id);
      setDuplicates((prev) => {
        const { [row.id]: _removed, ...rest } = prev;
        return rest;
      });
      toast.success(`Đã tạo liên hệ cho ${row.customerName}.`);
      router.refresh();
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [row.id]: err instanceof Error ? err.message : "Không tạo được liên hệ." }));
    } finally {
      setConfirmingId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={cn(
            "shadow-bubble flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-card p-14 text-center transition-colors",
            dragOver && "border-primary bg-primary/5"
          )}
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            {parsing ? <LoaderCircle className="size-6 animate-spin" /> : <FileSpreadsheet className="size-6" />}
          </span>
          <div>
            <p className="font-medium text-foreground">Kéo thả file Excel vào đây</p>
            <p className="text-sm text-muted-foreground">hoặc chọn file từ máy — hỗ trợ .xlsx</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" className="rounded-full" onClick={() => fileInputRef.current?.click()} disabled={parsing}>
              <Upload className="size-4" />
              Chọn file
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={downloadTemplate}>
              <Download className="size-4" />
              Tải file mẫu
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          File cần có các cột: {TEMPLATE_HEADERS.join(", ")}. Nếu tên cột không khớp, hệ thống sẽ đọc theo đúng thứ tự cột như file mẫu.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="shadow-bubble flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <FileSpreadsheet className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted-foreground">
              {rows.length} dòng ·{" "}
              <span className={validRows.length === rows.length ? "text-status-qualified" : "text-status-waiting"}>
                {validRows.length} hợp lệ
              </span>
              {invalidCount > 0 && <span className="text-destructive"> · {invalidCount} thiếu thông tin</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!branchLocked ? (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Cơ sở áp dụng</Label>
              <Select value={targetBranchCode} onValueChange={(v) => setTargetBranchCode(v ?? "")}>
                <SelectTrigger className="h-9 w-40 rounded-lg">
                  <SelectValue placeholder="Chọn cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  {options.branches.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground">Cơ sở: {lockedBranchName}</span>
          )}
          <Button type="button" variant="outline" className="rounded-full" onClick={reset}>
            Chọn file khác
          </Button>
        </div>
      </div>

      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 px-3" />
                <TableHead className="min-w-56 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Link khách hàng</TableHead>
                <TableHead className="min-w-40 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên khách</TableHead>
                <TableHead className="min-w-44 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Fanpage</TableHead>
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
                <TableHead className="min-w-36 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đối tượng</TableHead>
                <TableHead className="min-w-48 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Link hội thoại</TableHead>
                <TableHead className="w-10 pr-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isValid = row.rawLink.trim() && row.customerName.trim() && row.fanpageName.trim();
                const detectedSourceName = detectSourceName(row.rawLink, options.sourceDomains);
                const duplicate = duplicates[row.id];
                const rowError = rowErrors[row.id];
                return (
                  <Fragment key={row.id}>
                  <TableRow className="odd:bg-secondary/10 align-top">
                    <TableCell className="px-3 py-3">
                      {isValid ? (
                        <CheckCircle2 className="size-4 text-status-qualified" />
                      ) : (
                        <TriangleAlert className="size-4 text-status-waiting" />
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        value={row.rawLink}
                        onChange={(e) => updateRow(row.id, "rawLink", e.target.value)}
                        placeholder="https://facebook.com/..."
                        className={cn("h-9 rounded-lg", !row.rawLink.trim() && "border-destructive/50")}
                      />
                      {row.rawLink.trim() && (
                        <p className={cn("mt-1 text-[11px]", detectedSourceName ? "text-muted-foreground" : "text-destructive")}>
                          {detectedSourceName ? `Nguồn: ${detectedSourceName}` : "Chưa nhận diện được nguồn"}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        value={row.customerName}
                        onChange={(e) => updateRow(row.id, "customerName", e.target.value)}
                        className={cn("h-9 rounded-lg", !row.customerName.trim() && "border-destructive/50")}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <RowFanpageSelect row={row} options={options} onChange={(v) => updateRow(row.id, "fanpageName", v)} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input value={row.adId} onChange={(e) => updateRow(row.id, "adId", e.target.value)} className="h-9 rounded-lg" />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Select value={row.customerObjectName} onValueChange={(v) => updateRow(row.id, "customerObjectName", v ?? "")}>
                        <SelectTrigger className="h-9 w-full rounded-lg">
                          <SelectValue placeholder="Chọn đối tượng" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.objects.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        value={row.conversationLink}
                        onChange={(e) => updateRow(row.id, "conversationLink", e.target.value)}
                        className="h-9 rounded-lg"
                      />
                    </TableCell>
                    <TableCell className="pr-3 pl-1 py-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Xoá dòng"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {(duplicate || rowError) && (
                    <TableRow className="bg-secondary/20 hover:bg-secondary/20">
                      <TableCell />
                      <TableCell colSpan={7} className="px-3 py-3">
                        {duplicate ? (
                          <Alert variant="destructive" className="py-2">
                            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                              <span>
                                Nghi trùng với liên hệ <strong className="text-foreground">{duplicate.customerName}</strong> tạo lúc{" "}
                                {new Date(duplicate.createdLeadAt).toLocaleString("vi-VN")}
                                {duplicate.assignedSaleName ? ` (${duplicate.assignedSaleName})` : ""}. Vẫn muốn tạo mới?
                              </span>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="glossy shrink-0 rounded-full border-gold/40 bg-accent px-4 text-accent-foreground hover:bg-accent/80"
                                disabled={confirmingId === row.id}
                                onClick={() => handleConfirmDuplicate(row)}
                              >
                                {confirmingId === row.id && <LoaderCircle className="animate-spin" />}
                                Vẫn tạo liên hệ mới
                              </Button>
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <p className="text-xs text-destructive">{rowError}</p>
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
      </div>

      <div className="shadow-bubble flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Sẵn sàng lưu <strong className="font-mono text-foreground">{validRows.length}</strong>/{rows.length} liên hệ
          {invalidCount > 0 && " — các dòng thiếu Link/Tên khách/Fanpage sẽ không được lưu."}
        </p>
        <Button
          type="button"
          className="glossy shadow-bubble rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
          disabled={validRows.length === 0 || accepting}
          onClick={handleAccept}
        >
          {accepting && <LoaderCircle className="animate-spin" />}
          Accept — Lưu {validRows.length} liên hệ
        </Button>
      </div>
    </div>
  );
}
