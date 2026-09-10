"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, CircleAlert, Inbox, ListChecks, LoaderCircle, MessageCircleMore, Plus, Search, Sparkles, Unlock, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { LeadDetailSheet } from "@/app/(app)/leads/lead-detail-sheet";
import type { InteractionListItem } from "@/app/(app)/leads/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WorkspaceTable({
  items,
  onOpen,
  actionIcon,
  actionLabel,
  actionClassName,
  onAction,
  selecting = false,
  selected,
  onToggleOne,
  onToggleAll,
  pendingIds,
}: {
  items: InteractionListItem[];
  onOpen: (id: string) => void;
  actionIcon: ReactNode;
  actionLabel: string;
  actionClassName: string;
  onAction: (item: InteractionListItem) => void;
  selecting?: boolean;
  selected?: Set<string>;
  onToggleOne?: (id: string) => void;
  onToggleAll?: () => void;
  pendingIds?: Set<string>;
}) {
  const allSelected = selecting && items.length > 0 && items.every((item) => selected?.has(item.interactionId));

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <Table className="sm:min-w-[760px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              {selecting && (
                <TableHead className="w-10 pl-5">
                  <Checkbox checked={allSelected} onCheckedChange={onToggleAll} aria-label="Chọn tất cả đang hiển thị" />
                </TableHead>
              )}
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Nguồn / Fanpage</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Chăm sóc</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Ngày tạo</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
              <TableHead className="w-36 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const checked = selected?.has(item.interactionId) ?? false;
              return (
                <TableRow
                  key={item.interactionId}
                  className={cn(
                    "group cursor-pointer odd:bg-secondary/10",
                    selecting ? "hover:bg-accent/20" : "hover:bg-status-received-bg/45",
                    checked && "bg-accent/30"
                  )}
                  onClick={() => (selecting ? onToggleOne?.(item.interactionId) : onOpen(item.interactionId))}
                >
                  {selecting && (
                    <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={checked} onCheckedChange={() => onToggleOne?.(item.interactionId)} aria-label="Chọn dòng này" />
                    </TableCell>
                  )}
                  <TableCell className="min-w-56 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received transition-colors group-hover:bg-status-received group-hover:text-white">
                        <MessageCircleMore className="size-3.5" />
                      </span>
                      <span className="truncate font-medium text-foreground">{item.customerName}</span>
                      {item.needsFollowup && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full border border-gold/30 bg-accent px-2 py-0.5 font-condensed text-[9px] font-semibold tracking-wide text-accent-foreground uppercase">
                          <Sparkles className="size-3" /> Cần chăm sóc lại
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-56 px-4 text-muted-foreground sm:table-cell">
                    <p className="truncate font-medium text-foreground/80">{item.fanpageName}</p>
                    <p className="mt-0.5 truncate text-xs">{item.sourceName}</p>
                  </TableCell>
                  <TableCell className="hidden px-4 font-mono text-xs text-muted-foreground md:table-cell">{item.touchCount} lần</TableCell>
                  <TableCell className="hidden px-4 text-xs text-muted-foreground xl:table-cell">{formatDate(item.createdLeadAt)}</TableCell>
                  <TableCell className="px-4">
                    <StatusPill status={item.status} />
                  </TableCell>
                  <TableCell className="pr-4 pl-1 text-right" onClick={(e) => e.stopPropagation()}>
                    {!selecting && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={actionClassName}
                        disabled={pendingIds?.has(item.interactionId)}
                        onClick={() => onAction(item)}
                      >
                        {pendingIds?.has(item.interactionId) ? <LoaderCircle className="size-3.5 animate-spin" /> : actionIcon}
                        {actionLabel}
                      </Button>
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

export function WorkspaceView({
  items,
  initialWorkspace,
}: {
  items: InteractionListItem[];
  initialWorkspace: InteractionListItem[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [available, setAvailable] = useState<InteractionListItem[]>(items);
  const [workspace, setWorkspace] = useState<InteractionListItem[]>(initialWorkspace);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectingAvailable, setSelectingAvailable] = useState(false);
  const [selectedAvailable, setSelectedAvailable] = useState<Set<string>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [notice, setNotice] = useState<{ title: string; description: string } | null>(null);

  // Đồng bộ lại theo dữ liệu thật mỗi khi router.refresh() làm page.tsx chạy
  // lại (sau khi thêm/giải phóng, hoặc do sửa liên hệ trong panel chi tiết) —
  // useState chỉ nhận initial value ở lần mount đầu nên cần effect để cập nhật.
  useEffect(() => setAvailable(items), [items]);
  useEffect(() => setWorkspace(initialWorkspace), [initialWorkspace]);

  const filteredAvailable = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    if (!needle) return available;
    return available.filter((item) =>
      [item.customerName, item.fanpageName, item.sourceName].some((v) => v?.toLocaleLowerCase("vi").includes(needle))
    );
  }, [available, search]);

  function markPending(id: string, pending: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function addToWorkspace(item: InteractionListItem) {
    markPending(item.interactionId, true);
    try {
      const res = await fetch("/api/workspace/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionIds: [item.interactionId] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      // Dù thành công hay bị Sale khác giành mất, liên hệ này không còn khả
      // dụng nữa — luôn bỏ khỏi danh sách "Liên hệ khả dụng".
      setAvailable((prev) => prev.filter((r) => r.interactionId !== item.interactionId));
      if (body.conflicts?.length > 0) {
        setNotice({
          title: "Chậm một chút rồi!",
          description: `${item.customerName} vừa được một Sale khác thêm vào Workspace của họ trước bạn. Liên hệ này đã được gỡ khỏi danh sách khả dụng — hãy chọn một liên hệ khác.`,
        });
      } else {
        setWorkspace((prev) => [item, ...prev]);
        toast.success(`Đã thêm ${item.customerName} vào Workspace.`);
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thêm được liên hệ này.");
    } finally {
      markPending(item.interactionId, false);
    }
  }

  async function releaseFromWorkspace(item: InteractionListItem) {
    markPending(item.interactionId, true);
    try {
      const res = await fetch("/api/workspace/release", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionId: item.interactionId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      setWorkspace((prev) => prev.filter((r) => r.interactionId !== item.interactionId));
      setAvailable((prev) => [item, ...prev]);
      toast.success(`Đã giải phóng ${item.customerName} khỏi Workspace — Sale khác có thể thêm liên hệ này.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không giải phóng được liên hệ này.");
    } finally {
      markPending(item.interactionId, false);
    }
  }

  function stopSelectingAvailable() {
    setSelectingAvailable(false);
    setSelectedAvailable(new Set());
  }

  function toggleOneAvailable(id: string) {
    setSelectedAvailable((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "Chọn tất cả" chỉ áp dụng cho các dòng đang hiển thị (đã qua tìm kiếm) —
  // giống cơ chế chọn theo trang ở System Log/Chi phí quảng cáo.
  function toggleAllAvailable() {
    setSelectedAvailable((prev) => {
      const ids = filteredAvailable.map((item) => item.interactionId);
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  async function addSelectedToWorkspace() {
    const ids = [...selectedAvailable];
    if (ids.length === 0) return;
    setBulkPending(true);
    try {
      const res = await fetch("/api/workspace/claim", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interactionIds: ids }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Lỗi ${res.status}`);
      const claimedSet = new Set<string>(body.claimed ?? []);
      const conflictSet = new Set<string>(body.conflicts ?? []);
      const claimedItems = available.filter((item) => claimedSet.has(item.interactionId));
      const conflictNames = available.filter((item) => conflictSet.has(item.interactionId)).map((item) => item.customerName);
      setAvailable((prev) => prev.filter((item) => !ids.includes(item.interactionId)));
      setWorkspace((prev) => [...claimedItems, ...prev]);
      if (conflictSet.size === 0) {
        toast.success(`Đã thêm ${claimedItems.length} liên hệ vào Workspace.`);
      } else {
        setNotice({
          title: `Đã thêm ${claimedItems.length}/${ids.length} liên hệ`,
          description: `${conflictSet.size} liên hệ đã bị Sale khác thêm vào Workspace của họ trước bạn: ${conflictNames.join(", ")}. Các liên hệ này đã được gỡ khỏi danh sách khả dụng.`,
        });
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Không thêm được các liên hệ đã chọn.");
    } finally {
      setBulkPending(false);
      stopSelectingAvailable();
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <Briefcase className="size-4 text-status-received" />
          <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Workspace của tôi</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{workspace.length}</span>
        </div>
        {workspace.length === 0 ? (
          <EmptyState icon={Briefcase} title="Workspace đang trống" description="Chọn liên hệ ở hàng đợi bên dưới để thêm vào đây." />
        ) : (
          <WorkspaceTable
            items={workspace}
            onOpen={setSelectedId}
            actionIcon={<Unlock className="size-3.5" />}
            actionLabel="Giải phóng"
            actionClassName="h-9 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onAction={releaseFromWorkspace}
            pendingIds={pendingIds}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {selectingAvailable ? (
            <>
              <div className="flex items-center gap-2.5">
                <Inbox className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Đã chọn <strong className="font-mono text-foreground">{selectedAvailable.size}</strong> liên hệ
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={stopSelectingAvailable}>
                  <X className="size-3.5" />
                  Huỷ
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="glossy rounded-full bg-status-received px-4 text-white hover:bg-status-received/90"
                  disabled={selectedAvailable.size === 0 || bulkPending}
                  onClick={addSelectedToWorkspace}
                >
                  {bulkPending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                  Thêm {selectedAvailable.size} vào Workspace
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2.5">
                <Inbox className="size-4 text-muted-foreground" />
                <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">Liên hệ khả dụng</h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{filteredAvailable.length}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative sm:w-64">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm tên khách, fanpage…"
                    className="h-10 rounded-xl bg-background pr-3 pl-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 rounded-full"
                  disabled={filteredAvailable.length === 0}
                  onClick={() => setSelectingAvailable(true)}
                >
                  <ListChecks className="size-3.5" />
                  Chọn
                </Button>
              </div>
            </>
          )}
        </div>
        {filteredAvailable.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={available.length === 0 ? "Hàng đợi trống" : "Không tìm thấy liên hệ phù hợp"}
            description={
              available.length === 0
                ? "Không còn liên hệ nào chưa được nhận trong hàng đợi của bạn."
                : "Thử đổi từ khoá tìm kiếm."
            }
          />
        ) : (
          <WorkspaceTable
            items={filteredAvailable}
            onOpen={setSelectedId}
            actionIcon={<Plus className="size-3.5" />}
            actionLabel="Thêm vào Workspace"
            actionClassName="glossy h-9 rounded-full bg-status-received px-3 text-white hover:bg-status-received/90"
            onAction={addToWorkspace}
            selecting={selectingAvailable}
            selected={selectedAvailable}
            onToggleOne={toggleOneAvailable}
            onToggleAll={toggleAllAvailable}
            pendingIds={pendingIds}
          />
        )}
      </section>

      <LeadDetailSheet interactionId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} onChanged={() => router.refresh()} />

      <Dialog open={!!notice} onOpenChange={(open) => !open && setNotice(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-waiting-bg text-status-waiting">
                <CircleAlert className="size-4" />
              </span>
              <DialogTitle>{notice?.title}</DialogTitle>
            </div>
            <DialogDescription>{notice?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" className="rounded-full" onClick={() => setNotice(null)}>
              Đã hiểu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
