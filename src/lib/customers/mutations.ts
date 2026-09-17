// Tư vấn ghi danh — Leader phân bổ Customer đã Đủ tiêu chuẩn cho 1 Sale, Sale
// cập nhật phễu tư vấn (stage) và ghi lại từng lần chăm sóc (CustomerCareLog).
// Cố tình KHÔNG đụng gì tới Interaction (xem comment ở Customer trong
// schema.prisma) — Customer đã tách hẳn khỏi vòng đời lead từ đây trở đi.
import { prisma } from "@/lib/prisma";
import { ApiError, Errors } from "@/lib/interactions/errors";
import { ROLES, SYSTEM_LOG_ACTION, CUSTOMER_STAGE } from "@/lib/interactions/constants";
import { isLeaderLike } from "@/lib/interactions/scope";
import { logAction } from "@/lib/interactions/audit";
import { customerDetailInclude, toCustomerDetail, type CustomerDetail } from "@/lib/customers/serialize";
import { sendEmail, appLink } from "@/lib/email";
import { escapeHtml } from "@/lib/html-escape";
import type { CurrentUser } from "@/lib/auth/dal";

async function reloadDetail(customerKey: string): Promise<CustomerDetail> {
  const row = await prisma.customer.findUniqueOrThrow({ where: { customerKey }, include: customerDetailInclude });
  return toCustomerDetail(row);
}

async function loadCustomerOr404(customerKey: string) {
  const customer = await prisma.customer.findUnique({ where: { customerKey } });
  if (!customer) throw Errors.notFound();
  return customer;
}

function canAccessCustomer(actor: CurrentUser, customer: { assignedToEmail: string | null }): boolean {
  if (isLeaderLike(actor)) return true;
  return actor.role === ROLES.SALES && customer.assignedToEmail === actor.email;
}

async function validateAssignTarget(targetEmail: string) {
  const target = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!target || !target.active || ![ROLES.SALES, ROLES.LEADER, ROLES.ADMIN].includes(target.role as never)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Người phụ trách mới chưa hoạt động hoặc không có vai trò phù hợp.");
  }
  return target;
}

// ---------------------------------------------------------------------------
// Leader/Admin phân bổ hàng loạt Customer CHƯA có ai phụ trách cho 1 Sale.
// ---------------------------------------------------------------------------
export async function assignCustomers(
  actor: CurrentUser,
  customerKeys: string[],
  targetEmail: string
): Promise<{ assigned: number; skipped: number }> {
  if (!isLeaderLike(actor)) throw Errors.forbidden("Chỉ Leader/Admin được phân bổ khách hàng.");
  const target = await validateAssignTarget(targetEmail);

  // Lấy sẵn tên hiển thị để đưa vào email thông báo — KHÔNG lấy lại từ
  // updateMany() (không trả về row) nên phải query riêng trước vòng lặp.
  const displayNameByKey = new Map(
    (await prisma.customer.findMany({ where: { customerKey: { in: customerKeys } }, select: { customerKey: true, displayName: true } })).map(
      (c) => [c.customerKey, c.displayName]
    )
  );

  const now = new Date();
  let assigned = 0;
  let skipped = 0;
  const notified: { customerKey: string; displayName: string }[] = [];

  for (const customerKey of customerKeys) {
    try {
      await prisma.$transaction(async (tx) => {
        const result = await tx.customer.updateMany({
          where: { customerKey, assignedToEmail: null },
          data: { assignedToEmail: target.email, assignedByEmail: actor.email, assignedAt: now, updatedByEmail: actor.email, updatedAt: now },
        });
        if (result.count === 0) throw Errors.conflict("Khách hàng này đã được phân bổ trước đó.");
        await logAction(tx, actor, SYSTEM_LOG_ACTION.ASSIGN_CUSTOMER, null, { customerKey, assignedToEmail: null }, { customerKey, assignedToEmail: target.email });
      });
      assigned++;
      notified.push({ customerKey, displayName: displayNameByKey.get(customerKey) ?? customerKey });
    } catch {
      skipped++;
    }
  }

  // Gửi mail SAU vòng lặp DB (I/O không nên nằm trong transaction) — mirror
  // assignFollowup() ở lib/interactions/mutations.ts: gộp cả batch thành 1
  // email duy nhất, sendEmail() tự nuốt lỗi nên không ảnh hưởng kết quả phân bổ.
  if (notified.length > 0) {
    const itemsHtml = notified
      .map((c) => {
        const link = appLink(`/customers/${c.customerKey}`);
        const safeName = escapeHtml(c.displayName);
        return `<li>${link ? `<a href="${link}">${safeName}</a>` : safeName}</li>`;
      })
      .join("");
    await sendEmail({
      to: target.email,
      subject: notified.length === 1 ? `Bạn được phân bổ tư vấn: ${notified[0].displayName}` : `Bạn được phân bổ tư vấn ${notified.length} khách hàng`,
      html: `<p>Chào ${escapeHtml(target.fullName)},</p><p>Bạn vừa được phân bổ phụ trách tư vấn ${notified.length} khách hàng:</p><ul>${itemsHtml}</ul>`,
      action: SYSTEM_LOG_ACTION.ASSIGN_CUSTOMER,
      sentByEmail: actor.email,
    });
  }

  return { assigned, skipped };
}

// ---------------------------------------------------------------------------
// Leader/Admin điều chuyển 1 Customer đã có người phụ trách sang Sale khác.
// ---------------------------------------------------------------------------
export async function transferCustomer(actor: CurrentUser, customerKey: string, targetEmail: string) {
  if (!isLeaderLike(actor)) throw Errors.forbidden("Chỉ Leader/Admin được điều chuyển khách hàng.");
  const customer = await loadCustomerOr404(customerKey);
  const target = await validateAssignTarget(targetEmail);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { customerKey },
      data: { assignedToEmail: target.email, assignedByEmail: actor.email, assignedAt: now, updatedByEmail: actor.email, updatedAt: now },
    });
    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.TRANSFER_CUSTOMER,
      null,
      { customerKey, assignedToEmail: customer.assignedToEmail },
      { customerKey, assignedToEmail: target.email }
    );
  });

  const link = appLink(`/customers/${customerKey}`);
  const safeName = escapeHtml(customer.displayName);
  await sendEmail({
    to: target.email,
    subject: `Bạn được điều chuyển tiếp nhận: ${customer.displayName}`,
    html: `<p>Chào ${escapeHtml(target.fullName)},</p><p>Bạn vừa được điều chuyển tiếp nhận tư vấn khách hàng ${link ? `<a href="${link}">${safeName}</a>` : safeName}.</p>`,
    action: SYSTEM_LOG_ACTION.TRANSFER_CUSTOMER,
    sentByEmail: actor.email,
  });

  return reloadDetail(customerKey);
}

export type CustomerProfileInput = {
  displayName: string;
  phoneNormalized?: string | null;
  age?: number | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  parentName?: string | null;
  address?: string | null;
  level?: string | null;
  trainingTrack?: string | null;
  school?: string | null;
  aspiration?: string | null;
  note?: string | null;
};

// ---------------------------------------------------------------------------
// Sale phụ trách (hoặc Leader/Admin) sửa thông tin hồ sơ tư vấn.
// ---------------------------------------------------------------------------
export async function updateCustomerProfile(actor: CurrentUser, customerKey: string, input: CustomerProfileInput) {
  const customer = await loadCustomerOr404(customerKey);
  if (!canAccessCustomer(actor, customer)) throw Errors.forbidden("Bạn không được sửa hồ sơ khách hàng này.");
  if (!input.displayName.trim()) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập tên khách hàng.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { customerKey },
      data: { ...input, displayName: input.displayName.trim(), updatedByEmail: actor.email, updatedAt: now },
    });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.UPDATE_CUSTOMER_PROFILE, null, null, { customerKey });
  });

  return reloadDetail(customerKey);
}

export type CustomerStageInput = {
  stage: string;
  stageReason?: string | null;
  appointmentAt?: Date | null;
  caseDeadline?: Date | null;
  needsLeaderSupport?: boolean;
};

// ---------------------------------------------------------------------------
// Sale phụ trách cập nhật mốc xa nhất đã đạt trong phễu tư vấn ghi danh.
// enrolledAt chỉ set đúng 1 LẦN — lần đầu tiên đạt ENROLLED.
// ---------------------------------------------------------------------------
export async function updateCustomerStage(actor: CurrentUser, customerKey: string, input: CustomerStageInput) {
  const customer = await loadCustomerOr404(customerKey);
  if (!canAccessCustomer(actor, customer)) throw Errors.forbidden("Bạn không được cập nhật khách hàng này.");
  if (!Object.values(CUSTOMER_STAGE).includes(input.stage as never)) {
    throw new ApiError(422, "VALIDATION_ERROR", "Mốc tư vấn không hợp lệ.");
  }

  const now = new Date();
  const becameEnrolled = input.stage === CUSTOMER_STAGE.ENROLLED && customer.stage !== CUSTOMER_STAGE.ENROLLED;

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { customerKey },
      data: {
        stage: input.stage,
        stageReason: input.stageReason ?? null,
        appointmentAt: input.appointmentAt ?? null,
        caseDeadline: input.caseDeadline ?? null,
        needsLeaderSupport: input.needsLeaderSupport ?? false,
        ...(becameEnrolled ? { enrolledAt: now } : {}),
        updatedByEmail: actor.email,
        updatedAt: now,
      },
    });
    await logAction(
      tx,
      actor,
      SYSTEM_LOG_ACTION.UPDATE_CUSTOMER_STAGE,
      null,
      { customerKey, stage: customer.stage },
      { customerKey, stage: input.stage }
    );
  });

  return reloadDetail(customerKey);
}

// ---------------------------------------------------------------------------
// Ghi 1 dòng nhật ký chăm sóc — mỗi lần Sale gọi điện/tương tác với khách.
// ---------------------------------------------------------------------------
export async function logCustomerCare(actor: CurrentUser, customerKey: string, content: string) {
  const customer = await loadCustomerOr404(customerKey);
  if (!canAccessCustomer(actor, customer)) throw Errors.forbidden("Bạn không được ghi chăm sóc cho khách hàng này.");
  const trimmed = content.trim();
  if (!trimmed) throw new ApiError(422, "VALIDATION_ERROR", "Vui lòng nhập nội dung chăm sóc.");

  await prisma.$transaction(async (tx) => {
    await tx.customerCareLog.create({
      data: { customerKey, loggedByEmail: actor.email, content: trimmed, stageAtLogTime: customer.stage },
    });
    await logAction(tx, actor, SYSTEM_LOG_ACTION.LOG_CUSTOMER_CARE, null, null, { customerKey });
  });

  return reloadDetail(customerKey);
}
