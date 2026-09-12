import { Workbook } from "exceljs";
import type { Prisma } from "@/generated/prisma/client";
import { requireApiUser } from "@/lib/auth/api";
import { errorResponse } from "@/lib/interactions/errors";
import { ApiError } from "@/lib/interactions/errors";
import { ROLES } from "@/lib/interactions/constants";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/app/(app)/ads-cost/format";

const EXPORT_LIMIT = 5000;

export async function GET(request: Request) {
  try {
    const actor = await requireApiUser();
    if (actor.role !== ROLES.MARKETING && actor.role !== ROLES.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "Chỉ Marketing hoặc Quản trị hệ thống được xuất dữ liệu này.");
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const source = url.searchParams.get("source") ?? undefined;
    const branch = url.searchParams.get("branch") ?? undefined;
    const period = url.searchParams.get("period") ?? undefined;
    const costMin = url.searchParams.get("costMin") ?? undefined;
    const costMax = url.searchParams.get("costMax") ?? undefined;

    const where: Prisma.AdsCostWhereInput = {};
    if (source && source !== "all") where.sourceName = source;
    if (branch && branch !== "all") where.branchCode = branch;
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { adId: { contains: term, mode: "insensitive" } },
        { adName: { contains: term, mode: "insensitive" } },
      ];
    }
    if (period) {
      const [start, end] = period.split("_");
      if (start && end) {
        where.periodStart = new Date(start);
        where.periodEnd = new Date(end);
      }
    }
    const costMinNum = costMin ? Number(costMin) : undefined;
    const costMaxNum = costMax ? Number(costMax) : undefined;
    if (costMinNum !== undefined || costMaxNum !== undefined) {
      where.costVnd = {};
      if (costMinNum !== undefined && !Number.isNaN(costMinNum)) where.costVnd.gte = costMinNum;
      if (costMaxNum !== undefined && !Number.isNaN(costMaxNum)) where.costVnd.lte = costMaxNum;
    }

    const rows = await prisma.adsCost.findMany({
      where,
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      take: EXPORT_LIMIT,
      include: { branch: { select: { name: true } } },
    });

    const workbook = new Workbook();
    workbook.creator = "Theo dõi Liên hệ · IELTS Master";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Chi phí quảng cáo");
    sheet.columns = [
      { header: "Bắt đầu kỳ", key: "periodStart", width: 14 },
      { header: "Kết thúc kỳ", key: "periodEnd", width: 14 },
      { header: "Ad ID", key: "adId", width: 18 },
      { header: "Tên quảng cáo", key: "adName", width: 28 },
      { header: "Nguồn", key: "sourceName", width: 14 },
      { header: "Fanpage", key: "fanpageName", width: 26 },
      { header: "Cơ sở", key: "branchName", width: 16 },
      { header: "Chi phí (VND)", key: "costVnd", width: 16 },
      { header: "Ghi chú", key: "note", width: 24 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEDE7" } };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.getColumn("costVnd").numFmt = '#,##0 "đ"';

    for (const c of rows) {
      sheet.addRow({
        periodStart: formatDate(c.periodStart.toISOString()),
        periodEnd: formatDate(c.periodEnd.toISOString()),
        adId: c.adId,
        adName: c.adName,
        sourceName: c.sourceName ?? "",
        fanpageName: c.fanpageName ?? "",
        branchName: c.branch?.name ?? "",
        costVnd: Number(c.costVnd),
        note: c.note ?? "",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `chi-phi-quang-cao-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
