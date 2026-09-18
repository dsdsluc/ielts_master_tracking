"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Gauge, ListChecks, Snowflake, UserX, Users, X } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { CopyButton } from "@/components/copy-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { StageBadge } from "@/app/(app)/customers/stage-badge";
import { reclaimCustomers as reclaimCustomersApi, transferCustomersBulk } from "@/app/(app)/customers/customers-api";
import type { CustomerListItem, SaleWorkload, WorkloadLevel } from "@/lib/customers/queries";

const LEVEL_META: Record<WorkloadLevel, { label: string; badgeClass: string }> = {
  overloaded: { label: "Quá tải", badgeClass: "bg-destructive/10 text-destructive" },
  balanced: { label: "Bình thường", badgeClass: "bg-secondary text-muted-foreground" },
  light: { label: "Đang rảnh", badgeClass: "bg-status-qualified-bg text-status-qualified" },
};

function LevelBadge({ level }: { level: WorkloadLevel | null }) {
  if (!level) {
    return <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Đã khoá</span>;
  }
  const meta = LEVEL_META[level];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.badgeClass}`}>{meta.label}</span>;
}

export function WorkloadBalanceView({
  workloads,
  selectedFrom,
  customers,
}: {
  workloads: SaleWorkload[];
  selectedFrom: string | null;
  customers: CustomerListItem[] | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetEmail, setTargetEmail] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reclaimConfirmOpen, setReclaimConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const overloadedCount = workloads.filter((w) => w.level === "overloaded").length;
  const lightCount = workloads.filter((w) => w.level === "light").length;
  const fromSale = workloads.find((w) => w.email === selectedFrom) ?? null;

  const visibleItems = useMemo(() => (customers ?? []).filter((c) => !resolvedKeys.has(c.customerKey)), [customers, resolvedKeys]);

  const destinationOptions = workloads.filter((w) => w.active && w.email !== selectedFrom);
  const destinationItems = Object.fromEntries(
    destinationOptions.map((w) => [w.email, `${w.fullName} — đang xử lý: ${w.openAssigned}${w.level ? ` (${LEVEL_META[w.level].label})` : ""}`])
  );

  function toggleOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === visibleItems.length ? new Set() : new Set(visibleItems.map((c) => c.customerKey))));
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setTargetEmail("");
  }

  function chooseSource(email: string) {
    setSelecting(false);
    setSelected(new Set());
    setTargetEmail("");
    router.push(`/customer-assignment/workload?from=${encodeURIComponent(email)}`);
  }

  async function handleTransfer() {
    if (!targetEmail) return;
    setPending(true);
    try {
      const customerKeys = [...selected];
      const { moved, skipped } = await transferCustomersBulk(customerKeys, targetEmail);
      toast.success(
        skipped > 0 ? `Đã chuyển ${moved}/${customerKeys.length} khách hàng — bỏ qua ${skipped}.` : `Đã chuyển ${moved} khách hàng.`
      );
      setResolvedKeys((prev) => {
        const next = new Set(prev);
        customerKeys.forEach((k) => next.add(k));
        return next;
      });
      stopSelecting();
      setConfirmOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không điều chuyển được.");
    } finally {
      setPending(false);
    }
  }

  async function handleReclaimOnly() {
    setPending(true);
    try {
      const customerKeys = [...selected];
      const { reclaimed, skipped } = await reclaimCustomersApi(customerKeys);
      toast.success(
        skipped > 0 ? `Đã rút ${reclaimed}/${customerKeys.length} khách hàng — bỏ qua ${skipped}.` : `Đã rút ${reclaimed} khách hàng, chờ phân bổ lại.`
      );
      setResolvedKeys((prev) => {
        const next = new Set(prev);
        customerKeys.forEach((k) => next.add(k));
        return next;
      });
      stopSelecting();
      setReclaimConfirmOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không rút được.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label="Sale đang quá tải" value={overloadedCount} accentClassName={overloadedCount > 0 ? "bg-destructive" : "bg-status-qualified"} />
        <KpiCard label="Sale đang rảnh" value={lightCount} accentClassName="bg-status-qualified" />
        <KpiCard label="Tổng Sale có khách" value={workloads.length} accentClassName="bg-foreground/50" />
      </div>

      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="border-b border-border/70 px-5 py-3.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Gauge className="size-4 text-muted-foreground" /> Khối lượng công việc theo Sale
          </h3>
          <p className="text-xs text-muted-foreground">
            &quot;Đang xử lý&quot; = khách hàng đang phụ trách mà chưa dừng ở Đã chốt/Không quan tâm — kể cả chưa gọi lần nào. Bấm 1 dòng để chọn Sale
            nguồn cần rút bớt/thu hồi khách hàng.
          </p>
        </div>
        {workloads.length === 0 ? (
          <EmptyState icon={Users} title="Chưa có Sale nào đang phụ trách khách hàng" description="Khối lượng công việc sẽ xuất hiện khi có khách hàng được phân bổ." />
        ) : (
          <Table>
            <TableHeader className="bg-secondary/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đang xử lý</TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">
                  Tổng phụ trách
                </TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">
                  Cần hỗ trợ
                </TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">
                  Quá hạn
                </TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Mức tải</TableHead>
                <TableHead className="w-32 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {workloads.map((w) => (
                <TableRow key={w.email} className={`odd:bg-secondary/10 ${w.email === selectedFrom ? "bg-accent/30" : ""}`}>
                  <TableCell className="min-w-40 px-5 py-3">
                    <p className="truncate font-medium text-foreground" title={w.fullName}>
                      {w.fullName}
                      {!w.active && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(đã khoá)</span>}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground" title={w.email}>
                      {w.email}
                    </p>
                  </TableCell>
                  <TableCell className="px-4 text-center font-mono text-sm text-foreground">
                    <span className="inline-flex items-center gap-1">
                      {w.level === "overloaded" && <Flame className="size-3.5 text-destructive" />}
                      {w.level === "light" && <Snowflake className="size-3.5 text-status-qualified" />}
                      {w.openAssigned}
                    </span>
                  </TableCell>
                  <TableCell className="hidden px-4 text-center font-mono text-sm text-muted-foreground sm:table-cell">{w.totalAssigned}</TableCell>
                  <TableCell className="hidden px-4 text-center font-mono text-sm lg:table-cell">
                    {w.needsSupport > 0 ? <span className="text-destructive">{w.needsSupport}</span> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="hidden px-4 text-center font-mono text-sm lg:table-cell">
                    {w.overdue > 0 ? <span className="text-destructive">{w.overdue}</span> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell className="px-4">
                    <LevelBadge level={w.level} />
                  </TableCell>
                  <TableCell className="py-3 pr-5 pl-1 text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant={w.email === selectedFrom ? "secondary" : "outline"}
                      className="rounded-full"
                      onClick={() => chooseSource(w.email)}
                    >
                      {w.email === selectedFrom ? "Đang chọn" : "Chọn nguồn"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {selectedFrom && fromSale && customers && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              Khách hàng của <strong>{fromSale.fullName}</strong> —{" "}
              <span className="font-mono text-muted-foreground">{visibleItems.length}</span> đang phụ trách
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full text-muted-foreground"
              onClick={() => router.push("/customer-assignment/workload")}
            >
              <X className="size-3.5" /> Đóng
            </Button>
          </div>

          {visibleItems.length === 0 ? (
            <EmptyState icon={Users} title="Sale này không còn khách hàng nào" description="Mọi khách hàng đã được điều chuyển hoặc chưa từng được phân bổ." />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                {selecting ? (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong>
                    </p>
                    <Select value={targetEmail} onValueChange={(v) => setTargetEmail(v ?? "")} items={destinationItems}>
                      <SelectTrigger className="h-9 min-w-64 flex-1 rounded-full bg-background sm:flex-none">
                        <SelectValue placeholder="Chuyển đến Sale…" />
                      </SelectTrigger>
                      <SelectContent>
                        {destinationOptions.map((w) => (
                          <SelectItem key={w.email} value={w.email}>
                            {w.fullName} — đang xử lý: {w.openAssigned}
                            {w.level ? ` (${LEVEL_META[w.level].label})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      className="glossy rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
                      disabled={selected.size === 0 || !targetEmail}
                      onClick={() => setConfirmOpen(true)}
                    >
                      <ArrowRight className="size-3.5" /> Chuyển ngay ({selected.size})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
                      disabled={selected.size === 0}
                      onClick={() => setReclaimConfirmOpen(true)}
                    >
                      <UserX className="size-3.5" /> Chỉ rút, chưa gán ngay
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={stopSelecting}>
                      Huỷ
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={() => setSelecting(true)}>
                    <ListChecks className="size-3.5" />
                    Chọn khách hàng để điều chuyển
                  </Button>
                )}
              </div>

              <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
                <Table>
                  <TableHeader className="bg-secondary/60">
                    <TableRow className="hover:bg-transparent">
                      {selecting && (
                        <TableHead className="w-10 pl-5">
                          <Checkbox checked={selected.size === visibleItems.length} onCheckedChange={toggleAll} aria-label="Chọn tất cả" />
                        </TableHead>
                      )}
                      <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                      <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">SĐT</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Mốc hiện tại</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleItems.map((item) => {
                      const checked = selected.has(item.customerKey);
                      return (
                        <TableRow
                          key={item.customerKey}
                          className={`odd:bg-secondary/10 align-top ${selecting ? "cursor-pointer" : ""} ${checked ? "bg-accent/30" : ""}`}
                          onClick={selecting ? () => toggleOne(item.customerKey) : undefined}
                        >
                          {selecting && (
                            <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                              <Checkbox checked={checked} onCheckedChange={() => toggleOne(item.customerKey)} aria-label={`Chọn ${item.displayName}`} />
                            </TableCell>
                          )}
                          <TableCell className="min-w-40 px-5 py-3.5">
                            <p className="max-w-56 truncate font-medium text-foreground" title={item.displayName}>
                              {item.displayName}
                            </p>
                          </TableCell>
                          <TableCell className="hidden px-4 py-3.5 text-sm sm:table-cell" onClick={(e) => e.stopPropagation()}>
                            {item.phoneNormalized ? (
                              <span className="flex items-center gap-1.5 font-mono text-foreground">
                                {item.phoneNormalized}
                                <CopyButton value={item.phoneNormalized} label="Đã copy số điện thoại" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Chưa có</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <StageBadge stage={item.stage} assigned />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chuyển {selected.size} khách hàng?</AlertDialogTitle>
            <AlertDialogDescription>
              Khách hàng sẽ được điều chuyển thẳng sang Sale mới, xuất hiện ngay trong Workspace của họ — không cần qua bước phân bổ lại riêng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" className="rounded-full" disabled={pending} />}>Huỷ</AlertDialogClose>
            <Button type="button" className="glossy rounded-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending} onClick={handleTransfer}>
              Chuyển ngay ({selected.size})
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={reclaimConfirmOpen} onOpenChange={setReclaimConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rút {selected.size} khách hàng, chưa gán ngay?</AlertDialogTitle>
            <AlertDialogDescription>
              Khách hàng sẽ chuyển về trạng thái chưa có ai phụ trách — dùng khi chưa quyết định giao cho Sale nào. Nếu đã biết rõ người thay thế, hãy chọn
              &quot;Chuyển ngay&quot; ở trên thay vì rút riêng.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button type="button" variant="outline" className="rounded-full" disabled={pending} />}>Huỷ</AlertDialogClose>
            <Button type="button" className="rounded-full bg-destructive text-white hover:bg-destructive/90" disabled={pending} onClick={handleReclaimOnly}>
              Rút ({selected.size})
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
