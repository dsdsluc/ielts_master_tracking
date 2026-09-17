import Link from "next/link";
import { TriangleAlert, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCustomersForSale } from "@/lib/customers/queries";
import { formatDateTime } from "@/app/(app)/leads/lead-format";
import { StageBadge } from "@/app/(app)/customers/stage-badge";
import type { CurrentUser } from "@/lib/auth/dal";

/** Danh sách khách hàng đang được actor phụ trách tư vấn ghi danh — hiện ở
 * Workspace của Sale. Tách hẳn khỏi Interaction/Workspace liên hệ. */
export async function CustomersSection({ actor }: { actor: CurrentUser }) {
  const customers = await getCustomersForSale(actor.email);

  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Chưa có khách hàng nào được phân bổ"
        description="Khách hàng sẽ xuất hiện ở đây sau khi Leader phân bổ cho bạn."
      />
    );
  }

  return (
    <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="overflow-x-auto">
        <Table className="sm:min-w-[680px]">
          <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Khách hàng</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">SĐT</TableHead>
              <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Mốc tư vấn</TableHead>
              <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Ngày hẹn</TableHead>
              <TableHead className="w-4 pr-5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.customerKey} className="odd:bg-secondary/10">
                <TableCell className="min-w-40 px-5 py-3">
                  <Link href={`/customers/${c.customerKey}`} className="block max-w-56 truncate font-medium text-foreground hover:text-primary hover:underline" title={c.displayName}>
                    {c.displayName}
                  </Link>
                </TableCell>
                <TableCell className="hidden px-4 py-3 font-mono text-sm text-muted-foreground sm:table-cell">{c.phoneNormalized ?? "—"}</TableCell>
                <TableCell className="px-4 py-3 text-sm">
                  <StageBadge stage={c.stage} assigned />
                  {c.needsLeaderSupport && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
                      <TriangleAlert className="size-3" /> Cần Leader hỗ trợ
                    </p>
                  )}
                </TableCell>
                <TableCell className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">
                  {c.appointmentAt ? formatDateTime(c.appointmentAt) : "—"}
                </TableCell>
                <TableCell className="w-4 py-3 pr-5" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
