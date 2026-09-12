"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UserRoundPlus, X } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { FormMessage } from "@/components/form-message";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage } from "@/lib/api-client";
import { assignStudentsBulk } from "@/app/(app)/student-assignment/actions";

type AssignableLead = {
  interactionId: string;
  customerName: string;
  phone: string;
  branchName: string;
  sourceName: string;
  fanpageName: string;
  receivedAt: string | null;
};

type SaleOption = { email: string; fullName: string };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AssignableLeadsTable({ leads, sales }: { leads: AssignableLead[]; sales: SaleOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<AssignableLead[] | null>(null);
  const [saleEmail, setSaleEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.interactionId));

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Chọn tất cả" chỉ áp dụng cho các dòng đang hiển thị trên trang này.
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const l of leads) next.delete(l.interactionId);
      } else {
        for (const l of leads) next.add(l.interactionId);
      }
      return next;
    });
  }

  function openDialog(picked: AssignableLead[]) {
    setTargets(picked);
    setSaleEmail("");
    setError(null);
  }

  async function handleAssign() {
    if (!targets || !saleEmail) return;
    setPending(true);
    setError(null);
    try {
      const result = await assignStudentsBulk({
        interactionIds: targets.map((t) => t.interactionId),
        assignedToEmail: saleEmail,
      });
      if (result.skipped.length > 0) {
        toast.info(`Đã phân bổ ${result.assigned.length} liên hệ — bỏ qua ${result.skipped.length} (đã được phân bổ trước đó).`);
      } else {
        toast.success(`Đã phân bổ ${result.assigned.length} liên hệ.`);
      }
      setTargets(null);
      stopSelecting();
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-card px-5 py-3">
          {selecting ? (
            <>
              <p className="text-xs text-muted-foreground">
                Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong> liên hệ
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={stopSelecting}>
                  <X className="size-3" /> Huỷ chọn
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="glossy h-7 rounded-full bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                  disabled={selected.size === 0}
                  onClick={() => openDialog(leads.filter((l) => selected.has(l.interactionId)))}
                >
                  <UserRoundPlus className="size-3" />
                  Phân bổ đã chọn ({selected.size})
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                <strong className="font-mono text-foreground">{leads.length}</strong> liên hệ chờ phân bổ
              </p>
              <Button type="button" variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setSelecting(true)}>
                Chọn nhiều
              </Button>
            </>
          )}
        </div>
        <Table className="sm:min-w-[760px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              {selecting && (
                <TableHead className="w-10 pl-5">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Chọn tất cả đang hiển thị" />
                </TableHead>
              )}
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">SĐT</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Nguồn / Fanpage</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Cơ sở</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Ngày có SĐT</TableHead>
              <TableHead className="w-40 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const checked = selected.has(lead.interactionId);
              return (
                <TableRow
                  key={lead.interactionId}
                  className={`odd:bg-secondary/10 ${selecting ? "cursor-pointer" : ""} ${checked ? "bg-accent/30" : ""}`}
                  onClick={() => selecting && toggleOne(lead.interactionId)}
                >
                  {selecting && (
                    <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleOne(lead.interactionId)} aria-label="Chọn dòng này" />
                    </TableCell>
                  )}
                  <TableCell className="min-w-48 px-5 py-4">
                    <p className="max-w-56 truncate font-medium text-foreground">{lead.customerName}</p>
                  </TableCell>
                  <TableCell className="hidden px-4 font-mono text-xs text-muted-foreground sm:table-cell">{lead.phone}</TableCell>
                  <TableCell className="hidden px-4 text-muted-foreground md:table-cell">
                    <p className="max-w-48 truncate font-medium text-foreground/80">{lead.fanpageName}</p>
                    <p className="mt-0.5 max-w-48 truncate text-xs">{lead.sourceName}</p>
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{lead.branchName}</TableCell>
                  <TableCell className="hidden px-4 text-xs text-muted-foreground xl:table-cell">{formatDate(lead.receivedAt)}</TableCell>
                  <TableCell className="pr-4 pl-1 text-right" onClick={(e) => e.stopPropagation()}>
                    {!selecting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-full border-status-received/30 px-2.5 text-xs text-status-received hover:bg-status-received-bg hover:text-status-received"
                        onClick={() => openDialog([lead])}
                      >
                        <UserRoundPlus className="size-3" />
                        Phân bổ
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!targets} onOpenChange={(next) => !next && setTargets(null)}>
        <DialogContent className="shadow-bubble rounded-3xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Phân bổ học viên</DialogTitle>
          </DialogHeader>

          {targets && (
            <div className="flex flex-col gap-4">
              {targets.length === 1 ? (
                <p className="text-sm text-muted-foreground">
                  Phân bổ <strong className="text-foreground">{targets[0].customerName}</strong> ({targets[0].phone}) cho ai?
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Phân bổ <strong className="font-mono text-foreground">{targets.length}</strong> liên hệ đã chọn cho ai?
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                <Label>Người phụ trách</Label>
                <Select value={saleEmail} onValueChange={(v) => setSaleEmail(v ?? "")}>
                  <SelectTrigger className="h-11 w-full rounded-xl bg-background">
                    <SelectValue placeholder="Chọn Sale (hoặc chính bạn)" />
                  </SelectTrigger>
                  <SelectContent>
                    {sales.map((s) => (
                      <SelectItem key={s.email} value={s.email}>
                        {s.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <FormMessage kind="error">{error}</FormMessage>}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setTargets(null)} disabled={pending}>
              Huỷ
            </Button>
            <Button
              type="button"
              className="glossy shadow-bubble rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90"
              disabled={pending || !saleEmail}
              onClick={handleAssign}
            >
              {pending && <LoaderCircle className="animate-spin" />}
              Phân bổ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
