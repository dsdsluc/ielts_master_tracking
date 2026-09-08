"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileDown, Inbox, LoaderCircle, RotateCcw, Search, SlidersHorizontal, Sparkles, User } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { FormMessage } from "@/components/form-message";
import { PaginationBar } from "@/components/pagination-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadsTable } from "@/app/(app)/leads/lead-row";
import { LeadDetailSheet } from "@/app/(app)/leads/lead-detail-sheet";
import { NewLeadDialog, type LeadFormOptions } from "@/app/(app)/leads/new-lead-dialog";
import { fetchInteractions, fetchQueue } from "@/app/(app)/leads/leads-api";
import type { InteractionListItem, LeadStatus, QueueResponse } from "@/app/(app)/leads/types";

type TabKey = "priority" | "waiting" | "in_progress" | "followup" | "closed";
type PageMeta = { page: number; totalPages: number; totalItems: number };

const PAGE_SIZE = 20;

const TABS: { key: TabKey; label: string }[] = [
  { key: "priority", label: "Hàng đợi ưu tiên" },
  { key: "waiting", label: "Chờ" },
  { key: "in_progress", label: "Tiếp nhận" },
  { key: "followup", label: "Cần chăm sóc lại" },
  { key: "closed", label: "Đã đóng" },
];

function sampleItems(branchCode: string): InteractionListItem[] {
  const base = { customerKey: "SAMPLE-CUSTOMER", sourceName: "Facebook", fanpageName: "IELTS Master", adId: null, assignedBranchCode: branchCode, assignedSaleEmail: "sale@example.com", assignedSaleName: "Nguyễn Minh Anh", createdByEmail: "sale@example.com", phoneNormalized: null, conversationLink: null, version: 1 };
  return [
    { ...base, interactionId: "SAMPLE-001", customerKey: "SAMPLE-CUS-001", customerName: "Trần Gia Hân", status: "Chờ", createdLeadAt: "2026-09-07T08:15:00+07:00", touchCount: 1, needsFollowup: false },
    { ...base, interactionId: "SAMPLE-002", customerKey: "SAMPLE-CUS-002", customerName: "Lê Hoàng Nam", status: "Tiếp nhận", createdLeadAt: "2026-09-07T09:40:00+07:00", touchCount: 2, needsFollowup: true },
    { ...base, interactionId: "SAMPLE-003", customerKey: "SAMPLE-CUS-003", customerName: "Phạm Khánh Linh", status: "Đủ tiêu chuẩn", createdLeadAt: "2026-09-06T14:20:00+07:00", touchCount: 3, needsFollowup: false, phoneNormalized: "090 123 4567" },
    { ...base, interactionId: "SAMPLE-004", customerKey: "SAMPLE-CUS-004", customerName: "Nguyễn Đức Anh", status: "Spam", createdLeadAt: "2026-09-06T16:05:00+07:00", touchCount: 3, needsFollowup: false },
  ];
}

export function LeadsQueueView({ options, currentUserEmail }: { options: LeadFormOptions; currentUserEmail: string }) {
  const [tab, setTab] = useState<TabKey>("priority");
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [flatItems, setFlatItems] = useState<InteractionListItem[]>([]);
  const [pageMeta, setPageMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [followupOnly, setFollowupOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);

  const samples = useMemo(() => sampleItems(options.branches[0]?.code ?? "TDM"), [options.branches]);

  const matchesFilters = useCallback((item: InteractionListItem) => {
    const needle = search.trim().toLocaleLowerCase("vi");
    const matchesSearch = !needle || [item.customerName, item.sourceName, item.fanpageName, item.assignedSaleName, item.phoneNormalized]
      .some((value) => value?.toLocaleLowerCase("vi").includes(needle));
    const isMine = item.createdByEmail === currentUserEmail || item.assignedSaleEmail === currentUserEmail;
    return matchesSearch && (branch === "all" || item.assignedBranchCode === branch) && (!followupOnly || item.needsFollowup) && (!mineOnly || isMine);
  }, [branch, followupOnly, mineOnly, search, currentUserEmail]);

  // Debounce ô tìm kiếm trước khi gọi server — tránh 1 request/ký tự gõ.
  // Đặt lại page về 1 cùng lúc (trong cùng callback, được React batch chung 1
  // lần render) để tránh việc load() bị gọi 2 lần cho 1 lượt gõ.
  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [search]);

  const load = useCallback((activeTab: TabKey, activePage: number, activeSearch: string) => {
    setLoading(true);
    setError(null);

    let request: Promise<void>;
    if (activeTab === "priority") {
      // Hàng đợi ưu tiên không hỗ trợ tìm kiếm ở server (getQueue trả về toàn
      // bộ tập mở để gộp nhóm) — tìm kiếm cho tab này vẫn lọc client-side qua
      // matchesFilters bên dưới.
      request = fetchQueue().then((res) => {
        setQueue(res);
        setFlatItems([]);
        setPageMeta(null);
      });
    } else {
      request = fetchInteractions({ ...tabToParams(activeTab), page: activePage, pageSize: PAGE_SIZE, search: activeSearch || undefined }).then((res) => {
        setFlatItems(res.items);
        setQueue(null);
        setPageMeta({ page: res.page, totalPages: res.totalPages, totalItems: res.totalItems });
      });
    }

    request
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được danh sách."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Fetch-on-tab/page/search-change: no external store to subscribe to for
    // a REST list call, so this is the standard data-fetching effect shape.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab, page, debouncedSearch);
  }, [tab, page, debouncedSearch, load]);

  function changeTab(next: TabKey) {
    setTab(next);
    setPage(1);
  }

  function refreshCurrentTab() {
    load(tab, page, debouncedSearch);
  }

  function exportHref(): string | null {
    if (tab === "priority") return null;
    const params = tabToParams(tab);
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.needsFollowup) search.set("needsFollowup", "true");
    if (mineOnly) search.set("mine", "true");
    if (branch !== "all") search.set("branch", branch);
    if (debouncedSearch) search.set("search", debouncedSearch);
    return `/api/interactions/export?${search.toString()}`;
  }

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => changeTab(v as TabKey)}>
        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="max-w-full justify-start overflow-x-auto rounded-full bg-secondary/70 p-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex shrink-0 items-center gap-2">
            {exportHref() && (
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full"
                nativeButton={false}
                render={<a href={exportHref() ?? undefined} />}
              >
                <FileDown className="size-3.5" /> Xuất Excel
              </Button>
            )}
            <NewLeadDialog options={options} onCreated={refreshCurrentTab} />
          </div>
        </div>

        <div className="mb-5 grid gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm md:grid-cols-[minmax(240px,1fr)_220px_auto_auto_auto] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, SĐT, Fanpage, tư vấn viên…" className="h-10 rounded-xl bg-background pr-3 pl-9" />
          </div>
          <Select value={branch} onValueChange={(value) => setBranch(value ?? "all")}>
            <SelectTrigger className="h-10 w-full rounded-xl bg-background">
              <SlidersHorizontal className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Tất cả cơ sở" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả cơ sở</SelectItem>
              {options.branches.map((item) => <SelectItem key={item.code} value={item.code}>{item.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className={followupOnly
              ? "h-10 rounded-xl border-gold/40 bg-accent text-accent-foreground hover:bg-accent/80"
              : "h-10 rounded-xl border-gold/25 bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"}
            onClick={() => setFollowupOnly((value) => !value)}
          >
            <Sparkles className="size-3.5 text-gold" /> Chăm sóc lại
          </Button>
          <Button
            type="button"
            variant="outline"
            className={mineOnly
              ? "h-10 rounded-xl border-status-received/40 bg-status-received-bg text-status-received hover:bg-status-received-bg/80"
              : "h-10 rounded-xl border-border bg-background text-muted-foreground hover:bg-status-received-bg hover:text-status-received"}
            onClick={() => setMineOnly((value) => !value)}
          >
            <User className="size-3.5" /> Của tôi
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label="Xoá bộ lọc" className="mx-auto rounded-xl text-status-received hover:bg-status-received-bg hover:text-status-received md:mx-0" onClick={() => { setSearch(""); setBranch("all"); setFollowupOnly(false); setMineOnly(false); }}>
            <RotateCcw className="size-4" />
          </Button>
        </div>

        {TABS.map((t) => (
          <TabsContent key={t.key} value={t.key}>
            {loading && (
              <div className="flex justify-center py-16">
                <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!loading && error && <FormMessage kind="error">{error}</FormMessage>}

            {!loading && !error && t.key === "priority" && queue && (
              <PriorityGroups groups={queue.groups} samples={samples} matchesFilters={matchesFilters} onOpen={setSelectedId} />
            )}

            {!loading && !error && t.key !== "priority" && (
              <>
                <FlatList items={flatItems} samples={samplesForTab(samples, t.key)} matchesFilters={matchesFilters} onOpen={setSelectedId} />
                {pageMeta && flatItems.length > 0 && (
                  <PaginationBar page={pageMeta.page} totalPages={pageMeta.totalPages} totalItems={pageMeta.totalItems} onPageChange={setPage} />
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <LeadDetailSheet
        interactionId={selectedId}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onChanged={refreshCurrentTab}
      />
    </>
  );
}

function tabToParams(tab: Exclude<TabKey, "priority">): {
  status?: string;
  needsFollowup?: boolean;
} {
  const closedStatuses: LeadStatus[] = ["Đủ tiêu chuẩn", "Spam"];
  switch (tab) {
    case "waiting":
      return { status: "Chờ" };
    case "in_progress":
      return { status: "Tiếp nhận" };
    case "followup":
      return { needsFollowup: true };
    case "closed":
      // API nhận nhiều status nối dấu phẩy — "Đã đóng" gộp cả 2 kết quả cuối
      // cùng trong 1 lần truy vấn phân trang (thay vì 2 lần rồi merge tay).
      return { status: closedStatuses.join(",") };
  }
}

const GROUP_PAGE_SIZE = 10;

function PriorityGroups({
  groups,
  samples,
  matchesFilters,
  onOpen,
}: {
  groups: QueueResponse["groups"];
  samples: InteractionListItem[];
  matchesFilters: (item: InteractionListItem) => boolean;
  onOpen: (id: string) => void;
}) {
  const [groupPages, setGroupPages] = useState<Record<string, number>>({});

  const hasRealData = groups.some((group) => group.items.length > 0);
  const sourceGroups = hasRealData ? groups : [{ key: "new_waiting" as const, label: "Mẫu hàng đợi ưu tiên", items: samples.slice(0, 2) }];
  const nonEmpty = sourceGroups.map((group) => ({ ...group, items: group.items.filter(matchesFilters) })).filter((g) => g.items.length > 0);

  if (nonEmpty.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Hàng đợi trống"
        description="Không có liên hệ nào cần xử lý ngay lúc này — quay lại sau hoặc kiểm tra tab Đã đóng."
      />
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {nonEmpty.map((group) => {
        const totalPages = Math.max(1, Math.ceil(group.items.length / GROUP_PAGE_SIZE));
        const page = Math.min(groupPages[group.key] ?? 1, totalPages);
        const pagedItems = group.items.slice((page - 1) * GROUP_PAGE_SIZE, page * GROUP_PAGE_SIZE);

        return (
          <div key={group.key}>
            <div className="mb-2.5 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="h-4 w-1 rounded-full bg-status-received" />
                <h2 className="font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">{group.label}</h2>
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{group.items.length}</span>
              </div>
              <PaginationBar
                compact
                page={page}
                totalPages={totalPages}
                totalItems={group.items.length}
                onPageChange={(next) => setGroupPages((prev) => ({ ...prev, [group.key]: next }))}
              />
            </div>
            <LeadsTable items={pagedItems} onOpen={onOpen} isSample={!hasRealData} />
          </div>
        );
      })}
    </div>
  );
}

function samplesForTab(items: InteractionListItem[], tab: TabKey) {
  if (tab === "waiting") return items.filter((item) => item.status === "Chờ");
  if (tab === "in_progress") return items.filter((item) => item.status === "Tiếp nhận");
  if (tab === "followup") return items.filter((item) => item.needsFollowup);
  if (tab === "closed") return items.filter((item) => item.status === "Đủ tiêu chuẩn" || item.status === "Spam");
  return items;
}

function FlatList({ items, samples, matchesFilters, onOpen }: { items: InteractionListItem[]; samples: InteractionListItem[]; matchesFilters: (item: InteractionListItem) => boolean; onOpen: (id: string) => void }) {
  const hasRealData = items.length > 0;
  const filteredItems = (hasRealData ? items : samples).filter(matchesFilters);
  if (filteredItems.length === 0) {
    return (
      <EmptyState icon={Inbox} title="Không có liên hệ nào" description="Chưa có dữ liệu phù hợp với bộ lọc này." />
    );
  }

  return <LeadsTable items={filteredItems} onOpen={onOpen} isSample={!hasRealData} />;
}
