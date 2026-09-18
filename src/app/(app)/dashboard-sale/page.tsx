import Link from "next/link";
import { ArrowRight, ChevronRight, GraduationCap, MessageCircleMore, PartyPopper, Phone, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { INTERACTION_ACTIVITY, ROLES, STATUS, CUSTOMER_STAGE, CUSTOMER_STAGE_VALUES } from "@/lib/interactions/constants";
import { branchScopeWhere, getQueue } from "@/lib/interactions/queries";
import { getCustomersForSale } from "@/lib/customers/queries";
import { getLeadFormOptions } from "@/app/(app)/leads/get-lead-form-options";
import { StageCountStrip } from "@/app/(app)/customers/stage-count-strip";
import { CreateLeadTaskCard } from "@/app/(app)/dashboard-sale/create-lead-task-card";

const PREVIEW_LIMIT = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default async function DashboardSalePage() {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "dashboardSale");

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // "Cần chăm sóc lại": Sale chỉ tính đúng phần Marketing nhắm tới email của
  // họ (mirror followup-inbox/page.tsx) — Leader/Admin xem toàn phạm vi cơ sở.
  const followupWhere = {
    ...branchScopeWhere(user),
    activeFlag: true,
    needsFollowup: true,
    ...(user.role === ROLES.SALES ? { followupTargetSaleEmail: user.email } : {}),
  };

  const [createdToday, touchesToday, qualifiedToday, openWorkspaceCount, followupCount, options, queue, myCustomers] = await Promise.all([
    prisma.interaction.count({ where: { createdByEmail: user.email, createdLeadAt: { gte: todayStart } } }),
    prisma.interactionFieldLog.count({
      where: { changedByEmail: user.email, fieldKey: INTERACTION_ACTIVITY.FOLLOWUP_RESOLVED, changedAt: { gte: todayStart } },
    }),
    prisma.interaction.count({ where: { updatedByEmail: user.email, statusName: STATUS.PHONE, closedAt: { gte: todayStart } } }),
    prisma.interaction.count({
      where: {
        assignedSaleEmail: user.email,
        activeFlag: true,
        needsFollowup: false,
        statusName: { in: [STATUS.WAITING, STATUS.PROCESSING] },
      },
    }),
    prisma.interaction.count({ where: followupWhere }),
    getLeadFormOptions(),
    getQueue(user),
    getCustomersForSale(user.email),
  ]);

  // Chỉ lấy liên hệ ĐÃ CLAIM vào Workspace của chính Sale này — không còn hiển
  // thị cả hàng đợi chung toàn cơ sở như trước, vì "Liên hệ khả dụng" (duyệt/
  // nhận từ hàng đợi chung) đã chuyển hẳn sang trang Liên hệ, Workspace giờ
  // chỉ còn đại diện cho việc CỦA RIÊNG Sale này.
  const previewItems = queue.groups
    .flatMap((g) => g.items)
    .filter((item) => item.consultantEmail === user.email)
    .slice(0, PREVIEW_LIMIT);

  const totalCustomers = myCustomers.length;
  const enrolledCustomers = myCustomers.filter((c) => c.stage === CUSTOMER_STAGE.ENROLLED).length;
  const customerConversionRate = totalCustomers > 0 ? Math.round((enrolledCustomers / totalCustomers) * 1000) / 10 : 0;
  const customerStageCounts = [
    { label: "Chưa gọi", count: myCustomers.filter((c) => !c.stage).length },
    ...CUSTOMER_STAGE_VALUES.map((stage) => ({ label: stage, count: myCustomers.filter((c) => c.stage === stage).length })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan"
        title="Dashboard Sale"
        description="Việc cần làm hôm nay — tạo liên hệ mới, chăm sóc liên hệ đang xử lý, gọi điện và chăm sóc lại."
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CreateLeadTaskCard options={options} createdToday={createdToday} />

        <Link href="/workspace" className="shadow-bubble flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-4 hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-received-bg text-status-received">
              <MessageCircleMore className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Chăm sóc liên hệ</p>
              <p className="text-xs text-muted-foreground">
                {openWorkspaceCount} đang xử lý · {qualifiedToday} đủ tiêu chuẩn hôm nay
              </p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        <Link href="/workspace" className="shadow-bubble flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-4 hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Phone className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Gọi điện</p>
              <p className="text-xs text-muted-foreground">{touchesToday} lượt chăm sóc hôm nay</p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>

        <Link href="/followup-inbox" className="shadow-bubble flex items-center justify-between gap-2 rounded-2xl border border-border/70 bg-card p-4 hover:bg-secondary/30">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-status-waiting-bg text-status-waiting">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Chăm sóc lại</p>
              <p className="text-xs text-muted-foreground">{followupCount} cần xử lý</p>
            </div>
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <GraduationCap className="size-4 text-status-received" /> Khách hàng đang tư vấn
            </CardTitle>
            <CardDescription>Tổng quan khách hàng bạn đang phụ trách tư vấn ghi danh</CardDescription>
          </CardHeader>
          <CardContent>
            {totalCustomers === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Chưa có khách hàng nào được phân bổ"
                description="Khách hàng sẽ xuất hiện ở đây sau khi Leader phân bổ liên hệ đủ điều kiện cho bạn."
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <KpiCard label="Tổng khách hàng" value={totalCustomers} accentClassName="bg-foreground/50" />
                  <KpiCard label="Đã chốt" value={enrolledCustomers} accentClassName="bg-status-qualified" />
                  <KpiCard label="Tỷ lệ chốt" value={`${customerConversionRate}%`} accentClassName="bg-status-received" />
                </div>
                <StageCountStrip counts={customerStageCounts} />
                <Link href="/workspace" className="flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline">
                  Xem chi tiết trong Workspace <ChevronRight className="size-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Sparkles className="size-4 text-gold" /> Cần xử lý trước
            </CardTitle>
            <CardDescription>Ưu tiên cao nhất trong Workspace của bạn — liên hệ đã nhận, sắp/đã quá SLA hoặc cần chăm sóc lại</CardDescription>
          </CardHeader>
          <CardContent>
            {previewItems.length === 0 ? (
              <EmptyState
                icon={PartyPopper}
                title="Không có việc gấp"
                description="Không có liên hệ nào trong Workspace của bạn đang cần xử lý gấp — quay lại sau."
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
                      <p className="truncate text-sm font-medium text-foreground" title={item.customerName}>{item.customerName}</p>
                      <p className="truncate text-xs text-muted-foreground" title={`${item.fanpageName} · ${formatDate(item.createdLeadAt)}`}>
                        {item.fanpageName} · {formatDate(item.createdLeadAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusPill status={item.status} />
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                ))}
                <Link href="/workspace" className="mt-3 flex items-center justify-center gap-1 text-xs font-medium text-primary hover:underline">
                  Xem tất cả trong Workspace <ChevronRight className="size-3.5" />
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
