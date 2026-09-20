import { prisma } from "@/lib/prisma";
import { ROLES, SALE_LIKE_ROLES, STATUS, CUSTOMER_STAGE } from "@/lib/interactions/constants";
import { isLeaderLike } from "@/lib/interactions/scope";
import { Errors } from "@/lib/interactions/errors";
import { customerDetailInclude, toCustomerDetail, type CustomerDetail } from "@/lib/customers/serialize";
import type { CurrentUser } from "@/lib/auth/dal";

export type AssignableCustomer = {
  customerKey: string;
  displayName: string;
  phoneNormalized: string | null;
  firstTouchAt: string;
  lastTouchAt: string;
  sourceName: string | null;
  consultantName: string | null;
};

/** Customer đã Đủ tiêu chuẩn nhưng CHƯA có Sale nào phụ trách — nguồn cho
 * /customer-assignment. Không lọc theo cơ sở (xem quyết định tách hẳn khỏi
 * Interaction) — chỉ Leader/Admin gọi trang này, vốn đã thấy toàn công ty.
 * "Nguồn" và "Tư vấn viên" chỉ mang tính THAM KHẢO cho Leader ra quyết định
 * phân bổ — lấy từ Interaction ĐỦ TIÊU CHUẨN gần nhất (không phải Customer,
 * Customer.assignedToEmail ở đây luôn null theo định nghĩa của trang này) —
 * "Tư vấn viên" là Sale đã gọi khách đạt mốc này, KHÁC với Sale sẽ được giao
 * tư vấn ghi danh tiếp theo. */
export async function getAssignableCustomers(): Promise<AssignableCustomer[]> {
  const rows = await prisma.customer.findMany({
    where: { currentStatusName: STATUS.PHONE, assignedToEmail: null },
    orderBy: { firstTouchAt: "asc" },
    select: {
      customerKey: true,
      displayName: true,
      phoneNormalized: true,
      firstTouchAt: true,
      lastTouchAt: true,
      interactions: {
        where: { statusName: STATUS.PHONE },
        orderBy: { createdLeadAt: "desc" },
        take: 1,
        select: { sourceName: true, assignedSale: { select: { fullName: true } } },
      },
    },
  });
  return rows.map((r) => ({
    customerKey: r.customerKey,
    displayName: r.displayName,
    phoneNormalized: r.phoneNormalized,
    firstTouchAt: r.firstTouchAt.toISOString(),
    lastTouchAt: r.lastTouchAt.toISOString(),
    sourceName: r.interactions[0]?.sourceName ?? null,
    consultantName: r.interactions[0]?.assignedSale?.fullName ?? null,
  }));
}

export type CustomerListItem = {
  customerKey: string;
  displayName: string;
  phoneNormalized: string | null;
  stage: string | null;
  needsLeaderSupport: boolean;
  appointmentAt: string | null;
  caseDeadline: string | null;
};

/** Khách hàng đang được 1 Sale cụ thể phụ trách tư vấn — dùng ở Workspace và
 * Dashboard Sale. */
export async function getCustomersForSale(email: string): Promise<CustomerListItem[]> {
  const rows = await prisma.customer.findMany({
    where: { assignedToEmail: email },
    orderBy: [{ needsLeaderSupport: "desc" }, { assignedAt: "desc" }],
    select: {
      customerKey: true,
      displayName: true,
      phoneNormalized: true,
      stage: true,
      needsLeaderSupport: true,
      appointmentAt: true,
      caseDeadline: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    appointmentAt: r.appointmentAt?.toISOString() ?? null,
    caseDeadline: r.caseDeadline?.toISOString() ?? null,
  }));
}

export type WorkloadLevel = "overloaded" | "balanced" | "light";

export type SaleWorkload = {
  email: string;
  fullName: string;
  active: boolean;
  totalAssigned: number;
  openAssigned: number;
  needsSupport: number;
  overdue: number;
  level: WorkloadLevel | null;
};

// 2 mốc coi là ĐÃ XONG việc (không còn tính vào khối lượng "đang xử lý") —
// mọi mốc còn lại, kể cả stage=null (chưa gọi lần nào), vẫn là việc Sale còn
// nợ nên phải tính vào tải hiện tại.
const CLOSED_STAGES: readonly string[] = [CUSTOMER_STAGE.ENROLLED, CUSTOMER_STAGE.NOT_INTERESTED];

/** Khối lượng công việc hiện tại của từng Sale — phục vụ 2 việc cùng lúc: (1)
 * phát hiện Sale đang quá tải/quá rảnh để Leader cân đối lại, (2) liệt kê cả
 * Sale đã khoá tài khoản (nghỉ việc) nhưng còn sót khách để thu hồi. Gộp 1
 * lần thành 1 bảng duy nhất thay vì tách riêng "ai đang có khách" và "ai đang
 * rảnh" — 2 câu hỏi này luôn được Leader hỏi cùng lúc khi cần điều chuyển.
 * Đọc thẳng toàn bộ Customer đang có người phụ trách rồi gộp bằng JS, KHÔNG
 * dùng groupBy cho phần "đang xử lý" — lọc theo stage null-hay-không-null qua
 * groupBy where rất dễ sai vì SQL NOT IN loại bỏ luôn NULL, trong khi ở đây
 * NULL (chưa gọi) lại phải được TÍNH vào tải. */
export async function getSaleWorkloads(): Promise<SaleWorkload[]> {
  const [sales, assigned] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: SALE_LIKE_ROLES } }, select: { email: true, fullName: true, active: true } }),
    prisma.customer.findMany({
      where: { assignedToEmail: { not: null } },
      select: { assignedToEmail: true, stage: true, needsLeaderSupport: true, appointmentAt: true, caseDeadline: true },
    }),
  ]);

  const now = Date.now();
  type Agg = { total: number; open: number; support: number; overdue: number };
  const byEmail = new Map<string, Agg>();
  for (const c of assigned) {
    const email = c.assignedToEmail as string;
    const row = byEmail.get(email) ?? { total: 0, open: 0, support: 0, overdue: 0 };
    row.total++;
    const isOpen = !c.stage || !CLOSED_STAGES.includes(c.stage);
    if (isOpen) row.open++;
    if (c.needsLeaderSupport) row.support++;
    if (isOpen && ((c.appointmentAt !== null && c.appointmentAt.getTime() < now) || (c.caseDeadline !== null && c.caseDeadline.getTime() < now))) {
      row.overdue++;
    }
    byEmail.set(email, row);
  }

  // Sale đã bị XOÁ khỏi bảng User nhưng Customer.assignedToEmail vẫn còn trỏ
  // tới email đó (hiếm, dữ liệu mồ côi) — vẫn phải liệt kê ra để thu hồi được,
  // không thì khách hàng coi như biến mất khỏi mọi màn hình quản lý.
  const knownEmails = new Set(sales.map((s) => s.email));
  const orphanEmails = [...byEmail.keys()].filter((email) => !knownEmails.has(email));

  const candidates = [
    ...sales.map((s) => ({ email: s.email, fullName: s.fullName, active: s.active })),
    ...orphanEmails.map((email) => ({ email, fullName: email, active: false })),
  ];

  const activeOpenCounts = candidates.filter((c) => c.active).map((c) => byEmail.get(c.email)?.open ?? 0);
  const avgOpen = activeOpenCounts.length > 0 ? activeOpenCounts.reduce((a, b) => a + b, 0) / activeOpenCounts.length : 0;

  return candidates
    .map((c) => {
      const agg = byEmail.get(c.email) ?? { total: 0, open: 0, support: 0, overdue: 0 };
      let level: WorkloadLevel | null = null;
      if (c.active) {
        if (avgOpen <= 0) level = "balanced";
        else if (agg.open >= avgOpen * 1.3 && agg.open - avgOpen >= 2) level = "overloaded";
        else if (agg.open <= avgOpen * 0.6) level = "light";
        else level = "balanced";
      }
      return { email: c.email, fullName: c.fullName, active: c.active, totalAssigned: agg.total, openAssigned: agg.open, needsSupport: agg.support, overdue: agg.overdue, level };
    })
    .filter((r) => r.active || r.totalAssigned > 0)
    .sort((a, b) => b.openAssigned - a.openAssigned);
}

export async function getCustomerDetail(actor: CurrentUser, customerKey: string): Promise<CustomerDetail> {
  const customer = await prisma.customer.findUnique({ where: { customerKey }, include: customerDetailInclude });
  if (!customer) throw Errors.notFound();
  if (!isLeaderLike(actor) && !(actor.role === ROLES.SALES && customer.assignedToEmail === actor.email)) {
    throw Errors.forbidden("Bạn không được xem khách hàng này.");
  }
  return toCustomerDetail(customer);
}
