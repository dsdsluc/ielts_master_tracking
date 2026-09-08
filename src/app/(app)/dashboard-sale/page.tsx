import Link from "next/link";
import { ChevronRight, PartyPopper, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { TrendChart } from "@/app/(app)/dashboard-sale/trend-chart";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { branchScopeWhere, getQueue } from "@/lib/interactions/queries";
import { dayKey } from "@/lib/day-key";

const TREND_DAYS = 14;
const PREVIEW_LIMIT = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default async function DashboardSalePage() {
  const user = await getCurrentUser();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const trendStart = new Date(todayStart);
  trendStart.setDate(trendStart.getDate() - (TREND_DAYS - 1));

  const [createdToday, touchesToday, qualifiedToday, needsFollowupOpen, trendRows, queue] = await Promise.all([
    prisma.interaction.count({ where: { createdByEmail: user.email, createdLeadAt: { gte: todayStart } } }),
    prisma.systemLog.count({ where: { actorEmail: user.email, action: SYSTEM_LOG_ACTION.TOUCH, loggedAt: { gte: todayStart } } }),
    prisma.interaction.count({ where: { updatedByEmail: user.email, statusName: STATUS.PHONE, closedAt: { gte: todayStart } } }),
    prisma.interaction.count({ where: { ...branchScopeWhere(user), activeFlag: true, needsFollowup: true } }),
    prisma.interaction.findMany({
      where: { createdByEmail: user.email, createdLeadAt: { gte: trendStart } },
      select: { createdLeadAt: true },
    }),
    getQueue(user),
  ]);

  const countByDay = new Map<string, number>();
  for (const row of trendRows) {
    const key = dayKey(row.createdLeadAt);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }
  const trendData = Array.from({ length: TREND_DAYS }, (_, i) => {
    const d = new Date(trendStart);
    d.setDate(d.getDate() + i);
    return { date: d.toISOString(), count: countByDay.get(dayKey(d)) ?? 0 };
  });

  const previewItems = queue.groups.flatMap((g) => g.items).slice(0, PREVIEW_LIMIT);

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan"
        title="Dashboard Sale"
        description="Số liệu cá nhân trong ngày — dữ liệu ghi trực tiếp từ hoạt động của bạn."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Liên hệ tạo hôm nay" value={createdToday} accentClassName="bg-foreground/50" />
        <KpiCard label="Đã liên hệ hôm nay" value={touchesToday} accentClassName="bg-status-received" />
        <KpiCard label="Đủ tiêu chuẩn hôm nay" value={qualifiedToday} accentClassName="bg-status-qualified" />
        <KpiCard label="Cần chăm sóc lại" value={needsFollowupOpen} accentClassName="bg-status-waiting" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Xu hướng liên hệ tạo mới</CardTitle>
            <CardDescription>{TREND_DAYS} ngày gần nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={trendData} seriesLabel="Liên hệ tạo mới" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-gold" /> Cần xử lý trước
            </CardTitle>
            <CardDescription>Ưu tiên cao nhất trong hàng đợi của bạn</CardDescription>
          </CardHeader>
          <CardContent>
            {previewItems.length === 0 ? (
              <EmptyState
                icon={PartyPopper}
                title="Không có việc gấp"
                description="Hàng đợi ưu tiên của bạn đang trống — quay lại sau."
              />
            ) : (
              <div className="flex flex-col">
                {previewItems.map((item) => (
                  <Link
                    key={item.interactionId}
                    href={`/leads/${item.interactionId}`}
                    className="group flex items-center justify-between gap-3 border-b border-border/60 py-3 last:border-0 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.fanpageName} · {formatDate(item.createdLeadAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill status={item.status} />
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
                <Link href="/leads" className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline">
                  Xem tất cả trong Liên hệ <ChevronRight className="size-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
