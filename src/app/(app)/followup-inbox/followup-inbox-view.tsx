"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LoaderCircle, Plus, Repeat2, RotateCcw, Search, Sparkles, TriangleAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveFollowup } from "@/app/(app)/leads/leads-api";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiErrorMessage } from "@/lib/api-client";

export type FollowupInboxItem = {
  interactionId: string;
  customerName: string;
  status: string;
  branchName: string;
  mktSuggestion: string | null;
  mktPushedAt: string;
  mktPushedByName: string | null;
  followupResolvedCount: number;
  maxBeforeSpam: number;
  consultantEmail: string | null;
  consultantName: string | null;
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function FollowupInboxView({
  items,
  currentUserEmail,
  currentUserName,
}: {
  items: FollowupInboxItem[];
  currentUserEmail: string;
  currentUserName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  // Cập nhật lạc quan ngay sau khi "Nhận" — không đợi router.refresh() mới
  // thấy tên tư vấn viên đổi, tránh cảm giác bấm xong mà giao diện đứng im.
  const [pickedOverrides, setPickedOverrides] = useState<Record<string, { email: string; name: string }>>({});
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [pusher, setPusher] = useState("all");
  const [resolvedCount, setResolvedCount] = useState("all");
  const [lastChanceOnly, setLastChanceOnly] = useState(false);

  const visibleItems = useMemo(() => items.filter((i) => !resolvedIds.has(i.interactionId)), [items, resolvedIds]);

  const branchOptions = useMemo(() => Array.from(new Set(visibleItems.map((i) => i.branchName))).sort(), [visibleItems]);
  const pusherOptions = useMemo(
    () => Array.from(new Set(visibleItems.map((i) => i.mktPushedByName).filter((v): v is string => !!v))).sort(),
    [visibleItems]
  );
  // Hiển thị 1-indexed ("lần thứ mấy") thay vì số lần ĐÃ xử lý xong (0-indexed
  // trong DB) — vừa gửi chăm sóc lại lần đầu thì followupResolvedCount vẫn là
  // 0, nhưng với người dùng đây là "lần thứ 1" đang chờ xử lý.
  const resolvedCountOptions = useMemo(
    () => Array.from(new Set(visibleItems.map((i) => i.followupResolvedCount + 1))).sort((a, b) => a - b),
    [visibleItems]
  );

  // Base UI Select chỉ hiển thị đúng nhãn (thay vì value thô như "all") nếu
  // được truyền sẵn qua prop `items` — nhãn đăng ký muộn (sau khi popup mount)
  // nếu chỉ khai báo qua SelectItem con.
  const branchItems = useMemo(
    () => ({ all: "Tất cả cơ sở", ...Object.fromEntries(branchOptions.map((b) => [b, b])) }),
    [branchOptions]
  );
  const pusherItems = useMemo(
    () => ({ all: "Tất cả người yêu cầu", ...Object.fromEntries(pusherOptions.map((p) => [p, p])) }),
    [pusherOptions]
  );
  const resolvedCountItems = useMemo(
    () => ({
      all: "Số lần chăm sóc lại",
      ...Object.fromEntries(resolvedCountOptions.map((n) => [String(n), `Lần thứ ${n}`])),
    }),
    [resolvedCountOptions]
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    return visibleItems.filter((item) => {
      const matchesSearch = !needle || [item.customerName, item.mktSuggestion].some((v) => v?.toLocaleLowerCase("vi").includes(needle));
      const matchesBranch = branch === "all" || item.branchName === branch;
      const matchesPusher = pusher === "all" || item.mktPushedByName === pusher;
      const matchesResolvedCount = resolvedCount === "all" || item.followupResolvedCount + 1 === Number(resolvedCount);
      const isLastChance = item.followupResolvedCount + 1 >= item.maxBeforeSpam;
      const matchesLastChance = !lastChanceOnly || isLastChance;
      return matchesSearch && matchesBranch && matchesPusher && matchesResolvedCount && matchesLastChance;
    });
  }, [visibleItems, search, branch, pusher, resolvedCount, lastChanceOnly]);

  const hasFilters = !!search.trim() || branch !== "all" || pusher !== "all" || resolvedCount !== "all" || lastChanceOnly;

  async function handleResolve(item: FollowupInboxItem) {
    setPendingId(item.interactionId);
    try {
      const updated = await resolveFollowup(item.interactionId);
      if (updated.status === "Spam") {
        toast.info("Đã tự động chuyển Spam — liên hệ này đã bị nhắc chăm sóc lại quá số lần cho phép.");
      } else {
        toast.success("Đã đánh dấu xử lý xong.");
      }
      setResolvedIds((prev) => new Set(prev).add(item.interactionId));
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPendingId(null);
    }
  }

  async function handlePick(item: FollowupInboxItem) {
    setPickingId(item.interactionId);
    try {
      const data = await apiFetch<{ conflicts?: string[] }>("/api/workspace/claim", {
        method: "POST",
        body: JSON.stringify({ interactionIds: [item.interactionId] }),
      });
      if (data.conflicts?.length) {
        toast.error(`${item.customerName} vừa được Sale khác nhận vào Workspace của họ trước.`);
      } else {
        setPickedOverrides((prev) => ({ ...prev, [item.interactionId]: { email: currentUserEmail, name: currentUserName } }));
        toast.success(`Đã nhận ${item.customerName} vào Workspace của bạn.`);
      }
      router.refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setPickingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên khách, ghi chú…"
            className="h-10 rounded-xl bg-background pr-3 pl-9"
          />
        </div>
        <Select items={branchItems} value={branch} onValueChange={(v) => setBranch(v ?? "all")}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-40">
            <Building2 className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Tất cả cơ sở" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả cơ sở</SelectItem>
            {branchOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={pusherItems} value={pusher} onValueChange={(v) => setPusher(v ?? "all")}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-48">
            <User className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Tất cả người yêu cầu" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả người yêu cầu</SelectItem>
            {pusherOptions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={resolvedCountItems} value={resolvedCount} onValueChange={(v) => setResolvedCount(v ?? "all")}>
          <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-44">
            <Repeat2 className="size-3.5 text-muted-foreground" />
            <SelectValue placeholder="Số lần chăm sóc lại" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Số lần chăm sóc lại</SelectItem>
            {resolvedCountOptions.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Lần thứ {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className={
            lastChanceOnly
              ? "h-10 rounded-xl border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15"
              : "h-10 rounded-xl border-border bg-background text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          }
          onClick={() => setLastChanceOnly((v) => !v)}
        >
          <TriangleAlert className="size-3.5" />
          Sắp chuyển Spam
        </Button>
        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Xoá bộ lọc"
            className="rounded-xl text-status-received hover:bg-status-received-bg hover:text-status-received"
            onClick={() => {
              setSearch("");
              setBranch("all");
              setPusher("all");
              setResolvedCount("all");
              setLastChanceOnly(false);
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={visibleItems.length === 0 ? "Không có liên hệ nào cần chăm sóc lại" : "Không tìm thấy liên hệ phù hợp"}
          description={
            visibleItems.length === 0
              ? "Khi Marketing gửi yêu cầu chăm sóc lại, liên hệ sẽ xuất hiện ở đây."
              : "Thử đổi từ khoá tìm kiếm hoặc bộ lọc."
          }
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{filtered.length}</strong> liên hệ cần chăm sóc lại
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1220px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                  <TableHead className="min-w-56 px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ghi chú từ Marketing</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Người yêu cầu</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Thời gian yêu cầu</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã chăm sóc</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                  <TableHead className="w-56 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => {
                  const idle = daysSince(item.mktPushedAt);
                  const nextCount = item.followupResolvedCount + 1;
                  const isLastChance = nextCount >= item.maxBeforeSpam;
                  const pending = pendingId === item.interactionId;
                  const picking = pickingId === item.interactionId;
                  const override = pickedOverrides[item.interactionId];
                  const consultantEmail = override?.email ?? item.consultantEmail;
                  const consultantName = override?.name ?? item.consultantName;
                  const isMine = consultantEmail === currentUserEmail;
                  return (
                    <TableRow key={item.interactionId} className="odd:bg-secondary/10 align-top">
                      <TableCell className="min-w-40 px-5 py-3.5">
                        <p className="max-w-48 truncate font-medium text-foreground">{item.customerName}</p>
                        <div className="mt-1">
                          <StatusPill status={item.status} />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                        <p className="max-w-28 truncate">{item.branchName}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-foreground">
                        <p className="line-clamp-3 max-w-72 whitespace-pre-line">{item.mktSuggestion ?? "—"}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                        <p className="max-w-36 truncate">{item.mktPushedByName ?? "—"}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-xs text-muted-foreground">
                        {formatDateTime(item.mktPushedAt)}
                        {idle > 0 && (
                          <>
                            <br />
                            {idle} ngày trước
                          </>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-xs">
                        <span className={isLastChance ? "font-medium text-destructive" : "text-muted-foreground"}>
                          Lần {nextCount}/{item.maxBeforeSpam}
                        </span>
                        {isLastChance && <p className="mt-0.5 text-[11px] text-destructive">Lần cuối trước khi tự Spam</p>}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm">
                        {consultantName ? (
                          <p className={isMine ? "font-medium text-status-received" : "max-w-32 truncate text-foreground"}>
                            {isMine ? "Bạn" : consultantName}
                          </p>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-full border-status-received/30 text-status-received hover:bg-status-received-bg hover:text-status-received"
                            onClick={() => handlePick(item)}
                            disabled={picking}
                          >
                            {picking ? <LoaderCircle className="animate-spin" /> : <Plus className="size-3.5" />}
                            Nhận
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="py-3.5 pr-5 pl-1">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="secondary"
                            className="rounded-full border border-gold/30 bg-accent px-3 text-accent-foreground hover:bg-accent/80"
                            onClick={() => handleResolve(item)}
                            disabled={pending}
                          >
                            {pending && <LoaderCircle className="animate-spin" />}
                            Đã xử lý
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-full text-muted-foreground hover:text-foreground"
                            nativeButton={false}
                            render={<Link href={`/leads/${item.interactionId}`} />}
                          >
                            Mở
                            <ArrowRight className="size-3.5" />
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
      )}
    </div>
  );
}
