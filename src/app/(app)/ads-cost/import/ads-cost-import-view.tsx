"use client";

import { useRef, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { createAdsCost } from "@/app/(app)/ads-cost/actions";
import { cn } from "@/lib/utils";

type ImportRow = {
  id: string;
  adId: string;
  adName: string;
  sourceName: string;
  fanpageName: string;
  branchCode: string;
  periodStart: string;
  periodEnd: string;
  costVnd: string;
  note: string;
};

type FieldKey = keyof Omit<ImportRow, "id">;

const TEMPLATE_HEADERS = [
  "Ad ID",
  "Tên quảng cáo",
  "Nguồn",
  "Fanpage",
  "Cơ sở",
  "Bắt đầu kỳ",
  "Kết thúc kỳ",
  "Chi phí (VND)",
  "Ghi chú",
] as const;

// Khớp tên cột linh hoạt (thường/hoa, khoảng trắng thừa) — nếu file không khớp
// tên cột nào cả thì rơi về đúng thứ tự cột như file mẫu.
const HEADER_FIELD_MAP: Record<string, FieldKey> = {
  "ad id": "adId",
  adid: "adId",
  "tên quảng cáo": "adName",
  "ten quang cao": "adName",
  "tên chiến dịch": "adName",
  "ten chien dich": "adName",
  "nguồn": "sourceName",
  nguon: "sourceName",
  fanpage: "fanpageName",
  "cơ sở": "branchCode",
  "co so": "branchCode",
  "bắt đầu kỳ": "periodStart",
  "bat dau ky": "periodStart",
  "ngày bắt đầu": "periodStart",
  "ngay bat dau": "periodStart",
  "kết thúc kỳ": "periodEnd",
  "ket thuc ky": "periodEnd",
  "ngày kết thúc": "periodEnd",
  "ngay ket thuc": "periodEnd",
  "chi phí (vnd)": "costVnd",
  "chi phi (vnd)": "costVnd",
  "chi phí": "costVnd",
  "chi phi": "costVnd",
  "ghi chú": "note",
  "ghi chu": "note",
};
const POSITIONAL_FIELDS: FieldKey[] = [
  "adId",
  "adName",
  "sourceName",
  "fanpageName",
  "branchCode",
  "periodStart",
  "periodEnd",
  "costVnd",
  "note",
];

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !(value instanceof Date)) {
    const v = value as { text?: unknown; result?: unknown; hyperlink?: unknown };
    if ("text" in v && v.text != null) return String(v.text).trim();
    if ("result" in v && v.result != null) return String(v.result).trim();
    if ("hyperlink" in v && v.hyperlink != null) return String(v.hyperlink).trim();
  }
  return String(value).trim();
}

function toDateInputValue(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = cellText(value);
  if (!text) return "";
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return "";
}

function toNumberText(value: unknown): string {
  const text = cellText(value);
  if (!text) return "";
  const cleaned = text.replace(/[^\d.-]/g, "");
  return cleaned;
}

function matchByName(text: string, names: string[]): string {
  if (!text) return "";
  const found = names.find((n) => n.toLowerCase() === text.toLowerCase());
  return found ?? "";
}

function matchBranchCode(text: string, branches: { code: string; name: string }[]): string {
  if (!text) return "";
  const byName = branches.find((b) => b.name.toLowerCase() === text.toLowerCase());
  if (byName) return byName.code;
  const byCode = branches.find((b) => b.code.toLowerCase() === text.toLowerCase());
  return byCode?.code ?? "";
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

async function downloadTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Chi phí quảng cáo");
  sheet.addRow([...TEMPLATE_HEADERS]);
  sheet.addRow(["12345678", "Quảng cáo Mùa hè", "Facebook", "", "", "2026-01-01", "2026-01-31", "1500000", ""]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((c) => (c.width = 22));
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mau-nhap-chi-phi-quang-cao.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

async function parseWorkbook(
  file: File,
  refs: { sourceOptions: string[]; fanpageOptions: { name: string; defaultSourceName: string }[]; branchOptions: { code: string; name: string }[] }
): Promise<ImportRow[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const colToField = new Map<number, FieldKey>();
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const normalized = cellText(cell.value).toLowerCase().trim();
    const field = HEADER_FIELD_MAP[normalized];
    if (field) colToField.set(colNumber, field);
  });
  // Không khớp tên cột nào -> coi cột 1..9 theo đúng thứ tự file mẫu.
  if (colToField.size === 0) {
    POSITIONAL_FIELDS.forEach((field, i) => colToField.set(i + 1, field));
  }

  const fanpageNames = refs.fanpageOptions.map((f) => f.name);
  const rows: ImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const draft: Partial<Record<FieldKey, string>> = {};
    colToField.forEach((field, colNumber) => {
      const raw = row.getCell(colNumber).value;
      if (field === "periodStart" || field === "periodEnd") {
        draft[field] = toDateInputValue(raw);
      } else if (field === "costVnd") {
        draft[field] = toNumberText(raw);
      } else {
        draft[field] = cellText(raw);
      }
    });
    const isBlank = Object.values(draft).every((v) => !v);
    if (isBlank) return;
    rows.push({
      id: makeId(),
      adId: draft.adId ?? "",
      adName: draft.adName ?? "",
      sourceName: matchByName(draft.sourceName ?? "", refs.sourceOptions),
      fanpageName: matchByName(draft.fanpageName ?? "", fanpageNames),
      branchCode: matchBranchCode(draft.branchCode ?? "", refs.branchOptions),
      periodStart: draft.periodStart ?? "",
      periodEnd: draft.periodEnd ?? "",
      costVnd: draft.costVnd ?? "",
      note: draft.note ?? "",
    });
  });
  return rows;
}

function isValid(row: ImportRow) {
  return !!(
    row.adId.trim() &&
    row.adName.trim() &&
    row.costVnd.trim() &&
    row.periodStart &&
    row.periodEnd &&
    row.periodEnd >= row.periodStart
  );
}

export function AdsCostImportView({
  sourceOptions,
  fanpageOptions,
  branchOptions,
}: {
  sourceOptions: string[];
  fanpageOptions: { name: string; defaultSourceName: string }[];
  branchOptions: { code: string; name: string }[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  async function handleFile(file: File) {
    setParsing(true);
    try {
      const parsed = await parseWorkbook(file, { sourceOptions, fanpageOptions, branchOptions });
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
    setRowErrors((prev) => {
      if (!prev[id]) return prev;
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

  const validRows = rows.filter(isValid);
  const invalidCount = rows.length - validRows.length;

  async function handleAccept() {
    setAccepting(true);
    const targets = validRows;
    const nextErrors: Record<string, string> = {};
    try {
      for (const row of targets) {
        try {
          await createAdsCost({
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            adId: row.adId,
            adName: row.adName,
            sourceName: row.sourceName,
            fanpageName: row.fanpageName,
            branchCode: row.branchCode,
            costVnd: row.costVnd,
            note: row.note,
          });
        } catch (err) {
          nextErrors[row.id] = err instanceof Error ? err.message : "Không lưu được.";
        }
      }
      const successCount = targets.length - Object.keys(nextErrors).length;
      setRows((prev) => prev.filter((r) => !targets.some((t) => t.id === r.id) || nextErrors[r.id]));
      setRowErrors(nextErrors);
      if (Object.keys(nextErrors).length === 0) {
        toast.success(`Đã lưu ${successCount} dòng chi phí quảng cáo.`);
      } else {
        toast.error(`Đã lưu ${successCount}/${targets.length} dòng — ${Object.keys(nextErrors).length} dòng lỗi, vẫn giữ lại để bạn sửa.`);
      }
      router.refresh();
    } finally {
      setAccepting(false);
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
        <Button type="button" variant="outline" className="rounded-full" onClick={reset}>
          Chọn file khác
        </Button>
      </div>

      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[1280px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 px-3" />
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ad ID</TableHead>
                <TableHead className="min-w-48 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tên quảng cáo</TableHead>
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Nguồn</TableHead>
                <TableHead className="min-w-44 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Fanpage</TableHead>
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                <TableHead className="min-w-56 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Kỳ báo cáo</TableHead>
                <TableHead className="min-w-32 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chi phí (VND)</TableHead>
                <TableHead className="min-w-40 px-3 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ghi chú</TableHead>
                <TableHead className="w-10 pr-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const valid = isValid(row);
                const filteredFanpages = row.sourceName
                  ? fanpageOptions.filter((f) => f.defaultSourceName === row.sourceName)
                  : fanpageOptions;
                const fanpageList = filteredFanpages.length > 0 ? filteredFanpages : fanpageOptions;
                return (
                  <TableRow key={row.id} className="odd:bg-secondary/10 align-top">
                    <TableCell className="px-3 py-3">
                      {valid ? (
                        <CheckCircle2 className="size-4 text-status-qualified" />
                      ) : (
                        <TriangleAlert className="size-4 text-status-waiting" />
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        value={row.adId}
                        onChange={(e) => updateRow(row.id, "adId", e.target.value)}
                        className={cn("h-9 rounded-lg", !row.adId.trim() && "border-destructive/50")}
                      />
                      {rowErrors[row.id] && <p className="mt-1 text-[11px] text-destructive">{rowErrors[row.id]}</p>}
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        value={row.adName}
                        onChange={(e) => updateRow(row.id, "adName", e.target.value)}
                        placeholder="Tên chiến dịch/quảng cáo"
                        className={cn("h-9 rounded-lg", !row.adName.trim() && "border-destructive/50")}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Select value={row.sourceName} onValueChange={(v) => updateRow(row.id, "sourceName", v ?? "")}>
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
                      <Select value={row.fanpageName} onValueChange={(v) => updateRow(row.id, "fanpageName", v ?? "")}>
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
                      <Select value={row.branchCode} onValueChange={(v) => updateRow(row.id, "branchCode", v ?? "")}>
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
                          onChange={(e) => updateRow(row.id, "periodStart", e.target.value)}
                          className={cn("h-9 rounded-lg", !row.periodStart && "border-destructive/50")}
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input
                          type="date"
                          value={row.periodEnd}
                          onChange={(e) => updateRow(row.id, "periodEnd", e.target.value)}
                          className={cn("h-9 rounded-lg", !row.periodEnd && "border-destructive/50")}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input
                        type="number"
                        min={0}
                        step="1000"
                        value={row.costVnd}
                        onChange={(e) => updateRow(row.id, "costVnd", e.target.value)}
                        placeholder="0"
                        className={cn("h-9 rounded-lg", !row.costVnd.trim() && "border-destructive/50")}
                      />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <Input value={row.note} onChange={(e) => updateRow(row.id, "note", e.target.value)} className="h-9 rounded-lg" />
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="shadow-bubble flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Sẵn sàng lưu <strong className="font-mono text-foreground">{validRows.length}</strong>/{rows.length} dòng
          {invalidCount > 0 && " — các dòng thiếu Ad ID/Tên quảng cáo/Chi phí/Kỳ báo cáo sẽ không được lưu."}
        </p>
        <Button
          type="button"
          className="glossy shadow-bubble rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90"
          disabled={validRows.length === 0 || accepting}
          onClick={handleAccept}
        >
          {accepting && <LoaderCircle className="animate-spin" />}
          Accept — Lưu {validRows.length} dòng
        </Button>
      </div>
    </div>
  );
}
