import Link from "next/link";
import { ArrowRight, GitMerge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireRole } from "@/lib/auth/dal";
import { CAN_CREATE_OR_EDIT_LEAD } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { customerScopeWhere } from "@/app/(app)/customers/customer-scope";

function formatDate(date: Date) {
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default async function DuplicateCustomersPage() {
  const user = await requireRole(...CAN_CREATE_OR_EDIT_LEAD);

  // Tạm thời phát hiện trùng theo heuristic: cùng SĐT nhưng khác Link chuẩn
  // (khác customerKey) => nhiều khả năng là 1 người thật liên hệ qua 2 link
  // khác nhau. Bước gắn "cờ" trùng thật sự (lưu DB, gỡ khi đã gộp) sẽ làm ở
  // phần logic sau — hiện đọc trực tiếp từ dữ liệu thật để lên giao diện trước.
  const customers = await prisma.customer.findMany({
    where: { ...customerScopeWhere(user), phoneNormalized: { not: null } },
    select: {
      customerKey: true,
      displayName: true,
      phoneNormalized: true,
      currentStatusName: true,
      lastTouchAt: true,
      _count: { select: { interactions: true } },
    },
    orderBy: { lastTouchAt: "desc" },
  });

  const byPhone = new Map<string, typeof customers>();
  for (const c of customers) {
    const phone = c.phoneNormalized!;
    const list = byPhone.get(phone) ?? [];
    list.push(c);
    byPhone.set(phone, list);
  }
  const groups = [...byPhone.entries()].filter(([, list]) => list.length >= 2);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Khách hàng trùng"
        description="Các khách hàng có cùng số điện thoại nhưng đang là 2 bản ghi khác nhau — kiểm tra và gộp lại."
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={GitMerge}
          title="Không có khách hàng nào bị trùng"
          description="Khi phát hiện 2 bản ghi khách hàng cùng số điện thoại, chúng sẽ xuất hiện ở đây để gộp lại."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map(([phone, list]) => (
            <Link
              key={phone}
              href={`/customers/duplicates/${encodeURIComponent(phone)}`}
              className="shadow-bubble flex items-center justify-between gap-3 rounded-2xl border border-accent bg-accent/40 p-4 hover:bg-accent/60"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                  <GitMerge className="size-4" />
                </span>
                <div>
                  <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                    {list.slice(0, 2).map((c) => c.displayName).join("  ·  ")}
                    {list.length > 2 && <span className="text-xs text-muted-foreground">+{list.length - 2} nữa</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    SĐT {phone} · {list.length} bản ghi · lần chạm gần nhất{" "}
                    {formatDate(list.reduce((a, b) => (a.lastTouchAt > b.lastTouchAt ? a : b)).lastTouchAt)}
                  </p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-sm font-medium text-accent-foreground">
                Xem & gộp <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
