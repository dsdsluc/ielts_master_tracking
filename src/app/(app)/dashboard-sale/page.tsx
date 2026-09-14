import Link from "next/link";
import { ChevronRight, GraduationCap, PartyPopper, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/dal";
import { CAN_CREATE_OR_EDIT_LEAD, STATUS, STUDENT_STAGE, STUDENT_STAGE_VALUES, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { branchScopeWhere, getQueue } from "@/lib/interactions/queries";
import { getStudentProfilesForActor } from "@/lib/students/queries";
import { StageCountStrip } from "@/app/(app)/students/stage-count-strip";

const PREVIEW_LIMIT = 5;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export default async function DashboardSalePage() {
  const user = await requireRole(...CAN_CREATE_OR_EDIT_LEAD);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [createdToday, touchesToday, qualifiedToday, needsFollowupOpen, queue, students] = await Promise.all([
    prisma.interaction.count({ where: { createdByEmail: user.email, createdLeadAt: { gte: todayStart } } }),
    prisma.systemLog.count({ where: { actorEmail: user.email, action: SYSTEM_LOG_ACTION.TOUCH, loggedAt: { gte: todayStart } } }),
    prisma.interaction.count({ where: { updatedByEmail: user.email, statusName: STATUS.PHONE, closedAt: { gte: todayStart } } }),
    prisma.interaction.count({ where: { ...branchScopeWhere(user), activeFlag: true, needsFollowup: true } }),
    getQueue(user),
    getStudentProfilesForActor(user),
  ]);

  // Chỉ lấy liên hệ ĐÃ CLAIM vào Workspace của chính Sale này — không còn hiển
  // thị cả hàng đợi chung toàn cơ sở như trước, vì "Liên hệ khả dụng" (duyệt/
  // nhận từ hàng đợi chung) đã chuyển hẳn sang trang Liên hệ, Workspace giờ
  // chỉ còn đại diện cho việc CỦA RIÊNG Sale này.
  const previewItems = queue.groups
    .flatMap((g) => g.items)
    .filter((item) => item.workspaceClaimedByEmail === user.email)
    .slice(0, PREVIEW_LIMIT);

  const totalStudents = students.length;
  const enrolledStudents = students.filter((p) => p.stage === STUDENT_STAGE.ENROLLED).length;
  const studentConversionRate = totalStudents > 0 ? Math.round((enrolledStudents / totalStudents) * 1000) / 10 : 0;
  const studentStageCounts = [
    { label: "Chưa gọi", count: students.filter((p) => !p.stage).length },
    ...STUDENT_STAGE_VALUES.map((stage) => ({ label: stage, count: students.filter((p) => p.stage === stage).length })),
  ];

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
            <CardTitle className="flex items-center gap-1.5">
              <GraduationCap className="size-4 text-status-received" /> Học viên đang tư vấn
            </CardTitle>
            <CardDescription>Tổng quan học viên bạn đang phụ trách tư vấn ghi danh</CardDescription>
          </CardHeader>
          <CardContent>
            {totalStudents === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="Chưa có học viên nào được phân bổ"
                description="Học viên sẽ xuất hiện ở đây sau khi Leader phân bổ liên hệ đủ điều kiện cho bạn."
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-3">
                  <KpiCard label="Tổng học viên" value={totalStudents} accentClassName="bg-foreground/50" />
                  <KpiCard label="Đã chốt" value={enrolledStudents} accentClassName="bg-status-qualified" />
                  <KpiCard label="Tỷ lệ chốt" value={`${studentConversionRate}%`} accentClassName="bg-status-received" />
                </div>
                <StageCountStrip counts={studentStageCounts} />
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
