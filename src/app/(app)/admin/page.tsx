import Link from "next/link";
import { AlertTriangle, ChevronRight, ShieldCheck, Users2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/dal";
import { ROLES, SPAM_REASON, STATUS, SYSTEM_LOG_ACTION } from "@/lib/interactions/constants";
import { getQueue } from "@/lib/interactions/queries";
import { SPAM_REASON_OPTIONS } from "@/app/(app)/leads/types";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { RatioBar } from "@/app/(app)/admin/ratio-bar";
import { SlaBreachSection } from "@/app/(app)/admin/sla-breach-section";

const WINDOW_DAYS = 7;

function reasonLabel(code: string | null) {
  if (code === SPAM_REASON.MAX_FOLLOWUP_EXCEEDED) return "Hệ thống tự động (vượt số lần chăm sóc lại cho phép)";
  return SPAM_REASON_OPTIONS.find((r) => r.code === code)?.label ?? code ?? "Không rõ (không tìm thấy nhật ký)";
}

export default async function AdminOverviewPage() {
  const admin = await requireRole(ROLES.ADMIN);

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - WINDOW_DAYS);
  windowStart.setHours(0, 0, 0, 0);

  const [branches, sales, createdCounts, closedGroups, spamInteractions, queue] = await Promise.all([
    prisma.branch.findMany({ select: { code: true, name: true } }),
    prisma.user.findMany({ where: { role: ROLES.SALES, active: true }, select: { email: true, fullName: true, branchCode: true } }),
    prisma.interaction.groupBy({ by: ["createdByEmail"], where: { createdLeadAt: { gte: windowStart } }, _count: { _all: true } }),
    prisma.interaction.groupBy({
      by: ["updatedByEmail", "statusName"],
      where: { closedAt: { gte: windowStart }, statusName: { in: [STATUS.PHONE, STATUS.SPAM] }, updatedByEmail: { not: null } },
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
  ]);

  const branchNameByCode = new Map(branches.map((b) => [b.code, b.name]));

  const createdByEmail = new Map(createdCounts.map((r) => [r.createdByEmail, r._count._all]));
  const qualifiedByEmail = new Map<string, number>();
  const spamByEmail = new Map<string, number>();
  for (const row of closedGroups) {
    if (!row.updatedByEmail) continue;
    if (row.statusName === STATUS.PHONE) qualifiedByEmail.set(row.updatedByEmail, row._count._all);
    if (row.statusName === STATUS.SPAM) spamByEmail.set(row.updatedByEmail, row._count._all);
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
        where: { interactionId: { in: spamIds }, action: SYSTEM_LOG_ACTION.UPDATE_RESULT },
        orderBy: { loggedAt: "desc" },
        select: { interactionId: true, detailNew: true, technicalInfo: true },
      })
    : [];
  const reasonByInteraction = new Map<string, { code: string | null; note: string | null }>();
  for (const log of logs) {
    if (!log.interactionId || reasonByInteraction.has(log.interactionId)) continue;
    const detail = log.detailNew as { status?: string; spamReason?: string } | null;
    if (detail?.status === STATUS.SPAM) {
      reasonByInteraction.set(log.interactionId, { code: detail.spamReason ?? null, note: log.technicalInfo });
    }
  }

  const slaBreaching = queue.groups.find((g) => g.key === "sla_breaching")?.items ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Giám sát hệ thống"
        description={`Đối chiếu hoạt động Sale và phát hiện bất thường — số liệu trong ${WINDOW_DAYS} ngày gần nhất.`}
      />

      <div className="flex flex-col gap-6">
        <section className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-3.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Cần review — đóng Spam gần đây</h2>
              <p className="text-xs text-muted-foreground">Đối chiếu lý do đóng Spam với số lần chăm sóc trước khi tin tưởng</p>
            </div>
            <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">{spamInteractions.length}</span>
          </div>

          {spamInteractions.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Không có Spam nào trong khoảng này" description="Chưa ghi nhận liên hệ nào bị đóng Spam gần đây." />
          ) : (
            <Table>
              <TableHeader className="bg-secondary/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Cơ sở</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Sale đóng</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Lý do</TableHead>
                  <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Lần chăm sóc</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Đóng lúc</TableHead>
                  <TableHead className="w-10 pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {spamInteractions.map((item) => {
                  const reason = reasonByInteraction.get(item.interactionId);
                  return (
                    <TableRow key={item.interactionId} className="odd:bg-secondary/10">
                      <TableCell className="min-w-40 px-5 py-3.5">
                        <p className="truncate font-medium text-foreground">{item.customerName}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.fanpageName}</p>
                      </TableCell>
                      <TableCell className="px-4 text-sm text-muted-foreground">{branchNameByCode.get(item.assignedBranchCode) ?? item.assignedBranchCode}</TableCell>
                      <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{item.updatedBy?.fullName ?? "—"}</TableCell>
                      <TableCell className="px-4">
                        <p className="max-w-52 text-sm text-foreground">{reasonLabel(reason?.code ?? null)}</p>
                        {reason?.note && <p className="mt-0.5 text-xs text-muted-foreground">{reason.note}</p>}
                      </TableCell>
                      <TableCell className="hidden px-4 text-center font-mono text-sm text-muted-foreground md:table-cell">{item.touchCount}</TableCell>
                      <TableCell className="hidden px-4 text-xs text-muted-foreground lg:table-cell">{item.closedAt ? formatDateTime(item.closedAt.toISOString()) : "—"}</TableCell>
                      <TableCell className="pr-4 pl-1">
                        <Link href={`/leads/${item.interactionId}`} className="flex items-center justify-center text-muted-foreground hover:text-foreground" aria-label="Xem chi tiết">
                          <ChevronRight className="size-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </section>

        <SlaBreachSection items={slaBreaching} branchNames={Object.fromEntries(branchNameByCode)} />

        <section className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center gap-2.5 border-b border-border/70 px-5 py-3.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Users2 className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">So sánh hiệu suất Sale</h2>
              <p className="text-xs text-muted-foreground">Sắp xếp theo số lần đóng Spam giảm dần — dễ phát hiện bất thường</p>
            </div>
            <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">{perfRows.length}</span>
          </div>

          {perfRows.length === 0 ? (
            <EmptyState icon={Users2} title="Chưa có Sale nào" description="Thêm tài khoản Sale/Admin ở trang Người dùng." />
          ) : (
            <Table>
              <TableHeader className="bg-secondary/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Sale</TableHead>
                  <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Cơ sở</TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tạo mới</TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đủ tiêu chuẩn</TableHead>
                  <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Spam</TableHead>
                  <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ đủ tiêu chuẩn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perfRows.map((row) => (
                  <TableRow key={row.email} className="odd:bg-secondary/10">
                    <TableCell className="min-w-40 px-5 py-3.5">
                      <p className="truncate font-medium text-foreground">{row.fullName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{row.email}</p>
                    </TableCell>
                    <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">{row.branchCode ? (branchNameByCode.get(row.branchCode) ?? row.branchCode) : "—"}</TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-foreground">{row.created}</TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-status-qualified">{row.qualified}</TableCell>
                    <TableCell className="px-4 text-center font-mono text-sm text-status-spam">{row.spam}</TableCell>
                    <TableCell className="px-4">
                      <RatioBar qualified={row.qualified} spam={row.spam} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>
    </>
  );
}
