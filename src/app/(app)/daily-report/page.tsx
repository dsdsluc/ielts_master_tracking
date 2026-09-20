import { ClipboardList, GraduationCap, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { requireFeatureAccess } from "@/lib/auth/feature-access";
import { isLeaderLike } from "@/lib/interactions/scope";
import { SALE_LIKE_ROLES, STATUS, SYSTEM_LOG_ACTION, CUSTOMER_STAGE, CUSTOMER_STAGE_VALUES } from "@/lib/interactions/constants";
import { DailyReportSalePicker } from "@/app/(app)/daily-report/daily-report-sale-picker";
import { CopyReportButton } from "@/app/(app)/daily-report/copy-report-button";

const STATUS_ORDER = [STATUS.WAITING, STATUS.PROCESSING, STATUS.PHONE, STATUS.SPAM];
const NAME_PREVIEW_LIMIT = 4;

function namesPreview(names: string[]): string {
  if (names.length === 0) return "—";
  const shown = names.slice(0, NAME_PREVIEW_LIMIT).join(", ");
  return names.length > NAME_PREVIEW_LIMIT ? `${shown} +${names.length - NAME_PREVIEW_LIMIT} khác` : shown;
}

// Báo cáo hiệu suất CÁ NHÂN của 1 Sale trong ĐÚNG hôm nay, dành cho Leader rà
// soát nhanh 1 Sale đã làm gì hôm nay và khách hàng đang đứng ở đâu — khác
// trang "Tổng quan Sale" (số liệu cả team theo cơ sở, xem lại được ngày cũ)
// và trang "Hiệu suất tư vấn viên" ở Dashboard tổng (cửa sổ 7/30/90 ngày cho
// Admin rà soát). Toàn bộ số liệu dựa trên NHẬT KÝ HÀNH ĐỘNG (system_log)
// trong ngày — đúng nghĩa "hôm nay đã làm gì", không phải "hiện đang ở trạng
// thái nào" (2 khái niệm khác nhau: 1 lead có thể đổi trạng thái nhiều lần
// trong ngày, mỗi lần đổi tính là 1 hành động, nhưng chỉ tính 1 lần cho mục
// "theo trạng thái" ở dưới — tránh phóng đại vì sửa đi sửa lại).
// Không có date picker (cố tình) — trang chỉ trả lời cho đúng "hôm nay".
export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const user = await getCurrentUser();
  await requireFeatureAccess(user, "dailyReport");
  const canViewOthers = isLeaderLike(user);

  const { email: emailParam } = await searchParams;

  const sales = canViewOthers
    ? await prisma.user.findMany({
        where: { role: { in: SALE_LIKE_ROLES }, active: true },
        select: { email: true, fullName: true },
        orderBy: { fullName: "asc" },
      })
    : [];

  const targetEmail = canViewOthers ? (emailParam && sales.some((s) => s.email === emailParam) ? emailParam : (sales[0]?.email ?? null)) : user.email;
  const targetName = canViewOthers ? (sales.find((s) => s.email === targetEmail)?.fullName ?? targetEmail) : user.fullName;

  if (canViewOthers && !targetEmail) {
    return (
      <>
        <PageHeader eyebrow="Saler" title="Báo cáo cuối ngày" description="Hoạt động hôm nay của từng Sale." />
        <EmptyState icon={ClipboardList} title="Chưa có Sale nào đang hoạt động" description="Báo cáo sẽ hiện ra khi có Sale đang hoạt động trong hệ thống." />
      </>
    );
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [createdToday, newLeadsToday, careLogRows, statusLogsToday, stageLogsToday] = await Promise.all([
    prisma.interaction.count({ where: { createdByEmail: targetEmail!, createdLeadAt: { gte: todayStart } } }),
    prisma.customer.count({ where: { assignedToEmail: targetEmail!, assignedAt: { gte: todayStart } } }),
    prisma.customerCareLog.findMany({
      where: { loggedByEmail: targetEmail!, loggedAt: { gte: todayStart } },
      select: { customerKey: true },
    }),
    prisma.systemLog.findMany({
      where: { actorEmail: targetEmail!, action: SYSTEM_LOG_ACTION.UPDATE_RESULT, loggedAt: { gte: todayStart } },
      select: { interactionId: true, detailNew: true },
    }),
    prisma.systemLog.findMany({
      where: { actorEmail: targetEmail!, action: SYSTEM_LOG_ACTION.UPDATE_CUSTOMER_STAGE, loggedAt: { gte: todayStart } },
      select: { detailNew: true },
    }),
  ]);
  const careLogsToday = careLogRows.length;

  // Nhóm hành động đổi kết quả lead hôm nay theo TRẠNG THÁI SAU CÙNG — mỗi
  // interaction chỉ tính 1 lần cho 1 trạng thái (Set), dù đổi qua lại nhiều
  // lần trong ngày (tránh phóng đại), nhưng "Đã tương tác" bên dưới vẫn đếm
  // theo SỐ HÀNH ĐỘNG thật (không dedupe) vì đó là số lượt thao tác thực tế.
  const statusGroups = new Map<string, Set<string>>();
  for (const log of statusLogsToday) {
    const detail = log.detailNew as { status?: string } | null;
    if (!detail?.status || !log.interactionId) continue;
    const set = statusGroups.get(detail.status) ?? new Set<string>();
    set.add(log.interactionId);
    statusGroups.set(detail.status, set);
  }
  const touchedInteractionIds = [...new Set(statusLogsToday.map((l) => l.interactionId).filter((id): id is string => !!id))];
  const interactionNameRows = touchedInteractionIds.length
    ? await prisma.interaction.findMany({ where: { interactionId: { in: touchedInteractionIds } }, select: { interactionId: true, customerName: true } })
    : [];
  const interactionNameById = new Map(interactionNameRows.map((r) => [r.interactionId, r.customerName]));

  // Tương tự cho mốc tư vấn ghi danh — nhóm theo mốc MỚI, khách duy nhất.
  const stageGroups = new Map<string, Set<string>>();
  for (const log of stageLogsToday) {
    const detail = log.detailNew as { customerKey?: string; stage?: string } | null;
    if (!detail?.customerKey || !detail.stage) continue;
    const set = stageGroups.get(detail.stage) ?? new Set<string>();
    set.add(detail.customerKey);
    stageGroups.set(detail.stage, set);
  }
  const touchedCustomerKeys = [...new Set([...stageGroups.values()].flatMap((s) => [...s]))];
  const customerNameRows = touchedCustomerKeys.length
    ? await prisma.customer.findMany({ where: { customerKey: { in: touchedCustomerKeys } }, select: { customerKey: true, displayName: true } })
    : [];
  const customerNameByKey = new Map(customerNameRows.map((r) => [r.customerKey, r.displayName]));

  const qualifiedToday = statusGroups.get(STATUS.PHONE)?.size ?? 0;
  const spamToday = statusGroups.get(STATUS.SPAM)?.size ?? 0;
  const testScheduledToday = new Set([...(stageGroups.get(CUSTOMER_STAGE.TEST_SCHEDULED) ?? []), ...(stageGroups.get(CUSTOMER_STAGE.TRIAL_SCHEDULED) ?? [])]).size;
  const consultedToday = new Set([...(stageGroups.get(CUSTOMER_STAGE.TESTED) ?? []), ...(stageGroups.get(CUSTOMER_STAGE.TRIALED) ?? [])]).size;
  const enrolledToday = stageGroups.get(CUSTOMER_STAGE.ENROLLED)?.size ?? 0;
  const hasAnyActivity = createdToday > 0 || statusLogsToday.length > 0 || newLeadsToday > 0 || careLogsToday > 0 || stageLogsToday.length > 0;

  // "Khách cũ đã liên hệ" — khách KHÔNG mới nhận hôm nay (đã được giao từ
  // trước) nhưng hôm nay có ít nhất 1 lượt "Ghi nhận chăm sóc" — đếm theo
  // khách duy nhất, không đếm theo số lượt ghi nhận (1 khách gọi 3 lần trong
  // ngày vẫn chỉ tính 1).
  const caredCustomerKeys = [...new Set(careLogRows.map((r) => r.customerKey))];
  const caredCustomers = caredCustomerKeys.length
    ? await prisma.customer.findMany({ where: { customerKey: { in: caredCustomerKeys } }, select: { customerKey: true, assignedAt: true } })
    : [];
  const oldCustomersContactedToday = caredCustomers.filter((c) => !c.assignedAt || c.assignedAt < todayStart).length;

  const reportLines = [
    `Số lượng khách mới nhận: ${newLeadsToday}`,
    `Số lượng khách cũ đã liên hệ: ${oldCustomersContactedToday}`,
    `Khách hẹn test: ${testScheduledToday}`,
    `Khách đã tư vấn: ${consultedToday}`,
    `Khách dự kiến đăng ký: ${enrolledToday}`,
  ];
  const reportText = reportLines.join("\n");

  return (
    <>
      <PageHeader
        eyebrow="Saler"
        title="Báo cáo cuối ngày"
        description={
          canViewOthers
            ? `Hoạt động hôm nay của ${targetName} — Leader rà soát nhanh đã làm gì và khách hàng đang ở đâu.`
            : "Hoạt động của bạn hôm nay — cuối ngày xem lại để biết đã làm được gì."
        }
        action={canViewOthers ? <DailyReportSalePicker sales={sales} selectedEmail={targetEmail!} /> : undefined}
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <ClipboardList className="size-4 text-primary" /> Báo cáo nhanh
          </CardTitle>
          <CardDescription>Tóm tắt hôm nay — bấm Copy để gửi báo cáo cho Leader/nhóm khác.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {[
              ["Số lượng khách mới nhận", newLeadsToday],
              ["Số lượng khách cũ đã liên hệ", oldCustomersContactedToday],
              ["Khách hẹn test", testScheduledToday],
              ["Khách đã tư vấn", consultedToday],
              ["Khách dự kiến đăng ký", enrolledToday],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-secondary/20 px-4 py-2.5">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-heading text-lg font-semibold text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          <div>
            <CopyReportButton text={reportText} />
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Hoạt động lead hôm nay</h2>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Lead mới tạo" value={createdToday} accentClassName="bg-foreground/50" />
        <KpiCard label="Đã tương tác" value={statusLogsToday.length} accentClassName="bg-status-received" />
        <KpiCard label="Đủ tiêu chuẩn" value={qualifiedToday} accentClassName="bg-status-qualified" />
        <KpiCard label="Spam" value={spamToday} accentClassName="bg-destructive" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <ListChecks className="size-4 text-status-received" /> Chi tiết theo trạng thái Lead
          </CardTitle>
          <CardDescription>Mỗi lead chỉ tính 1 lần cho trạng thái đạt được hôm nay, dù đổi qua lại nhiều lần trong ngày.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
                <TableHead className="w-20 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Số lead</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STATUS_ORDER.map((status) => {
                const ids = [...(statusGroups.get(status) ?? [])];
                return (
                  <TableRow key={status} className="odd:bg-secondary/10">
                    <TableCell className="px-5 py-3 font-medium text-foreground">{status}</TableCell>
                    <TableCell className="text-center font-mono text-sm text-foreground">{ids.length}</TableCell>
                    <TableCell className="px-4 text-sm text-muted-foreground">{namesPreview(ids.map((id) => interactionNameById.get(id) ?? id))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-foreground">Hoạt động khách hàng hôm nay</h2>
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <KpiCard label="Lead mới nhận" value={newLeadsToday} accentClassName="bg-status-received" />
        <KpiCard label="Lượt chăm sóc" value={careLogsToday} accentClassName="bg-gold" />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <GraduationCap className="size-4 text-status-qualified" /> Chi tiết theo trạng thái Khách hàng
          </CardTitle>
          <CardDescription>Mỗi khách chỉ tính 1 lần cho mốc tư vấn đạt được hôm nay — {enrolledToday > 0 ? `${enrolledToday} khách đã chốt hôm nay.` : "chưa có khách nào chốt hôm nay."}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-secondary/60">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Mốc tư vấn</TableHead>
                <TableHead className="w-20 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Số khách</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CUSTOMER_STAGE_VALUES.map((stage) => {
                const keys = [...(stageGroups.get(stage) ?? [])];
                return (
                  <TableRow key={stage} className="odd:bg-secondary/10">
                    <TableCell className="px-5 py-3 font-medium text-foreground">{stage}</TableCell>
                    <TableCell className="text-center font-mono text-sm text-foreground">{keys.length}</TableCell>
                    <TableCell className="px-4 text-sm text-muted-foreground">{namesPreview(keys.map((k) => customerNameByKey.get(k) ?? k))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!hasAnyActivity && (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có hoạt động nào hôm nay"
          description="Số liệu sẽ tự cập nhật ngay khi có lead mới, cập nhật kết quả lead, hoặc cập nhật mốc tư vấn khách hàng."
        />
      )}
    </>
  );
}
