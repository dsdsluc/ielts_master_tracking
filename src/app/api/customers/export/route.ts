import { Workbook } from "exceljs";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { customerScopeWhere, qualifiedCustomerWhere } from "@/app/(app)/customers/customer-scope";
import { CUSTOMER_STAGE_VALUES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";

const EXPORT_LIMIT = 5000;

function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("vi-VN") : "";
}

// Bỏ dấu + khoảng trắng để dùng an toàn trong tên file tải xuống (Content-
// Disposition filename= cần ASCII thuần, không hỗ trợ dấu tiếng Việt).
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(request: Request) {
  try {
    const actor = await requireApiUser();

    // "none" = sentinel cho "Chưa gọi" (stage null) — mirror /customers (page.tsx)
    // để export luôn khớp đúng bộ lọc Leader đang xem trên màn hình.
    const stageParam = new URL(request.url).searchParams.get("stage");
    const stageFilter = stageParam === "none" || (stageParam && (CUSTOMER_STAGE_VALUES as readonly string[]).includes(stageParam)) ? stageParam : null;

    const where = {
      ...customerScopeWhere(actor),
      ...qualifiedCustomerWhere(),
      ...(stageFilter ? { stage: stageFilter === "none" ? null : stageFilter } : {}),
    };

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { lastTouchAt: "desc" },
      take: EXPORT_LIMIT,
      select: {
        customerKey: true,
        displayName: true,
        phoneNormalized: true,
        currentStatusName: true,
        stage: true,
        stageReason: true,
        age: true,
        dateOfBirth: true,
        gender: true,
        parentName: true,
        address: true,
        level: true,
        trainingTrack: true,
        school: true,
        aspiration: true,
        note: true,
        enrolledAt: true,
        assignedTo: { select: { fullName: true } },
        firstTouchAt: true,
        lastTouchAt: true,
        _count: { select: { interactions: true } },
      },
    });

    const workbook = new Workbook();
    workbook.creator = "Theo dõi Liên hệ · IELTS Master";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Khách hàng");
    sheet.columns = [
      { header: "Mã khách hàng", key: "customerKey", width: 22 },
      { header: "Tên", key: "displayName", width: 26 },
      { header: "SĐT", key: "phoneNormalized", width: 16 },
      { header: "Trạng thái hiện tại", key: "currentStatusName", width: 18 },
      { header: "Mốc tư vấn", key: "stage", width: 16 },
      { header: "Lý do (Không quan tâm)", key: "stageReason", width: 24 },
      { header: "Người phụ trách", key: "assignedToName", width: 20 },
      { header: "Ngày sinh", key: "dateOfBirth", width: 14 },
      { header: "Tuổi", key: "age", width: 8 },
      { header: "Giới tính", key: "gender", width: 12 },
      { header: "Phụ huynh", key: "parentName", width: 20 },
      { header: "Địa chỉ", key: "address", width: 26 },
      { header: "Trình độ", key: "level", width: 16 },
      { header: "Lộ trình học", key: "trainingTrack", width: 18 },
      { header: "Trường", key: "school", width: 20 },
      { header: "Nguyện vọng", key: "aspiration", width: 24 },
      { header: "Ghi chú", key: "note", width: 26 },
      { header: "Ngày chốt", key: "enrolledAt", width: 14 },
      { header: "Lượt liên hệ", key: "interactionCount", width: 12 },
      { header: "Lần chạm đầu", key: "firstTouchAt", width: 16 },
      { header: "Lần chạm cuối", key: "lastTouchAt", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEDE7" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    for (const c of customers) {
      sheet.addRow({
        customerKey: c.customerKey,
        displayName: c.displayName,
        phoneNormalized: c.phoneNormalized ?? "",
        currentStatusName: c.currentStatusName,
        stage: c.stage ?? "Chưa gọi",
        stageReason: c.stageReason ?? "",
        assignedToName: c.assignedTo?.fullName ?? "",
        dateOfBirth: formatDate(c.dateOfBirth),
        age: c.age ?? "",
        gender: c.gender ?? "",
        parentName: c.parentName ?? "",
        address: c.address ?? "",
        level: c.level ?? "",
        trainingTrack: c.trainingTrack ?? "",
        school: c.school ?? "",
        aspiration: c.aspiration ?? "",
        note: c.note ?? "",
        enrolledAt: formatDate(c.enrolledAt),
        interactionCount: c._count.interactions,
        firstTouchAt: formatDate(c.firstTouchAt),
        lastTouchAt: formatDate(c.lastTouchAt),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const suffix = stageFilter ? `-${stageFilter === "none" ? "chua-goi" : slugify(stageFilter)}` : "";
    const filename = `khach-hang${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
