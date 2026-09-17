"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, LoaderCircle, RotateCcw, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadsTable, type LeadsSort } from "@/app/(app)/leads/lead-row";
import { LeadDetailSheet } from "@/app/(app)/leads/lead-detail-sheet";
import { NewLeadDialog, type LeadFormOptions } from "@/app/(app)/leads/new-lead-dialog";
import { fetchOpenInteractions, getCachedOpenInteractions, invalidateOpenInteractionsCache } from "@/app/(app)/leads/leads-api";
import { STATUS } from "@/lib/interactions/constants";
import type { InteractionListItem } from "@/app/(app)/leads/types";

type TabKey = "waiting" | "in_progress" | "qualified";

const PAGE_SIZE = 20;
const DEFAULT_SORT: LeadsSort = { key: "createdAt", direction: "desc" };
const TAB_STATUS: Record<TabKey, string> = {
  waiting: STATUS.WAITING,
  in_progress: STATUS.PROCESSING,
  qualified: STATUS.PHONE,
};
const TABS: { key: TabKey; label: string }[] = [
  { key: "waiting", label: "Chờ" },
  { key: "in_progress", label: "Tiếp nhận" },
  // Chỉ gồm lead Đủ tiêu chuẩn GẦN ĐÂY (xem QUALIFIED_QUEUE_WINDOW_DAYS ở
  // queries.ts) — lịch sử đầy đủ xem ở /customers.
  { key: "qualified", label: "Đủ tiêu chuẩn" },
];

function sampleItems(branchCode: string): InteractionListItem[] {
  const base = {
    customerKey: "SAMPLE-CUSTOMER",
    sourceName: "Facebook",
    fanpageName: "IELTS Master",
    adId: null,
    assignedBranchCode: branchCode,
    assignedSaleEmail: "sale@example.com",
    assignedSaleName: "Nguyễn Minh Anh",
    consultantEmail: "sale@example.com",
    consultantName: "Nguyễn Minh Anh",
    createdByEmail: "sale@example.com",
    phoneNormalized: null,
    conversationLink: null,
    version: 1,
    slaOverdue: false,
  };
  return [
    { ...base, interactionId: "SAMPLE-001", customerKey: "SAMPLE-CUS-001", customerName: "Trần Gia Hân", status: "Chờ", createdLeadAt: "2026-09-07T08:15:00+07:00", needsFollowup: false },
    { ...base, interactionId: "SAMPLE-002", customerKey: "SAMPLE-CUS-002", customerName: "Lê Hoàng Nam", status: "Tiếp nhận", createdLeadAt: "2026-09-07T09:40:00+07:00", needsFollowup: true },
    { ...base, interactionId: "SAMPLE-003", customerKey: "SAMPLE-CUS-003", customerName: "Phạm Thu Trang", status: "Đủ tiêu chuẩn", createdLeadAt: "2026-09-06T14:20:00+07:00", needsFollowup: false, phoneNormalized: "0900000000" },
  ];
}

function normalizeSearch(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "D")
    .toLocaleLowerCase("vi")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function isMine(item: InteractionListItem, email: string): boolean { return item.consultantEmail === email; }

function sortItems(items: InteractionListItem[], sort: LeadsSort, currentUserEmail: string): InteractionListItem[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const mineOrder = Number(isMine(b.item, currentUserEmail)) - Number(isMine(a.item, currentUserEmail));
      if (mineOrder !== 0) return mineOrder;

      let compared = 0;
      if (sort.key === "customer") {
        compared = a.item.customerName.localeCompare(b.item.customerName, "vi", { sensitivity: "base" });
      } else {
        compared = Date.parse(a.item.createdLeadAt) - Date.parse(b.item.createdLeadAt);
      }
      if (sort.direction === "desc") compared *= -1;
      return compared || a.index - b.index;
    })
    .map(({ item }) => item);
}

export function LeadsQueueView({ options, currentUserEmail }: {
  options: LeadFormOptions;
  currentUserEmail: string;
}) {
  const cachedAtMount = useMemo(() => getCachedOpenInteractions(currentUserEmail), [currentUserEmail]);
  const [tab, setTab] = useState<TabKey>("waiting");
  const [allItems, setAllItems] = useState<InteractionListItem[]>(cachedAtMount ?? []);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!cachedAtMount);
  const [refreshing, setRefreshing] = useState(!!cachedAtMount);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [sort, setSort] = useState<LeadsSort>(DEFAULT_SORT);
  const samples = useMemo(() => sampleItems(options.branches[0]?.code ?? "TDM"), [options.branches]);

  const load = useCallback(async (force = false) => {
    if (force || cachedAtMount) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setAllItems(await fetchOpenInteractions({ userKey: currentUserEmail, force }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cachedAtMount, currentUserEmail]);

  useEffect(() => {
    // Khởi tạo snapshot REST một lần khi mount; các thay đổi filter/sort không
    // subscribe hay fetch lại nên không thuộc dependency của effect này.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const tabItems = useMemo(
    () => allItems.filter((item) => item.status === TAB_STATUS[tab]),
    [allItems, tab],
  );
  const isSample = !loading && !error && tabItems.length === 0;
  const sourceItems = isSample ? samplesForTab(samples, tab) : tabItems;
  const filteredItems = useMemo(() => {
    const needle = normalizeSearch(search);
    const filtered = sourceItems.filter((item) => {
      if (branch !== "all" && item.assignedBranchCode !== branch) return false;
      if (!needle) return true;
      return [item.customerName, item.phoneNormalized, item.fanpageName, item.sourceName, item.consultantName, item.adId]
        .some((value) => normalizeSearch(value).includes(needle));
    });
    return sortItems(filtered, sort, currentUserEmail);
  }, [branch, currentUserEmail, search, sort, sourceItems]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const activePage = Math.min(page, totalPages);
  const visibleItems = filteredItems.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  function changeTab(next: TabKey) { setTab(next); setPage(1); }
  function changeSearch(value: string) { setSearch(value); setPage(1); }
  function changeBranch(value: string | null) { setBranch(value ?? "all"); setPage(1); }
  function changeSort(next: LeadsSort) { setSort(next); setPage(1); }
  function resetFilters() { setSearch(""); setBranch("all"); setSort(DEFAULT_SORT); setPage(1); }
  function refreshSnapshot() { invalidateOpenInteractionsCache(); void load(true); }
  function exportHref(): string {
    const query = new URLSearchParams({ status: TAB_STATUS[tab] });
    if (branch !== "all") query.set("branch", branch);
    if (search.trim()) query.set("search", search.trim());
    return `/api/interactions/export?${query.toString()}`;
  }

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Liên hệ"
        action={
          <div className="flex w-full flex-1 flex-wrap items-center justify-end gap-1.5">
            <Select value={tab} onValueChange={(value) => changeTab(value as TabKey)} items={TABS.map((item) => ({ value: item.key, label: item.label }))}>
              <SelectTrigger className="h-9 w-40 shrink-0 rounded-lg bg-background"><SelectValue /></SelectTrigger>
              <SelectContent>{TABS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={branch} onValueChange={changeBranch} items={[{ value: "all", label: "Tất cả cơ sở" }, ...options.branches.map((item) => ({ value: item.code, label: item.name }))]}>
              <SelectTrigger className="h-9 w-36 shrink-0 rounded-lg bg-background">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" /><SelectValue placeholder="Tất cả cơ sở" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả cơ sở</SelectItem>
                {options.branches.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Xóa bộ lọc" className="shrink-0 rounded-lg text-status-received hover:bg-status-received-bg hover:text-status-received" onClick={resetFilters}>
              <RotateCcw className="size-3.5" />
            </Button>
            <div className="flex shrink-0 items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-9 rounded-full" nativeButton={false} render={<a href={exportHref()} />}>
                <FileDown className="size-3.5" /> Xuất Excel
              </Button>
              <NewLeadDialog options={options} onCreated={refreshSnapshot} />
            </div>
          </div>
        }
      />

      {loading && <div className="flex justify-center py-16"><LoaderCircle className="size-5 animate-spin text-muted-foreground" /></div>}
      {!loading && error && <FormMessage kind="error">{error}</FormMessage>}
      {!loading && !error && (
        <LeadsTable
          items={visibleItems}
          totalItems={filteredItems.length}
          onOpen={setSelectedId}
          isSample={isSample}
          currentUserEmail={currentUserEmail}
          search={search}
          onSearchChange={changeSearch}
          sort={sort}
          onSortChange={changeSort}
          refreshing={refreshing}
          pagination={{ page: activePage, totalPages, totalItems: filteredItems.length, onPageChange: setPage }}
        />
      )}

      <LeadDetailSheet interactionId={selectedId} onOpenChange={(open) => !open && setSelectedId(null)} onChanged={refreshSnapshot} />
    </>
  );
}

function samplesForTab(items: InteractionListItem[], tab: TabKey): InteractionListItem[] {
  return items.filter((item) => item.status === TAB_STATUS[tab]);
}
