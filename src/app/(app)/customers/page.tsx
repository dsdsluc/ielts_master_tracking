import Link from "next/link";
import { ChevronLeft, ChevronRight, FileDown, PhoneCall, User, Users } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/dal";
import { CustomersFilterBar } from "@/app/(app)/customers/customers-filter-bar";
import { customerScopeWhere, customerSearchWhere } from "@/app/(app)/customers/customer-scope";

const PAGE_SIZE = 20;

function formatDate(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const user = await getCurrentUser();
  const { page: pageParam, q, status } = await searchParams;
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const hasFilters = !!q?.trim() || !!status;

  const where: Prisma.CustomerWhereInput = { ...customerScopeWhere(user), ...customerSearchWhere(q, status) };

  const pageHref = (targetPage: number) => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    params.set("page", String(targetPage));
    return `/customers?${params.toString()}`;
  };

  const exportHref = (() => {
    const params = new URLSearchParams();
    if (q?.trim()) params.set("q", q.trim());
    if (status) params.set("status", status);
    return `/api/customers/export?${params.toString()}`;
  })();

  const [totalItems, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { lastTouchAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        customerKey: true,
        displayName: true,
        phoneNormalized: true,
        currentStatusName: true,
        firstTouchAt: true,
        lastTouchAt: true,
        _count: { select: { interactions: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Khách hàng"
        description="Khách hàng gộp theo Link chuẩn — mỗi khách có thể có nhiều lượt liên hệ."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <CustomersFilterBar />
            <Button variant="outline" size="sm" className="h-10 rounded-full" nativeButton={false} render={<a href={exportHref} />}>
              <FileDown className="size-3.5" /> Xuất Excel
            </Button>
          </div>
        }
      />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "Không tìm thấy khách hàng phù hợp" : "Chưa có khách hàng nào"}
          description={
            hasFilters
              ? "Thử đổi từ khoá tìm kiếm hoặc bộ lọc trạng thái."
              : "Khách hàng sẽ được gộp tự động từ các liên hệ trùng Link chuẩn."
          }
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              {totalPages > 1 && (
                <>
                  Trang <strong className="font-mono text-foreground">{page}</strong>/{totalPages} ·{" "}
                </>
              )}
              <strong className="font-mono text-foreground">{totalItems}</strong> khách hàng
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                {page > 1 ? (
                  <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href={pageHref(page - 1)} />} aria-label="Trang trước">
                    <ChevronLeft className="size-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="icon-sm" className="rounded-full" disabled aria-label="Trang trước">
                    <ChevronLeft className="size-4" />
                  </Button>
                )}
                {page < totalPages ? (
                  <Button variant="outline" size="icon-sm" className="rounded-full" nativeButton={false} render={<Link href={pageHref(page + 1)} />} aria-label="Trang sau">
                    <ChevronRight className="size-4" />
                  </Button>
                ) : (
                  <Button variant="outline" size="icon-sm" className="rounded-full" disabled aria-label="Trang sau">
                    <ChevronRight className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          <Table className="sm:min-w-[720px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">SĐT</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Trạng thái</TableHead>
                <TableHead className="hidden px-4 text-center font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Lượt liên hệ</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Lần chạm đầu</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Lần chạm cuối</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.customerKey} className="odd:bg-secondary/10">
                  <TableCell className="min-w-56 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="max-w-56 truncate font-medium text-foreground">{c.displayName}</p>
                        <p className="max-w-56 truncate font-mono text-[11px] text-muted-foreground">{c.customerKey}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    {c.phoneNormalized ? (
                      <span className="flex items-center gap-1.5 font-mono text-sm text-foreground">
                        <PhoneCall className="size-3.5 text-muted-foreground" />
                        {c.phoneNormalized}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Chưa có</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <StatusPill status={c.currentStatusName} />
                  </TableCell>
                  <TableCell className="hidden px-4 text-center font-mono text-sm text-muted-foreground sm:table-cell">
                    {c._count.interactions}
                  </TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground md:table-cell">{formatDate(c.firstTouchAt)}</TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{formatDate(c.lastTouchAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
