"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/empty-state";
import { CopyButton } from "@/components/copy-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { useToast } from "@/hooks/use-toast";
import { assignCustomers as assignCustomersApi } from "@/app/(app)/customers/customers-api";
import type { AssignableCustomer } from "@/lib/customers/queries";
import type { AssignableSale } from "@/app/(app)/leads/leads-api";
import { AssignCustomerDialog } from "@/app/(app)/customer-assignment/assign-customer-dialog";

export function AssignableCustomersView({ customers }: { customers: AssignableCustomer[]; sales: AssignableSale[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [singleTarget, setSingleTarget] = useState<AssignableCustomer | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const visibleItems = useMemo(() => customers.filter((c) => !resolvedKeys.has(c.customerKey)), [customers, resolvedKeys]);

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
  }

  async function assign(customerKeys: string[], targetEmail: string) {
    const { assigned, skipped } = await assignCustomersApi(customerKeys, targetEmail);
    toast.success(
      skipped > 0
        ? `Đã phân bổ ${assigned}/${customerKeys.length} khách hàng — bỏ qua ${skipped} (đã được phân bổ trước đó).`
        : `Đã phân bổ ${assigned} khách hàng.`
    );
    setResolvedKeys((prev) => {
      const next = new Set(prev);
      customerKeys.forEach((k) => next.add(k));
      return next;
    });
    router.refresh();
  }

  async function handleAssignSingle(targetEmail: string) {
    if (!singleTarget) return;
    await assign([singleTarget.customerKey], targetEmail);
    setSingleTarget(null);
  }

  async function handleAssignBulk(targetEmail: string) {
    await assign([...selected], targetEmail);
    stopSelecting();
  }

  if (visibleItems.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Mọi khách hàng Đủ tiêu chuẩn hiện có đều đã được phân bổ"
        description="Khách hàng mới trở nên Đủ tiêu chuẩn sẽ xuất hiện ở đây để phân bổ."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          <strong className="font-mono text-foreground">{visibleItems.length}</strong> khách hàng chờ phân bổ
        </p>
        {selecting ? (
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Đã chọn <strong className="font-mono text-foreground">{selected.size}</strong>
            </p>
            <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={stopSelecting}>
              <X className="size-3.5" /> Huỷ
            </Button>
            <Button
              type="button"
              size="sm"
              className="glossy rounded-full bg-primary px-4 text-primary-foreground hover:bg-primary/90"
              disabled={selected.size === 0}
              onClick={() => setBulkDialogOpen(true)}
            >
              Phân bổ ({selected.size})
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" onClick={() => setSelecting(true)}>
            <ListChecks className="size-3.5" />
            Chọn để phân bổ hàng loạt
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
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Lần chạm đầu</TableHead>
              <TableHead className="w-40 pr-5" />
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
                  <TableCell className="hidden px-4 py-3.5 text-xs text-muted-foreground lg:table-cell">{formatDateTime(item.firstTouchAt)}</TableCell>
                  <TableCell className="py-3.5 pr-5 pl-1 text-right" onClick={(e) => e.stopPropagation()}>
                    {!selecting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full border-status-received/30 text-status-received hover:bg-status-received-bg hover:text-status-received"
                        onClick={() => setSingleTarget(item)}
                      >
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

      <AssignCustomerDialog open={!!singleTarget} onOpenChange={(open) => !open && setSingleTarget(null)} selectedCount={1} onConfirm={handleAssignSingle} />
      <AssignCustomerDialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen} selectedCount={selected.size} onConfirm={handleAssignBulk} />
    </div>
  );
}
