import { Workbook } from "exceljs";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { buildInteractionWhere } from "@/lib/interactions/queries";
import { listItemInclude, toListItem } from "@/lib/interactions/serialize";
import { prisma } from "@/lib/prisma";

const EXPORT_LIMIT = 5000;

export async function GET(request: Request) {
  try {
    const actor = await requireApiUser();
    const url = new URL(request.url);

    const where = buildInteractionWhere(actor, {
      status: url.searchParams.get("status") ?? undefined,
      needsFollowup: url.searchParams.get("needsFollowup") === "true",
      mine: url.searchParams.get("mine") === "true",
      branch: url.searchParams.get("branch") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
    });

    const rows = await prisma.interaction.findMany({
      where,
      include: listItemInclude,
      orderBy: { createdLeadAt: "desc" },
      take: EXPORT_LIMIT,
    });
    const items = rows.map(toListItem);

    const workbook = new Workbook();
    workbook.creator = "Theo dõi Liên hệ · IELTS Master";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Liên hệ");
    sheet.columns = [
      { header: "Khách hàng", key: "customerName", width: 28 },
      { header: "SĐT", key: "phoneNormalized", width: 16 },
      { header: "Nguồn", key: "sourceName", width: 14 },
      { header: "Fanpage", key: "fanpageName", width: 26 },
      { header: "Cơ sở", key: "assignedBranchCode", width: 12 },
      { header: "Tư vấn viên", key: "assignedSaleName", width: 20 },
      { header: "Trạng thái", key: "status", width: 16 },
      { header: "Lần chăm sóc", key: "touchCount", width: 12 },
      { header: "Ngày tạo", key: "createdLeadAt", width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEDE7" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    for (const item of items) {
      sheet.addRow({
        customerName: item.customerName,
        phoneNormalized: item.phoneNormalized ?? "",
        sourceName: item.sourceName,
        fanpageName: item.fanpageName,
        assignedBranchCode: item.assignedBranchCode,
        assignedSaleName: item.assignedSaleName ?? "",
        status: item.status,
        touchCount: item.touchCount,
        createdLeadAt: new Date(item.createdLeadAt).toLocaleString("vi-VN"),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `lien-he-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
