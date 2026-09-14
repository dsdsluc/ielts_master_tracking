import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  User,
  UserCog,
  Users2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/dal";
import {
  ROLES,
  SPAM_REASON,
  STATUS,
  SYSTEM_LOG_ACTION,
} from "@/lib/interactions/constants";
import {
  getQueue,
  getBranchSlaMap,
  type BranchSla,
} from "@/lib/interactions/queries";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { SPAM_REASON_OPTIONS } from "@/app/(app)/leads/types";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { currentKpiMonth } from "@/lib/interactions/settings";
import { RatioBar } from "@/app/(app)/admin/ratio-bar";
import { SlaBreachSection } from "@/app/(app)/admin/sla-breach-section";
import {
  SlaReviewView,
  type SlaReviewRow,
} from "@/app/(app)/admin/sla-review/sla-review-view";
import { ActiveToggle } from "@/app/(app)/admin/active-toggle";
import { UserDialog } from "@/app/(app)/admin/users/user-dialog";
import { ResetPasswordDialog } from "@/app/(app)/admin/users/reset-password-dialog";
import { setUserActive } from "@/app/(app)/admin/users/actions";
import { SettingCard } from "@/app/(app)/admin/settings/setting-card";
import { AdsCostCleanupCard } from "@/app/(app)/admin/settings/ads-cost-cleanup-card";
import { KpiTargetCard } from "@/app/(app)/admin/settings/kpi-target-card";
import { AdminMonitoringTabs } from "@/app/(app)/admin/monitoring/admin-monitoring-tabs";

const WINDOW_DAYS = 7;

// Danh sách cố định — đúng các tham số thật sự được lib/interactions/settings.ts
// đọc (fallback về default nếu DB chưa có dòng nào). Không làm CRUD key/value
// tự do vì thêm 1 key lạ sẽ không được code nào đọc tới, gây hiểu lầm là có
// tác dụng.
const DUPLICATE_SETTINGS = [
  {
    configGroup: "duplicate",
    key: "DUP_WINDOW_HOURS",
    label: "Cửa sổ chống trùng liên hệ (giờ)",
    description:
      "Nếu cùng 1 khách (cùng Link chuẩn) nhắn lại trong khoảng thời gian này, hệ thống cảnh báo nghi trùng khi Sale tạo liên hệ mới.",
    fallback: "24",
  },
];

const SPAM_FOLLOWUP_SETTINGS = [
  {
    configGroup: "system",
    key: "SPAM_NO_REPLY_MIN_ATTEMPTS",
    label: "Số lần chăm sóc tối thiểu trước khi đóng Spam vì im lặng",
    description:
      'Sale phải bấm "Ghi nhận đã liên hệ" đủ số lần này, ở các ngày khác nhau, mới được đóng Spam với lý do khách im lặng.',
    fallback: "3",
  },
  {
    configGroup: "system",
    key: "MAX_FOLLOWUP_BEFORE_SPAM",
    label: "Số lần chăm sóc lại tối đa trước khi tự động chuyển Spam",
    description:
      'Mỗi lần Sale bấm "Đánh dấu đã xử lý" cho yêu cầu "Chăm sóc lại" của Marketing sẽ được đếm dồn cho liên hệ đó. Vượt quá số lần này mà liên hệ vẫn chưa đổi trạng thái, hệ thống tự động chuyển sang Spam.',
    fallback: "3",
  },
];

// Tách riêng khỏi component vì gọi Date.now() trực tiếp trong thân component
// bị react-hooks/purity gắn cờ (không idempotent giữa các lần render).
function filterSlaOverdue<
  T extends { assignedBranchCode: string; createdLeadAt: Date },
>(rows: T[], slaMap: { byCode: Map<string, BranchSla>; fallback: BranchSla }) {
  const now = Date.now();
  return rows.filter((r) => {
    const sla = slaMap.byCode.get(r.assignedBranchCode) ?? slaMap.fallback;
    const cutoff = now - sla.slaReceiveMinutes * 60_000;
    return r.createdLeadAt.getTime() <= cutoff;
  });
}

function reasonLabel(code: string | null) {
  if (code === SPAM_REASON.MAX_FOLLOWUP_EXCEEDED)
    return "Hệ thống tự động (vượt số lần chăm sóc lại cho phép)";
  return (
    SPAM_REASON_OPTIONS.find((r) => r.code === code)?.label ??
    code ??
    "Không rõ (không tìm thấy nhật ký)"
  );
}

function SettingsSubheading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3">
      <h3 className="font-condensed text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground/80">{description}</p>
    </div>
  );
}

export default async function AdminMonitoringPage() {
  const admin = await requireRole(ROLES.ADMIN);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  windowStart.setHours(0, 0, 0, 0);

  const [
    branches,
    sales,
    createdCounts,
    closedGroups,
    spamInteractions,
    queue,
    slaMap,
    allWaiting,
    users,
    settingRows,
  ] = await Promise.all([
    prisma.branch.findMany({
      select: { code: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: ROLES.SALES, active: true },
      select: { email: true, fullName: true, branchCode: true },
    }),
    prisma.interaction.groupBy({
      by: ["createdByEmail"],
      where: { createdLeadAt: { gte: windowStart } },
      _count: { _all: true },
    }),
    prisma.interaction.groupBy({
      by: ["updatedByEmail", "statusName"],
      where: {
        closedAt: { gte: windowStart },
        statusName: { in: [STATUS.PHONE, STATUS.SPAM] },
        updatedByEmail: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.interaction.findMany({
      where: { statusName: STATUS.SPAM, closedAt: { gte: windowStart } },
      orderBy: { closedAt: "desc" },
      select: {
        interactionId: true,
        customerName: true,
        fanpageName: true,
        assignedBranchCode: true,
        touchCount: true,
        closedAt: true,
        updatedBy: { select: { fullName: true } },
      },
    }),
    getQueue(admin),
    getBranchSlaMap(),
    prisma.interaction.findMany({
      where: { activeFlag: true, statusName: STATUS.WAITING },
      include: {
        ...listItemInclude,
        slaFlaggedBy: { select: { fullName: true } },
      },
      orderBy: { createdLeadAt: "asc" },
    }),
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { fullName: "asc" }],
      select: {
        email: true,
        fullName: true,
        role: true,
        active: true,
        viewAllBranches: true,
        canCloseMktReport: true,
        mustChangePassword: true,
        note: true,
        branchCode: true,
        branch: { select: { name: true } },
      },
    }),
    prisma.appSetting.findMany(),
  ]);

  const branchNameByCode = new Map(branches.map((b) => [b.code, b.name]));

  // --- Giám sát hoạt động -----------------------------------------------
  const createdByEmail = new Map(
    createdCounts.map((r) => [r.createdByEmail, r._count._all]),
  );
  const qualifiedByEmail = new Map<string, number>();
  const spamByEmail = new Map<string, number>();
  for (const row of closedGroups) {
    if (!row.updatedByEmail) continue;
    if (row.statusName === STATUS.PHONE)
      qualifiedByEmail.set(row.updatedByEmail, row._count._all);
    if (row.statusName === STATUS.SPAM)
      spamByEmail.set(row.updatedByEmail, row._count._all);
  }
  const perfRows = sales
    .map((s) => {
      const created = createdByEmail.get(s.email) ?? 0;
      const qualified = qualifiedByEmail.get(s.email) ?? 0;
      const spam = spamByEmail.get(s.email) ?? 0;
      return { ...s, created, qualified, spam };
    })
    .sort((a, b) => b.spam - a.spam || b.created - a.created);

  // Lấy đúng lý do Spam gần nhất của mỗi liên hệ từ nhật ký hệ thống — Interaction
  // không lưu trực tiếp spamReason, chỉ SystemLog (detailNew) mới có.
  const spamIds = spamInteractions.map((i) => i.interactionId);
  const logs = spamIds.length
    ? await prisma.systemLog.findMany({
        where: {
          interactionId: { in: spamIds },
          action: SYSTEM_LOG_ACTION.UPDATE_RESULT,
        },
        orderBy: { loggedAt: "desc" },
        select: { interactionId: true, detailNew: true, technicalInfo: true },
      })
    : [];
  const reasonByInteraction = new Map<
    string,
    { code: string | null; note: string | null }
  >();
  for (const log of logs) {
    if (!log.interactionId || reasonByInteraction.has(log.interactionId))
      continue;
    const detail = log.detailNew as {
      status?: string;
      spamReason?: string;
    } | null;
    if (detail?.status === STATUS.SPAM) {
      reasonByInteraction.set(log.interactionId, {
        code: detail.spamReason ?? null,
        note: log.technicalInfo,
      });
    }
  }

  const slaBreaching =
    queue.groups.find((g) => g.key === "sla_breaching")?.items ?? [];

  // --- Rà soát SLA --------------------------------------------------------
  // Ngưỡng khác nhau theo từng cơ sở (Branch.slaReceiveMinutes) nên không thể
  // lọc bằng 1 WHERE ngày duy nhất — lấy toàn bộ liên hệ đang Chờ rồi so với
  // ngưỡng riêng của cơ sở đó trong JS (mirror getQueue() ở lib/interactions/queries.ts).
  const slaRows = filterSlaOverdue(allWaiting, slaMap);
  const slaItems: SlaReviewRow[] = slaRows.map((r) => ({
    ...toListItem(r),
    slaFlagged: r.slaFlagged,
    slaFlaggedAt: r.slaFlaggedAt?.toISOString() ?? null,
    slaFlaggedByName: r.slaFlaggedBy?.fullName ?? null,
  }));
  const slaUnflaggedCount = slaItems.filter((i) => !i.slaFlagged).length;

  // --- Cấu hình hệ thống ---------------------------------------------------
  const valueByKey = new Map(
    settingRows.map((r) => [`${r.configGroup}.${r.key}`, r.value]),
  );
  const adsCostCleanupEnabled =
    valueByKey.get("system.ADS_COST_CLEANUP_ENABLED") === "true";
  const kpiTargets = Object.fromEntries(
    settingRows
      .filter((r) => r.configGroup === "kpi")
      .map((r) => [r.key, r.value]),
  );

  const monitoringPanel = (
    <>
      <div className="flex flex-col gap-6">
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-3.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Cần review — đóng Spam gần đây
              </h3>
              <p className="text-xs text-muted-foreground">
                Đối chiếu lý do đóng Spam với số lần chăm sóc trước khi tin
                tưởng
              </p>
            </div>
            <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {spamInteractions.length}
            </span>
          </div>

          {spamInteractions.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Không có Spam nào trong khoảng này"
              description="Chưa ghi nhận liên hệ nào bị đóng Spam gần đây."
            />
          ) : (
            <Table>
              <TableHeader className="bg-secondary/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Khách hàng
                  </TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Cơ sở
                  </TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">
                    Sale đóng
                  </TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Lý do
                  </TableHead>
                  <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">
                    Lần chăm sóc
                  </TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">
                    Đóng lúc
                  </TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {spamInteractions.map((item) => {
                  const reason = reasonByInteraction.get(item.interactionId);
                  return (
                    <TableRow
                      key={item.interactionId}
                      className="odd:bg-secondary/10"
                    >
                      <TableCell className="min-w-40 px-5 py-3.5">
                        <p className="truncate font-medium text-foreground">
                          {item.customerName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.fanpageName}
                        </p>
                      </TableCell>
                      <TableCell className="px-4 text-sm text-muted-foreground">
                        {branchNameByCode.get(item.assignedBranchCode) ??
                          item.assignedBranchCode}
                      </TableCell>
                      <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                        {item.updatedBy?.fullName ?? "—"}
                      </TableCell>
                      <TableCell className="px-4">
                        <p className="max-w-52 text-sm text-foreground">
                          {reasonLabel(reason?.code ?? null)}
                        </p>
                        {reason?.note && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {reason.note}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="hidden px-4 text-center font-mono text-sm text-muted-foreground md:table-cell">
                        {item.touchCount}
                      </TableCell>
                      <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">
                        {item.closedAt
                          ? formatDateTime(item.closedAt.toISOString())
                          : "—"}
                      </TableCell>
                      <TableCell className="pr-4 pl-1">
                        <Link
                          href={`/leads/${item.interactionId}`}
                          className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="Xem chi tiết"
                        >
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <SlaBreachSection
          items={slaBreaching}
          branchNames={Object.fromEntries(branchNameByCode)}
        />

        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-3.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Users2 className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                So sánh hiệu suất Sale
              </h3>
              <p className="text-xs text-muted-foreground">
                Sắp xếp theo số lần đóng Spam giảm dần — dễ phát hiện bất thường
              </p>
            </div>
            <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {perfRows.length}
            </span>
          </div>

          {perfRows.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="Chưa có Sale nào"
              description="Thêm tài khoản Sale/Admin ở section Người dùng bên dưới."
            />
          ) : (
            <Table>
              <TableHeader className="bg-secondary/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Sale
                  </TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">
                    Cơ sở
                  </TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Tạo mới
                  </TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Đủ tiêu chuẩn
                  </TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Spam
                  </TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                    Tỷ lệ đủ tiêu chuẩn
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perfRows.map((row) => (
                  <TableRow key={row.email} className="odd:bg-secondary/10">
                    <TableCell className="min-w-40 px-5 py-3.5">
                      <p className="truncate font-medium text-foreground">
                        {row.fullName}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {row.email}
                      </p>
                    </TableCell>
                    <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                      {row.branchCode
                        ? (branchNameByCode.get(row.branchCode) ??
                          row.branchCode)
                        : "—"}
                    </TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-foreground">
                      {row.created}
                    </TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">
                      {row.qualified}
                    </TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-status-spam">
                      {row.spam}
                    </TableCell>
                    <TableCell className="px-4">
                      <RatioBar qualified={row.qualified} spam={row.spam} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </>
  );

  const slaPanel = (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Liên hệ vẫn chưa được liên hệ (còn ở trạng thái Chờ) quá &quot;SLA
        nhận&quot; của cơ sở phụ trách. Ngưỡng chỉnh theo từng cơ sở ở
        &quot;Danh mục&quot;.
      </p>

      {slaItems.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Không có liên hệ nào quá hạn"
          description="Mọi liên hệ mới đều đang trong ngưỡng SLA hiện tại."
        />
      ) : (
        <SlaReviewView
          items={slaItems}
          unflaggedCount={slaUnflaggedCount}
          branchNames={Object.fromEntries(branchNameByCode)}
        />
      )}
    </>
  );

  const usersPanel = (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Tài khoản nội bộ, vai trò và cơ sở phụ trách.
        </p>
        <UserDialog mode="create" branchOptions={branches} />
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Chưa có người dùng nào"
          description="Thêm người dùng để phân quyền theo cơ sở và vai trò."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">
                {users.length}
              </strong>{" "}
              người dùng
            </p>
          </div>
          <Table className="sm:min-w-[820px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                  Người dùng
                </TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                  Vai trò
                </TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">
                  Cơ sở
                </TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">
                  Mật khẩu
                </TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">
                  Hoạt động
                </TableHead>
                <TableHead className="w-20 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.email} className="odd:bg-secondary/10">
                  <TableCell className="min-w-56 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {user.fullName}
                          {user.email === admin.email && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              (bạn)
                            </span>
                          )}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-sm text-foreground">
                    {user.role}
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                    {user.viewAllBranches
                      ? "Tất cả"
                      : (user.branch?.name ?? "—")}
                  </TableCell>
                  <TableCell className="hidden px-4 md:table-cell">
                    {user.mustChangePassword ? (
                      <Badge variant="secondary">Mặc định — cần đổi</Badge>
                    ) : (
                      <Badge variant="outline">Đã đổi</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <ActiveToggle
                      active={user.active}
                      entityKey={user.email}
                      action={setUserActive}
                    />
                  </TableCell>
                  <TableCell className="flex items-center gap-1 pr-4 pl-1">
                    <ResetPasswordDialog
                      email={user.email}
                      fullName={user.fullName}
                    />
                    <UserDialog
                      mode="edit"
                      user={{
                        email: user.email,
                        fullName: user.fullName,
                        role: user.role,
                        branchCode: user.branchCode,
                        viewAllBranches: user.viewAllBranches,
                        canCloseMktReport: user.canCloseMktReport,
                        note: user.note,
                      }}
                      branchOptions={branches}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );

  const settingsPanel = (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Chỉ tiêu KPI, tham số vận hành và quy tắc chống trùng liên hệ.
      </p>

      <div className="flex flex-col gap-8">
        <div>
          <SettingsSubheading
            title="Chỉ tiêu KPI"
            description="Mục tiêu kinh doanh theo từng tháng."
          />
          <KpiTargetCard
            currentMonth={currentKpiMonth()}
            savedTargets={kpiTargets}
          />
        </div>

        <div>
          <SettingsSubheading
            title="Chống trùng liên hệ"
            description="Quy tắc phát hiện khách nhắn lại/trùng lặp."
          />
          <div className="flex flex-col gap-4">
            {DUPLICATE_SETTINGS.map((s) => {
              const mapKey = `${s.configGroup}.${s.key}`;
              const stored = valueByKey.get(mapKey);
              return (
                <SettingCard
                  key={mapKey}
                  configGroup={s.configGroup}
                  settingKey={s.key}
                  label={s.label}
                  description={s.description}
                  initialValue={stored ?? s.fallback}
                  isDefault={stored === undefined}
                />
              );
            })}
          </div>
        </div>

        <div>
          <SettingsSubheading
            title="Spam & chăm sóc lại"
            description="Ngưỡng tự động chuyển Spam khi khách im lặng."
          />
          <div className="flex flex-col gap-4">
            {SPAM_FOLLOWUP_SETTINGS.map((s) => {
              const mapKey = `${s.configGroup}.${s.key}`;
              const stored = valueByKey.get(mapKey);
              return (
                <SettingCard
                  key={mapKey}
                  configGroup={s.configGroup}
                  settingKey={s.key}
                  label={s.label}
                  description={s.description}
                  initialValue={stored ?? s.fallback}
                  isDefault={stored === undefined}
                />
              );
            })}
          </div>
        </div>

        <div>
          <SettingsSubheading
            title="Vận hành khác"
            description="Bật/tắt các chức năng phụ trợ."
          />
          <AdsCostCleanupCard initialEnabled={adsCostCleanupEnabled} />
        </div>
      </div>
    </>
  );

  return (
    <AdminMonitoringTabs
      monitoringPanel={monitoringPanel}
      slaPanel={slaPanel}
      usersPanel={usersPanel}
      settingsPanel={settingsPanel}
    />
  );
}
