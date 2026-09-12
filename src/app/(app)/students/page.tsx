import Link from "next/link";
import { AlertTriangle, GraduationCap } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { CAN_CREATE_OR_EDIT_LEAD, STUDENT_STAGE, STUDENT_STAGE_VALUES } from "@/lib/interactions/constants";
import { getStudentProfilesForActor, getTodayTasksForActor } from "@/lib/students/queries";
import { StageBadge } from "@/app/(app)/students/stage-badge";
import { StageCountStrip } from "@/app/(app)/students/stage-count-strip";

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function StudentsPage() {
  const actor = await requireRole(...CAN_CREATE_OR_EDIT_LEAD);
  const [profiles, todayTasks] = await Promise.all([getStudentProfilesForActor(actor), getTodayTasksForActor(actor)]);

  const total = profiles.length;
  const enrolled = profiles.filter((p) => p.stage === STUDENT_STAGE.ENROLLED).length;
  const conversionRate = total > 0 ? Math.round((enrolled / total) * 1000) / 10 : 0;

  // Đếm số học viên đang dừng ở mỗi mốc — giúp Sale biết ngay cần ưu tiên gọi
  // cho ai trước (đặc biệt "Chưa gọi" — chưa hề bắt đầu tư vấn).
  const stageCounts: { label: string; count: number }[] = [
    { label: "Chưa gọi", count: profiles.filter((p) => !p.stage).length },
    ...STUDENT_STAGE_VALUES.map((stage) => ({
      label: stage,
      count: profiles.filter((p) => p.stage === stage).length,
    })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Học viên đang tư vấn"
        description="Theo dõi tiến trình gọi điện tư vấn ghi danh từng học viên."
        action={
          total > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              <KpiCard label="Tổng học viên" value={total} accentClassName="bg-foreground/50" />
              <KpiCard label="Đã chốt" value={enrolled} accentClassName="bg-status-qualified" />
              <KpiCard label="Tỷ lệ chốt" value={`${conversionRate}%`} accentClassName="bg-status-received" />
            </div>
          ) : undefined
        }
      />

      {todayTasks.length > 0 && (
        <div className="shadow-bubble mb-6 overflow-hidden rounded-2xl border border-status-received/30 bg-status-received-bg/30">
          <div className="flex items-center gap-2 border-b border-status-received/20 px-5 py-3">
            <AlertTriangle className="size-4 text-status-received" />
            <h2 className="font-heading text-sm font-semibold text-foreground">Việc cần làm hôm nay</h2>
            <span className="rounded-full bg-status-received/15 px-2 py-0.5 font-mono text-xs font-semibold text-status-received">
              {todayTasks.length}
            </span>
          </div>
          <ul className="divide-y divide-status-received/15">
            {todayTasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/students/${t.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 transition-colors hover:bg-status-received-bg/50"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{t.studentName}</span>
                    <span className="font-mono text-xs text-muted-foreground">{t.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StageBadge stage={t.stage} />
                    <span
                      className={`text-xs font-medium ${
                        t.kind === "overdue_appointment" || t.kind === "overdue_case" ? "text-destructive" : "text-status-received"
                      }`}
                    >
                      {t.reason}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {total > 0 && <StageCountStrip counts={stageCounts} />}

      {profiles.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Chưa có học viên nào được phân bổ"
          description="Học viên sẽ xuất hiện ở đây sau khi Leader phân bổ liên hệ đủ điều kiện cho bạn."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{profiles.length}</strong> học viên
            </p>
          </div>
          <Table className="sm:min-w-[760px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Học viên</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">SĐT</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Tư vấn viên</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tiến trình</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase lg:table-cell">Chăm sóc gần nhất</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Phân bổ lúc</TableHead>
                <TableHead className="w-10 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id} className="cursor-pointer odd:bg-secondary/10 hover:bg-status-received-bg/45">
                  <TableCell className="min-w-48 px-5 py-4">
                    <Link href={`/students/${p.id}`} className="block">
                      <p className="max-w-56 truncate font-medium text-foreground">{p.studentName}</p>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden px-4 font-mono text-xs text-muted-foreground sm:table-cell">{p.phone}</TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">{p.assignedTo.fullName}</TableCell>
                  <TableCell className="px-4">
                    <StageBadge stage={p.stage} />
                  </TableCell>
                  <TableCell className="hidden px-4 text-xs lg:table-cell">
                    {p.careLogs[0] ? (
                      <span className="text-muted-foreground">{formatDate(p.careLogs[0].loggedAt)}</span>
                    ) : (
                      <span className="font-medium text-status-received">Chưa gọi</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden px-4 text-xs text-muted-foreground xl:table-cell">{formatDate(p.assignedAt)}</TableCell>
                  <TableCell className="pr-4 pl-1 text-right">
                    <Link href={`/students/${p.id}`} className="text-xs font-medium text-status-received hover:underline">
                      Xem
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
