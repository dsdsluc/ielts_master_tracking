import "dotenv/config";

import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma";

const PILOT_SIZE = 100;
const PILOT_MARKER = "PILOT_DATA_100_V1";
const WORKBOOK_PATH = path.resolve(process.cwd(), "../docs/Tracking_Leads_IELTS_Master.xlsx");
const HO_CHI_MINH_OFFSET_MS = 7 * 60 * 60 * 1000;

type SheetRow = Record<string, unknown>;

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim() || null;
    if ("result" in value) return text(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      const joined = value.richText.map((part) => text(part) ?? "").join("").trim();
      return joined || null;
    }
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function integer(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function yes(value: unknown): boolean {
  return text(value)?.toLocaleLowerCase("vi") === "có";
}

function excelDate(value: unknown): Date | null {
  if (value instanceof Date) return new Date(value.getTime() - HO_CHI_MINH_OFFSET_MS);
  if (typeof value === "number") {
    return new Date((value - 25569) * 86_400_000 - HO_CHI_MINH_OFFSET_MS);
  }
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function rowsFromSheet(workbook: ExcelJS.Workbook, sheetName: string): SheetRow[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Không tìm thấy sheet ${sheetName}`);

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column] = text(cell.value) ?? "";
  });

  const rows: SheetRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const item: SheetRow = { __excelRow: rowNumber };
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      const header = headers[column];
      if (!header) return;
      item[header] = cell.value;
      if (cell.value !== null) hasValue = true;
    });
    if (hasValue) rows.push(item);
  });
  return rows;
}

function byKey(rows: SheetRow[], key: string): Map<string, SheetRow> {
  return new Map(rows.flatMap((row) => {
    const value = text(row[key]);
    return value ? [[value, row] as const] : [];
  }));
}

function required(row: SheetRow, key: string): string {
  const value = text(row[key]);
  if (!value) throw new Error(`Dòng ${row.__excelRow}: thiếu ${key}`);
  return value;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);

  const dataRows = rowsFromSheet(workbook, "DATA");
  const branches = byKey(rowsFromSheet(workbook, "CONFIG_BRANCHES"), "Mã_cơ_sở");
  const sources = byKey(rowsFromSheet(workbook, "CONFIG_SOURCES"), "Nguồn");
  const fanpages = byKey(rowsFromSheet(workbook, "CONFIG_FANPAGES"), "Fanpage");
  const statuses = byKey(rowsFromSheet(workbook, "CONFIG_STATUS"), "Trạng_thái");
  const objects = byKey(rowsFromSheet(workbook, "CONFIG_OBJECTS"), "Đối_tượng");

  const users = await prisma.user.findMany({ select: { email: true } });
  if (users.length === 0) {
    throw new Error("Chưa có User. Hãy chạy `npm run seed` trước khi seed pilot DATA.");
  }
  const userEmails = new Set(users.map((user) => user.email.toLocaleLowerCase()));

  const existingPilotCount = await prisma.interactionMigrationMeta.count({
    where: { migrationNote: PILOT_MARKER },
  });
  if (existingPilotCount >= PILOT_SIZE) {
    console.log(JSON.stringify({ marker: PILOT_MARKER, imported: existingPilotCount, skipped: "Pilot đã đủ dữ liệu" }, null, 2));
    return;
  }
  const remaining = PILOT_SIZE - existingPilotCount;

  const existingIds = new Set((await prisma.interaction.findMany({ select: { interactionId: true } })).map((row) => row.interactionId));
  const seenCustomers = new Set<string>();
  const seenLinks = new Set<string>();
  const actorFields = [
    "Email_người_tạo",
    "Email_tư_vấn",
    "Email_người_cập_nhật",
    "Email_người_điều_chuyển",
    "Email_push_MKT",
    "Email_xử_lý_chăm_sóc_lại",
  ];

  // Duyệt từ cuối sheet để pilot ưu tiên dữ liệu mới nhất.
  const selected = [...dataRows].reverse().filter((row) => {
    const interactionId = text(row.Interaction_ID);
    const customerKey = text(row.Customer_Key);
    const canonicalLink = text(row.Link_chuẩn);
    const creatorEmail = text(row.Email_người_tạo)?.toLocaleLowerCase();
    const requiredValues = [interactionId, customerKey, canonicalLink, text(row.Link_gốc), text(row.Tên_KH), text(row.Nguồn), text(row.Fanpage), text(row.Đối_tượng), text(row.Cơ_sở_gợi_ý), text(row.Cơ_sở_phụ_trách), text(row.Trạng_thái), text(row.Loại_tương_tác), creatorEmail, excelDate(row.Ngày_tạo_lead), excelDate(row.Thời_gian_tạo)];
    if (requiredValues.some((value) => value === null || value === undefined)) return false;
    if (existingIds.has(interactionId!) || seenCustomers.has(customerKey!) || seenLinks.has(canonicalLink!)) return false;
    if (!sources.has(text(row.Nguồn)!) || !fanpages.has(text(row.Fanpage)!) || !objects.has(text(row.Đối_tượng)!) || !branches.has(text(row.Cơ_sở_gợi_ý)!) || !branches.has(text(row.Cơ_sở_phụ_trách)!) || !statuses.has(text(row.Trạng_thái)!)) return false;
    if (!userEmails.has(creatorEmail!)) return false;
    if (actorFields.some((field) => {
      const email = text(row[field])?.toLocaleLowerCase();
      return email ? !userEmails.has(email) : false;
    })) return false;
    seenCustomers.add(customerKey!);
    seenLinks.add(canonicalLink!);
    return true;
  }).slice(0, remaining);

  if (selected.length !== remaining) {
    throw new Error(`Chỉ tìm được ${selected.length}/${remaining} dòng sạch còn thiếu theo tiêu chí pilot.`);
  }

  const usedBranchCodes = new Set(selected.flatMap((row) => [required(row, "Cơ_sở_gợi_ý"), required(row, "Cơ_sở_phụ_trách")]));
  const usedSourceNames = new Set(selected.map((row) => required(row, "Nguồn")));
  const usedFanpageNames = new Set(selected.map((row) => required(row, "Fanpage")));
  const usedStatusNames = new Set(selected.map((row) => required(row, "Trạng_thái")));
  const usedObjectNames = new Set(selected.map((row) => required(row, "Đối_tượng")));

  // Fanpage có FK tới nguồn mặc định và cơ sở gợi ý; bổ sung dependency trước.
  for (const fanpageName of usedFanpageNames) {
    const config = fanpages.get(fanpageName)!;
    usedSourceNames.add(required(config, "Nguồn_mặc_định"));
    usedBranchCodes.add(required(config, "Cơ_sở_gợi_ý"));
  }

  await prisma.$transaction(async (tx) => {
    for (const code of usedBranchCodes) {
      const row = branches.get(code)!;
      await tx.branch.upsert({
        where: { code },
        update: {},
        create: { code, name: required(row, "Tên_cơ_sở"), active: yes(row.Hoạt_động), slaReceiveMinutes: integer(row.SLA_nhận_phút, 30), slaProcessHours: integer(row.SLA_xử_lý_giờ, 24), note: text(row.Ghi_chú) },
      });
    }
    for (const name of usedSourceNames) {
      const row = sources.get(name)!;
      await tx.source.upsert({
        where: { name },
        update: {},
        create: { name, channelGroup: required(row, "Nhóm_kênh"), sourceGroup: required(row, "Nhóm_nguồn"), requireAdId: yes(row.Bắt_buộc_Ad_ID), active: yes(row.Hoạt_động), note: text(row.Ghi_chú) },
      });
    }
    for (const name of usedFanpageNames) {
      const row = fanpages.get(name)!;
      await tx.fanpage.upsert({
        where: { name },
        update: {},
        create: { name, defaultSourceName: required(row, "Nguồn_mặc_định"), suggestedBranchCode: required(row, "Cơ_sở_gợi_ý"), requireAdId: yes(row.Bắt_buộc_Ad_ID), active: yes(row.Hoạt_động), note: text(row.Ghi_chú) },
      });
    }
    for (const name of usedStatusNames) {
      const row = statuses.get(name)!;
      await tx.status.upsert({
        where: { name },
        update: {},
        create: { name, sortOrder: integer(row.Thứ_tự), isClosingStatus: yes(row.Trạng_thái_đóng), requirePhone: yes(row.Yêu_cầu_SĐT), active: yes(row.Hoạt_động), note: text(row.Ghi_chú) },
      });
    }
    for (const name of usedObjectNames) {
      const row = objects.get(name)!;
      await tx.customerObject.upsert({ where: { name }, update: {}, create: { name, sortOrder: integer(row.Thứ_tự), active: yes(row.Hoạt_động) } });
    }

    for (const row of selected) {
      const customerKey = required(row, "Customer_Key");
      const interactionId = required(row, "Interaction_ID");
      const createdLeadAt = excelDate(row.Ngày_tạo_lead)!;
      const createdAt = excelDate(row.Thời_gian_tạo)!;
      const customerName = required(row, "Tên_KH");
      const canonicalLink = required(row, "Link_chuẩn");
      const statusName = required(row, "Trạng_thái");
      const creatorEmail = required(row, "Email_người_tạo").toLocaleLowerCase();
      const emailOrNull = (key: string) => text(row[key])?.toLocaleLowerCase() ?? null;

      await tx.customer.create({ data: { customerKey, displayName: customerName, canonicalLink, phoneNormalized: text(row.SĐT_chuẩn), firstTouchAt: createdLeadAt, lastTouchAt: createdLeadAt, currentStatusName: statusName } });
      await tx.interaction.create({
        data: {
          interactionId, customerKey, version: integer(row.Version, 1), activeFlag: yes(row.Active_Flag), createdLeadAt,
          sourceName: required(row, "Nguồn"), fanpageName: required(row, "Fanpage"), adId: text(row.Ad_ID), firstTouchAdId: text(row.First_touch_Ad_ID), lastTouchAdId: text(row.Last_touch_Ad_ID),
          rawLink: required(row, "Link_gốc"), canonicalLink, customerName, customerObjectName: required(row, "Đối_tượng"), suggestedBranchCode: required(row, "Cơ_sở_gợi_ý"), assignedBranchCode: required(row, "Cơ_sở_phụ_trách"), statusName,
          interactionType: required(row, "Loại_tương_tác"), touchCount: integer(row.Lần_tương_tác, 1), assignedSaleEmail: emailOrNull("Email_tư_vấn"), receivedAt: excelDate(row.Ngày_nhận), phoneRaw: text(row.SĐT_gốc), phoneNormalized: text(row.SĐT_chuẩn), phoneCapturedAt: excelDate(row.Ngày_có_SĐT), closedAt: excelDate(row.Ngày_đóng),
          transferredToPse: yes(row.Đã_chuyển_PSE), pseProfileCode: text(row.Mã_hồ_sơ_PSE), createdByEmail: creatorEmail, createdAt, updatedByEmail: emailOrNull("Email_người_cập_nhật"), updatedAt: excelDate(row.Thời_gian_cập_nhật), reassignedByEmail: emailOrNull("Email_người_điều_chuyển"), reassignReason: text(row.Lý_do_điều_chuyển),
          needsFollowup: yes(row.Cần_chăm_sóc_lại), mktPushedAt: excelDate(row.Thời_gian_push_MKT), mktPushedByEmail: emailOrNull("Email_push_MKT"), conversationLink: text(row.Link_hội_thoại), mktSuggestion: text(row.Gợi_ý_chăm_sóc_MKT), followupHandledByEmail: emailOrNull("Email_xử_lý_chăm_sóc_lại"), followupHandledAt: excelDate(row.Thời_gian_xử_lý_chăm_sóc_lại),
        },
      });
      await tx.interactionMigrationMeta.create({ data: { interactionId, legacyStt: integer(row.Legacy_STT) || null, legacyRow: integer(row.Legacy_Row) || integer(row.__excelRow), migrationNote: PILOT_MARKER } });
    }
  }, { timeout: 60_000 });

  const imported = await prisma.interactionMigrationMeta.count({ where: { migrationNote: PILOT_MARKER } });
  const statusCounts = await prisma.interaction.groupBy({ by: ["statusName"], where: { migrationMeta: { migrationNote: PILOT_MARKER } }, _count: { _all: true } });
  console.log(JSON.stringify({ marker: PILOT_MARKER, selected: selected.length, imported, statusCounts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
