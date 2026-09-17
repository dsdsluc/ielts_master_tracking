"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Repeat2, RotateCcw, Search, Sparkles, TriangleAlert, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/pagination-bar";
import { formatDateTime } from "@/app/(app)/leads/lead-format";

const PAGE_SIZE = 20;

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
}: {
  items: FollowupInboxItem[];
  currentUserEmail: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [pusher, setPusher] = useState("all");
  const [resolvedCount, setResolvedCount] = useState("all");
  const [lastChanceOnly, setLastChanceOnly] = useState(false);
  const [page, setPage] = useState(1);

  const visibleItems = items;

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }
  function changeBranch(value: string) {
    setBranch(value);
    setPage(1);
  }
  function changePusher(value: string) {
    setPusher(value);
    setPage(1);
  }
  function changeResolvedCount(value: string) {
    setResolvedCount(value);
    setPage(1);
  }
  function toggleLastChanceOnly() {
    setLastChanceOnly((v) => !v);
    setPage(1);
  }
  function resetFilters() {
    setSearch("");
    setBranch("all");
    setPusher("all");
    setResolvedCount("all");
    setLastChanceOnly(false);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
        <div className="relative min-w-0 flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => changeSearch(e.target.value)}
            placeholder="Tìm tên khách, ghi chú…"
            className="h-10 rounded-xl bg-background pr-3 pl-9"
          />
        </div>
        <Select items={branchItems} value={branch} onValueChange={(v) => changeBranch(v ?? "all")}>
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
        <Select items={pusherItems} value={pusher} onValueChange={(v) => changePusher(v ?? "all")}>
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
        <Select items={resolvedCountItems} value={resolvedCount} onValueChange={(v) => changeResolvedCount(v ?? "all")}>
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
          onClick={toggleLastChanceOnly}
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
            onClick={resetFilters}
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
            <Table className="min-w-[1320px]">
              <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                  <TableHead className="min-w-56 px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Ghi chú từ Marketing</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Người yêu cầu</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Thời gian yêu cầu</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã chăm sóc</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                  <TableHead className="w-4 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((item) => {
                  const idle = daysSince(item.mktPushedAt);
                  const nextCount = item.followupResolvedCount + 1;
                  const isLastChance = nextCount >= item.maxBeforeSpam;
                  const isMine = item.consultantEmail === currentUserEmail;
                  return (
                    <TableRow
                      key={item.interactionId}
                      className="cursor-pointer odd:bg-secondary/10 align-top"
                      onClick={() => router.push(`/followup-inbox/${item.interactionId}`)}
                    >
                      <TableCell className="min-w-40 px-5 py-3.5">
                        <p className="max-w-48 truncate font-medium text-foreground" title={item.customerName}>{item.customerName}</p>
                        <div className="mt-1">
                          <StatusPill status={item.status} />
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                        <p className="max-w-28 truncate" title={item.branchName}>{item.branchName}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-foreground">
                        <p className="max-w-72 truncate" title={item.mktSuggestion ?? "—"}>{item.mktSuggestion ?? "—"}</p>
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-muted-foreground">
                        <p className="max-w-36 truncate" title={item.mktPushedByName ?? "—"}>{item.mktPushedByName ?? "—"}</p>
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
                        {isMine
                          ? <p className="font-medium text-status-received">Bạn</p>
                          : <p className="max-w-32 truncate text-xs text-muted-foreground" title={item.consultantName ?? "Chưa gán"}>{item.consultantName ?? "Chưa gán"}</p>}
                      </TableCell>
                      <TableCell className="w-4 py-3.5 pr-5 pl-1">
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="border-t border-border/70 px-5 py-3">
              <PaginationBar page={activePage} totalPages={totalPages} totalItems={filtered.length} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
