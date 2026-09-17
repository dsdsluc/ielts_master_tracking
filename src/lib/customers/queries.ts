import { prisma } from "@/lib/prisma";
import { ROLES, STATUS } from "@/lib/interactions/constants";
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
};

/** Customer đã Đủ tiêu chuẩn nhưng CHƯA có Sale nào phụ trách — nguồn cho
 * /customer-assignment. Không lọc theo cơ sở (xem quyết định tách hẳn khỏi
 * Interaction) — chỉ Leader/Admin gọi trang này, vốn đã thấy toàn công ty. */
export async function getAssignableCustomers(): Promise<AssignableCustomer[]> {
  const rows = await prisma.customer.findMany({
    where: { currentStatusName: STATUS.PHONE, assignedToEmail: null },
    orderBy: { firstTouchAt: "asc" },
    select: { customerKey: true, displayName: true, phoneNormalized: true, firstTouchAt: true, lastTouchAt: true },
  });
  return rows.map((r) => ({ ...r, firstTouchAt: r.firstTouchAt.toISOString(), lastTouchAt: r.lastTouchAt.toISOString() }));
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

export async function getCustomerDetail(actor: CurrentUser, customerKey: string): Promise<CustomerDetail> {
  const customer = await prisma.customer.findUnique({ where: { customerKey }, include: customerDetailInclude });
  if (!customer) throw Errors.notFound();
  if (!isLeaderLike(actor) && !(actor.role === ROLES.SALES && customer.assignedToEmail === actor.email)) {
    throw Errors.forbidden("Bạn không được xem khách hàng này.");
  }
  return toCustomerDetail(customer);
}
