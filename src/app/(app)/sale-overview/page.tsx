import Link from "next/link";
import { ArrowRight, CalendarClock, GitMerge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { ROLES, STATUS } from "@/lib/interactions/constants";
import { branchScopeWhere } from "@/lib/interactions/queries";
import { prisma } from "@/lib/prisma";
import { customerScopeWhere } from "@/app/(app)/customers/customer-scope";
import { SaleOverviewDatePicker } from "@/app/(app)/sale-overview/sale-overview-date-picker";
import { cached } from "@/lib/cache";
import type { CurrentUser } from "@/lib/auth/dal";

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type DuplicateGroup = { phone: string; names: string[]; recordCount: number; lastTouchAt: string };

// Quét TOÀN BỘ khách hàng có SĐT trong phạm vi để tìm trùng — nặng nhất trang
// này, mọi Sale ghé qua đều chạy lại nếu không cache. Trả về đã rút gọn +
// lastTouchAt chuyển ISO string (thuần JSON, không Date) để cache an toàn qua
// Redis (xem comment ở lib/cache.ts — Date sống sót qua JSON sẽ mất kiểu).
async function computeDuplicateGroups(user: CurrentUser): Promise<DuplicateGroup[]> {
  const customers = await prisma.customer.findMany({
    where: { ...customerScopeWhere(user), phoneNormalized: { not: null } },
    select: { displayName: true, phoneNormalized: true, lastTouchAt: true },
    orderBy: { lastTouchAt: "desc" },
  });

  const byPhone = new Map<string, typeof customers>();
  for (const c of customers) {
    const phone = c.phoneNormalized!;
    const list = byPhone.get(phone) ?? [];
    list.push(c);
    byPhone.set(phone, list);
  }

  return [...byPhone.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([phone, list]) => ({
      phone,
      names: list.map((c) => c.displayName),
      recordCount: list.length,
      lastTouchAt: list.reduce((a, b) => (a.lastTouchAt > b.lastTouchAt ? a : b)).lastTouchAt.toISOString(),
    }));
}

export default async function SaleOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "saleOverview");
  const { date: dateParam } = await searchParams;
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayStr();
  const [y, m, d] = date.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

  // "Cần chăm sóc lại": Sale chỉ tính đúng phần Marketing nhắm tới email của
  // họ (mirror followup-inbox/page.tsx) — Leader/Admin xem toàn phạm vi cơ sở.
  const followupWhere = {
    ...branchScopeWhere(user),
    activeFlag: true,
    needsFollowup: true,
    ...(user.role === ROLES.SALES ? { followupTargetSaleEmail: user.email } : {}),
  };

  const [groups, openLeadsCount, workspaceCount, followupCount, createdInDay, qualifiedInDay, spamInDay] = await Promise.all([
    // Tạm thời phát hiện trùng theo heuristic: cùng SĐT nhưng khác Link chuẩn
    // (khác customerKey) => nhiều khả năng là 1 người thật liên hệ qua 2 link
    // khác nhau.
    cached(`sale-overview:dup:${JSON.stringify(customerScopeWhere(user))}`, 90, () => computeDuplicateGroups(user)),
    prisma.interaction.count({
      where: { ...branchScopeWhere(user), activeFlag: true, needsFollowup: false, statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] } },
    }),
    prisma.interaction.count({
      where: {
        assignedSaleEmail: user.email,
        activeFlag: true,
        needsFollowup: false,
        statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] },
      },
    }),
    prisma.interaction.count({ where: followupWhere }),
    prisma.interaction.count({ where: { ...branchScopeWhere(user), createdLeadAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.interaction.count({ where: { ...branchScopeWhere(user), statusName: STATUS.PHONE, closedAt: { gte: dayStart, lt: dayEnd } } }),
    prisma.interaction.count({ where: { ...branchScopeWhere(user), statusName: STATUS.SPAM, closedAt: { gte: dayStart, lt: dayEnd } } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Tổng quan Sale"
        description="Số liệu tổng hợp cho team Sale — liên hệ đang mở, Workspace, chăm sóc lại, hoạt động trong ngày và khách hàng trùng cần xử lý."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/leads" className="block rounded-lg transition-opacity hover:opacity-80">
          <KpiCard label="Liên hệ đang mở" value={openLeadsCount} accentClassName="bg-status-received" />
        </Link>
        <Link href="/workspace" className="block rounded-lg transition-opacity hover:opacity-80">
          <KpiCard label="Trong Workspace của tôi" value={workspaceCount} accentClassName="bg-primary" />
        </Link>
        <Link href="/followup-inbox" className="block rounded-lg transition-opacity hover:opacity-80">
          <KpiCard label="Cần chăm sóc lại" value={followupCount} accentClassName="bg-status-waiting" />
        </Link>
        <KpiCard label="Khách hàng trùng" value={groups.length} accentClassName="bg-destructive" />
      </div>

      <Card className="mb-6">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-1.5">
            <CalendarClock className="size-4 text-status-received" /> Hoạt động trong ngày
          </CardTitle>
          <CardDescription>Theo phạm vi cơ sở của bạn — chọn ngày để xem lại các ngày trước.</CardDescription>
          <CardAction>
            <SaleOverviewDatePicker date={date} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <KpiCard label="Liên hệ mới tạo" value={createdInDay} accentClassName="bg-foreground/50" />
            <KpiCard label="Đủ tiêu chuẩn" value={qualifiedInDay} accentClassName="bg-status-qualified" />
            <KpiCard label="Spam" value={spamInDay} accentClassName="bg-destructive" />
          </div>
        </CardContent>
      </Card>

      <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <GitMerge className="size-4 text-accent-foreground" /> Khách hàng trùng cần xử lý
          </p>
          <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">{groups.length}</span>
        </div>
        {groups.length === 0 ? (
          <EmptyState
            icon={GitMerge}
            title="Không có khách hàng nào bị trùng"
            description="Khi phát hiện 2 bản ghi khách hàng cùng số điện thoại, chúng sẽ xuất hiện ở đây để gộp lại."
          />
        ) : (
          <Table>
            <TableHeader className="bg-secondary/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">SĐT</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Số bản ghi</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Lần chạm gần nhất</TableHead>
                <TableHead className="w-28 pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <TableRow key={group.phone} className="odd:bg-secondary/10">
                  <TableCell className="min-w-48 px-5 py-3.5">
                    <p className="max-w-56 truncate font-medium text-foreground" title={group.names.join(" · ")}>
                      {group.names.slice(0, 2).join(" · ")}
                    </p>
                    {group.recordCount > 2 && <p className="text-xs text-muted-foreground">+{group.recordCount - 2} bản ghi khác</p>}
                  </TableCell>
                  <TableCell className="px-4 font-mono text-sm text-muted-foreground">{group.phone}</TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{group.recordCount}</TableCell>
                  <TableCell className="hidden px-4 text-xs text-muted-foreground sm:table-cell">
                    {formatDate(group.lastTouchAt)}
                  </TableCell>
                  <TableCell className="pr-5 pl-1 text-right">
                    <Link
                      href={`/sale-overview/${encodeURIComponent(group.phone)}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-status-received hover:underline"
                    >
                      Xem & gộp <ArrowRight className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
