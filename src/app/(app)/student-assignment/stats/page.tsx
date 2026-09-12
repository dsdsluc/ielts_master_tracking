import Link from "next/link";
import { X, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { CAN_REASSIGN, STUDENT_STAGE_VALUES } from "@/lib/interactions/constants";
import { computeStudentStats } from "@/lib/students/stats";
import { StageCountStrip } from "@/app/(app)/students/stage-count-strip";
import { StatsFilterBar } from "@/app/(app)/student-assignment/stats/stats-filter-bar";

const DAYS_OPTIONS = [7, 30, 90];
const NOT_CALLED_LABEL = "Chưa gọi";
const VALID_STAGE_LABELS: string[] = [NOT_CALLED_LABEL, ...STUDENT_STAGE_VALUES];

function ratePillClass(rate: number) {
  if (rate >= 30) return "bg-status-qualified-bg text-status-qualified";
  if (rate >= 10) return "bg-status-received-bg text-status-received";
  return "bg-secondary text-muted-foreground";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default async function StudentStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; stage?: string; sale?: string }>;
}) {
  const actor = await requireRole(...CAN_REASSIGN);
  const { days: daysParam, stage: stageParam, sale: saleParam } = await searchParams;
  const days = DAYS_OPTIONS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  const stats = await computeStudentStats(actor, days);

  const selectedStage = stageParam && VALID_STAGE_LABELS.includes(stageParam) ? stageParam : null;
  const selectedSale = saleParam ? (stats.saleRanking.find((r) => r.email === saleParam) ?? null) : null;

  function buildHref(overrides: { stage?: string; sale?: string }) {
    const params = new URLSearchParams({ days: String(days) });
    const stageValue = overrides.stage !== undefined ? overrides.stage : (selectedStage ?? "");
    const saleValue = overrides.sale !== undefined ? overrides.sale : (selectedSale?.email ?? "");
    if (stageValue) params.set("stage", stageValue);
    if (saleValue) params.set("sale", saleValue);
    return `/student-assignment/stats?${params.toString()}`;
  }
  const stageHref = (label: string) => buildHref({ stage: label });
  const saleHref = (email: string) => buildHref({ sale: email });

  const filtered = stats.profiles.filter(
    (p) =>
      (!selectedStage || (selectedStage === NOT_CALLED_LABEL ? !p.stage : p.stage === selectedStage)) &&
      (!selectedSale || p.assignedToEmail === selectedSale.email)
  );

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Thống kê tư vấn học viên"
        description="Hiệu quả tư vấn ghi danh của toàn đội Sale — Sale nào đang làm tốt, đa số hồ sơ đang kẹt ở mốc nào, ai chưa được chăm sóc."
        action={<StatsFilterBar />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Tổng học viên" value={stats.total} accentClassName="bg-foreground/50" />
        <KpiCard label="Đã chốt" value={stats.enrolled} accentClassName="bg-status-qualified" />
        <KpiCard label="Tỷ lệ chốt chung" value={`${stats.conversionRate}%`} accentClassName="bg-status-received" />
        <KpiCard label="Sale đang tư vấn" value={stats.saleCount} accentClassName="bg-status-waiting" />
        <KpiCard label="Chưa có hoạt động chăm sóc" value={stats.totalNoActivity} accentClassName="bg-destructive" />
        <KpiCard label="Tổng lượt chăm sóc" value={stats.totalCareLogs} accentClassName="bg-foreground/30" />
      </div>

      {stats.total === 0 ? (
        <EmptyState
          icon={Users}
          title="Chưa có dữ liệu trong khoảng thời gian này"
          description="Thử chọn khoảng thời gian dài hơn, hoặc kiểm tra lại đã có học viên nào được phân bổ chưa."
        />
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <h2 className="mb-2 font-condensed text-xs font-semibold tracking-wide text-foreground uppercase">
              Phân bố theo mốc tư vấn — bấm vào 1 mốc để xem danh sách
            </h2>
            <StageCountStrip counts={stats.stageCounts} getHref={stageHref} selected={selectedStage} />
          </div>

          {(selectedStage || selectedSale) && (
            <Card className="gap-0 py-0">
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5">
                <CardTitle className="text-sm">
                  {selectedStage && <>Mốc &quot;{selectedStage}&quot;</>}
                  {selectedStage && selectedSale && " · "}
                  {selectedSale && <>Tư vấn viên: {selectedSale.fullName}</>}
                  {" "}({filtered.length})
                </CardTitle>
                <div className="flex items-center gap-3">
                  {selectedStage && (
                    <Link href={buildHref({ stage: "" })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <X className="size-3" /> Bỏ lọc mốc
                    </Link>
                  )}
                  {selectedSale && (
                    <Link href={buildHref({ sale: "" })} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <X className="size-3" /> Bỏ lọc Sale
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-0 py-0">
                {filtered.length === 0 ? (
                  <p className="p-5 text-center text-sm text-muted-foreground">Không có học viên nào khớp bộ lọc.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Học viên</TableHead>
                        <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                        <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Số lượt chăm sóc</TableHead>
                        <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Phân bổ lúc</TableHead>
                        <TableHead className="w-10 pr-4" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((p) => (
                        <TableRow key={p.id} className="odd:bg-secondary/10">
                          <TableCell className="min-w-40 px-5 py-3">
                            <p className="max-w-48 truncate font-medium text-foreground">{p.studentName}</p>
                          </TableCell>
                          <TableCell className="px-4 text-sm text-muted-foreground">{p.assignedToName}</TableCell>
                          <TableCell className="hidden px-4 text-center font-mono text-sm sm:table-cell">
                            <span className={p.careLogCount === 0 ? "text-destructive" : "text-muted-foreground"}>{p.careLogCount}</span>
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
                )}
              </CardContent>
            </Card>
          )}

          <Card className="gap-0 py-0">
            <CardHeader className="border-b border-border/70 px-5 py-3.5">
              <CardTitle className="text-sm">Hiệu suất theo Tư vấn viên</CardTitle>
              <CardDescription>Bấm vào tên để xem danh sách học viên của Sale đó — có thể chuyển giao từng học viên từ trang chi tiết.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto px-0 py-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tổng</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã chốt</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tỷ lệ chốt</TableHead>
                    <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Không quan tâm</TableHead>
                    <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Đang xử lý</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chưa gọi</TableHead>
                    <TableHead className="px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Chưa có hoạt động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.saleRanking.map((row) => (
                    <TableRow key={row.email} className="odd:bg-secondary/10">
                      <TableCell className="px-5 py-3">
                        <Link
                          href={saleHref(selectedSale?.email === row.email ? "" : row.email)}
                          className={`font-medium hover:underline ${selectedSale?.email === row.email ? "text-status-received" : "text-foreground"}`}
                        >
                          {row.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-muted-foreground">{row.total}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm text-foreground">{row.enrolled}</TableCell>
                      <TableCell className="px-4 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium ${ratePillClass(row.conversionRate)}`}>
                          {row.conversionRate}%
                        </span>
                      </TableCell>
                      <TableCell className="hidden px-4 text-center font-mono text-sm text-muted-foreground sm:table-cell">{row.notInterested}</TableCell>
                      <TableCell className="hidden px-4 text-center font-mono text-sm text-muted-foreground sm:table-cell">{row.inProgress}</TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm">
                        <span className={row.notCalled > 0 ? "text-status-waiting" : "text-muted-foreground"}>{row.notCalled}</span>
                      </TableCell>
                      <TableCell className="px-4 text-center font-mono text-sm">
                        <span className={row.noActivity > 0 ? "text-destructive" : "text-muted-foreground"}>{row.noActivity}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {stats.overdueAppointments.length > 0 && (
            <Card className="gap-0 py-0 border-destructive/40">
              <CardHeader className="border-b border-border/70 px-5 py-3.5">
                <CardTitle className="text-sm">Quá hẹn test/học thử chưa cập nhật kết quả</CardTitle>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Học viên</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Mốc</TableHead>
                      <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Ngày hẹn</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trễ</TableHead>
                      <TableHead className="w-10 pr-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.overdueAppointments.map((row) => (
                      <TableRow key={row.id} className="odd:bg-secondary/10">
                        <TableCell className="min-w-40 px-5 py-3">
                          <p className="max-w-48 truncate font-medium text-foreground">{row.studentName}</p>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-muted-foreground">{row.assignedToName}</TableCell>
                        <TableCell className="px-4 text-sm text-muted-foreground">{row.stage}</TableCell>
                        <TableCell className="hidden px-4 text-xs text-muted-foreground sm:table-cell">{formatDate(row.appointmentAt)}</TableCell>
                        <TableCell className="px-4 text-sm">
                          <span className="text-destructive">{row.overdueDays === 0 ? "Hôm nay" : `${row.overdueDays} ngày`}</span>
                        </TableCell>
                        <TableCell className="pr-4 pl-1 text-right">
                          <Link href={`/students/${row.id}`} className="text-xs font-medium text-status-received hover:underline">
                            Xem
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {stats.casesNeedingSupport.length > 0 && (
            <Card className="gap-0 py-0 border-destructive/40">
              <CardHeader className="border-b border-border/70 px-5 py-3.5">
                <CardTitle className="text-sm">Case cần Leader hỗ trợ</CardTitle>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Học viên</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Lý do</TableHead>
                      <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Deadline</TableHead>
                      <TableHead className="w-10 pr-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.casesNeedingSupport.map((row) => (
                      <TableRow key={row.id} className="odd:bg-secondary/10">
                        <TableCell className="min-w-40 px-5 py-3">
                          <p className="max-w-48 truncate font-medium text-foreground">{row.studentName}</p>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-muted-foreground">{row.assignedToName}</TableCell>
                        <TableCell className="px-4 text-sm text-foreground">
                          <p className="max-w-64 truncate">{row.stageReason || "—"}</p>
                        </TableCell>
                        <TableCell className="hidden px-4 text-xs sm:table-cell">
                          {row.caseDeadline ? (
                            <span className={row.overdueDays !== null && row.overdueDays > 0 ? "text-destructive" : "text-muted-foreground"}>
                              {formatDate(row.caseDeadline)}
                              {row.overdueDays !== null && row.overdueDays > 0 ? ` (trễ ${row.overdueDays}d)` : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 pl-1 text-right">
                          <Link href={`/students/${row.id}`} className="text-xs font-medium text-status-received hover:underline">
                            Xem
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {stats.neglected.length > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b border-border/70 px-5 py-3.5">
                <CardTitle className="text-sm">Học viên chưa có hoạt động chăm sóc nào (cũ nhất trước)</CardTitle>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Học viên</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Tư vấn viên</TableHead>
                      <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Phân bổ lúc</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đã trôi qua</TableHead>
                      <TableHead className="w-10 pr-4" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.neglected.map((p) => (
                      <TableRow key={p.id} className="odd:bg-secondary/10">
                        <TableCell className="min-w-40 px-5 py-3">
                          <p className="max-w-48 truncate font-medium text-foreground">{p.studentName}</p>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-muted-foreground">{p.assignedToName}</TableCell>
                        <TableCell className="hidden px-4 text-xs text-muted-foreground sm:table-cell">{formatDate(p.assignedAt)}</TableCell>
                        <TableCell className="px-4 text-sm">
                          <span className="text-destructive">{daysSince(p.assignedAt)} ngày</span>
                        </TableCell>
                        <TableCell className="pr-4 pl-1 text-right">
                          <Link href={`/students/${p.id}`} className="text-xs font-medium text-status-received hover:underline">
                            Xem
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {stats.recentDropOffs.length > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b border-border/70 px-5 py-3.5">
                <CardTitle className="text-sm">Lý do đang dừng lại gần đây</CardTitle>
              </CardHeader>
              <CardContent className="px-0 py-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Học viên</TableHead>
                      <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Tư vấn viên</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Đang dừng ở</TableHead>
                      <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Lý do</TableHead>
                      <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase xl:table-cell">Cập nhật lúc</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentDropOffs.map((row, i) => (
                      <TableRow key={i} className="odd:bg-secondary/10">
                        <TableCell className="min-w-40 px-5 py-3">
                          <p className="max-w-48 truncate font-medium text-foreground">{row.studentName}</p>
                        </TableCell>
                        <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">{row.assignedToName}</TableCell>
                        <TableCell className="px-4 text-sm text-muted-foreground">{row.stage ?? "Chưa gọi"}</TableCell>
                        <TableCell className="px-4 text-sm text-foreground">
                          <p className="max-w-72 truncate">{row.stageReason}</p>
                        </TableCell>
                        <TableCell className="hidden px-4 text-xs text-muted-foreground xl:table-cell">{formatDateTime(row.updatedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
