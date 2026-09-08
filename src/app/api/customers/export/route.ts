import { Workbook } from "exceljs";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { customerScopeWhere, customerSearchWhere } from "@/app/(app)/customers/customer-scope";
import { prisma } from "@/lib/prisma";

const EXPORT_LIMIT = 5000;

export async function GET(request: Request) {
  try {
    const actor = await requireApiUser();
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;

    const where = { ...customerScopeWhere(actor), ...customerSearchWhere(q, status) };

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { lastTouchAt: "desc" },
      take: EXPORT_LIMIT,
      select: {
        customerKey: true,
        displayName: true,
        phoneNormalized: true,
        currentStatusName: true,
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
      { header: "Lượt liên hệ", key: "interactionCount", width: 12 },
      { header: "Lần chạm đầu", key: "firstTouchAt", width: 18 },
      { header: "Lần chạm cuối", key: "lastTouchAt", width: 18 },
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
        interactionCount: c._count.interactions,
        firstTouchAt: c.firstTouchAt.toLocaleDateString("vi-VN"),
        lastTouchAt: c.lastTouchAt.toLocaleDateString("vi-VN"),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `khach-hang-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
