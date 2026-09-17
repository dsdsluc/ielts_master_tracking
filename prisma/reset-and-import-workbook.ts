import "dotenv/config";

import path from "node:path";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import type { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const WORKBOOK_PATH = path.resolve(process.cwd(), "../docs/Tracking_Leads_IELTS_Master.xlsx");
const EXECUTE = process.argv.includes("--execute");
const DEFAULT_PASSWORD = "12345678";
const LOCAL_OFFSET_MS = 7 * 60 * 60 * 1000;
const BATCH_SIZE = 400;

type Row = Record<string, unknown> & { __row: number };

function text(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value) return text(value.text);
    if ("result" in value) return text(value.result);
    if ("richText" in value && Array.isArray(value.richText)) {
      return text(value.richText.map((part) => text(part) ?? "").join(""));
    }
  }
  const result = String(value).trim();
  return result || null;
}

function bool(value: unknown): boolean {
  return text(value)?.toLocaleLowerCase("vi") === "có";
}

function int(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function date(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return new Date(value.getTime() - LOCAL_OFFSET_MS);
  if (typeof value === "number") return new Date((value - 25569) * 86_400_000 - LOCAL_OFFSET_MS);
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function json(value: unknown): Prisma.InputJsonValue | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try { return JSON.parse(raw) as Prisma.InputJsonValue; } catch { return raw; }
}

function rows(workbook: ExcelJS.Workbook, sheetName: string, headerRow = 1): Row[] {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) throw new Error(`Không tìm thấy tab ${sheetName}`);
  const headers: string[] = [];
  sheet.getRow(headerRow).eachCell({ includeEmpty: true }, (cell, column) => {
    headers[column] = text(cell.value) ?? "";
  });
  const result: Row[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const item: Row = { __row: rowNumber };
    let populated = false;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      const header = headers[column];
      if (!header) return;
      item[header] = cell.value;
      if (cell.value != null) populated = true;
    });
    if (populated) result.push(item);
  });
  return result;
}

function req(row: Row, key: string): string {
  const value = text(row[key]);
  if (!value) throw new Error(`Tab dữ liệu, dòng ${row.__row}: thiếu ${key}`);
  return value;
}

function email(value: unknown): string | null {
  return text(value)?.toLocaleLowerCase().replaceAll(/\s+/g, "") ?? null;
}

function batches<T>(items: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += BATCH_SIZE) result.push(items.slice(index, index + BATCH_SIZE));
  return result;
}

function reportPeriod(value: unknown): { start: Date; end: Date } {
  const raw = text(value) ?? "";
  const matches = [...raw.matchAll(/(\d{1,2})\/(\d{4})/g)];
  if (!matches.length) throw new Error(`Kỳ báo cáo không hợp lệ: ${raw}`);
  const first = matches[0];
  const last = matches.at(-1)!;
  return {
    start: new Date(Date.UTC(Number(first[2]), Number(first[1]) - 1, 1) - LOCAL_OFFSET_MS),
    end: new Date(Date.UTC(Number(last[2]), Number(last[1]), 1) - LOCAL_OFFSET_MS - 1),
  };
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK_PATH);

  const branchRows = rows(workbook, "CONFIG_BRANCHES");
  const sourceRows = rows(workbook, "CONFIG_SOURCES");
  const fanpageRows = rows(workbook, "CONFIG_FANPAGES");
  const statusRows = rows(workbook, "CONFIG_STATUS");
  const objectRows = rows(workbook, "CONFIG_OBJECTS");
  const userRows = rows(workbook, "CONFIG_USERS");
  const duplicateRows = rows(workbook, "CONFIG_DUPLICATE");
  const systemRows = rows(workbook, "CONFIG_SYSTEM");
  const dataRows = rows(workbook, "DATA");
  const adsRows = rows(workbook, "ADS_COST", 4);
  const logRows = rows(workbook, "SYSTEM_LOG");

  const branchCodes = new Set(branchRows.map((row) => req(row, "Mã_cơ_sở")));
  const sourceNames = new Set(sourceRows.map((row) => req(row, "Nguồn")));
  const fanpageNames = new Set(fanpageRows.map((row) => req(row, "Fanpage")));
  const statusNames = new Set(statusRows.map((row) => req(row, "Trạng_thái")));
  const objectNames = new Set(objectRows.map((row) => req(row, "Đối_tượng")));
  const users = userRows.map((row) => ({
    email: email(row.Email)!, fullName: req(row, "Họ_tên"), role: req(row, "Vai_trò"),
    branchCode: branchCodes.has(text(row.Cơ_sở) ?? "") ? text(row.Cơ_sở) : null,
    active: bool(row.Hoạt_động), viewAllBranches: bool(row.Xem_tất_cả_cơ_sở),
    userKey: text(row.User_Key), canCloseMktReport: bool(row.Được_chốt_báo_cáo_MKT), note: text(row.Ghi_chú),
  }));
  const validEmails = new Set(users.map((user) => user.email));
  const fallbackUser = users.find((user) => user.role === "Quản trị hệ thống")?.email ?? users[0]?.email;
  if (!fallbackUser) throw new Error("CONFIG_USERS không có người dùng hợp lệ");

  // File lịch sử có các lead chưa ghi Page. Schema hiện tại bắt buộc Fanpage, vì vậy
  // tạo danh mục truy vết theo Nguồn + Cơ sở thay vì gán nhầm sang một Page có thật.
  const generatedFanpages = new Map<string, { name: string; defaultSourceName: string; suggestedBranchCode: string }>();
  for (const row of dataRows) {
    if (text(row.Fanpage)) continue;
    const sourceName = req(row, "Nguồn");
    const suggestedBranchCode = req(row, "Cơ_sở_gợi_ý");
    const name = `Chưa xác định - ${sourceName} - ${suggestedBranchCode}`;
    generatedFanpages.set(name, { name, defaultSourceName: sourceName, suggestedBranchCode });
    fanpageNames.add(name);
  }

  const missingRequired = dataRows.filter((row) => !text(row.Interaction_ID));
  if (missingRequired.length) throw new Error(`Có ${missingRequired.length} dòng DATA thiếu Interaction_ID`);
  const interactionIds = new Set(dataRows.map((row) => req(row, "Interaction_ID")));
  if (interactionIds.size !== dataRows.length) throw new Error("DATA có Interaction_ID trùng nhau");

  const canonicalOwner = new Map<string, string>();
  const customerAlias = new Map<string, string>();
  let mergedCustomerKeys = 0;
  for (const row of dataRows) {
    const legacyKey = req(row, "Customer_Key");
    const interactionId = req(row, "Interaction_ID");
    const canonical = text(row.Link_chuẩn) ?? `legacy://missing-link/${interactionId.toLocaleLowerCase()}`;
    const owner = canonicalOwner.get(canonical);
    if (owner && owner !== legacyKey) {
      customerAlias.set(legacyKey, owner);
      mergedCustomerKeys++;
    } else {
      canonicalOwner.set(canonical, legacyKey);
      if (!customerAlias.has(legacyKey)) customerAlias.set(legacyKey, legacyKey);
    }
  }

  const normalizedData = dataRows.map((row) => {
    const interactionId = req(row, "Interaction_ID");
    const sourceName = req(row, "Nguồn");
    const suggestedBranchCode = req(row, "Cơ_sở_gợi_ý");
    const fanpageName = text(row.Fanpage) ?? `Chưa xác định - ${sourceName} - ${suggestedBranchCode}`;
    const assignedBranchCode = req(row, "Cơ_sở_phụ_trách");
    const statusName = req(row, "Trạng_thái");
    const customerObjectName = req(row, "Đối_tượng");
    if (!sourceNames.has(sourceName) || !fanpageNames.has(fanpageName) || !branchCodes.has(suggestedBranchCode) || !branchCodes.has(assignedBranchCode) || !statusNames.has(statusName) || !objectNames.has(customerObjectName)) {
      throw new Error(`DATA dòng ${row.__row} tham chiếu danh mục không tồn tại`);
    }
    const legacyCustomerKey = req(row, "Customer_Key");
    const customerKey = customerAlias.get(legacyCustomerKey) ?? legacyCustomerKey;
    const canonicalLink = text(row.Link_chuẩn) ?? `legacy://missing-link/${interactionId.toLocaleLowerCase()}`;
    const rawLink = text(row.Link_gốc) ?? canonicalLink;
    const customerName = text(row.Tên_KH) ?? `Khách chưa rõ tên (${interactionId})`;
    const createdLeadAt = date(row.Ngày_tạo_lead) ?? date(row.Thời_gian_tạo) ?? new Date(0);
    const createdAt = date(row.Thời_gian_tạo) ?? createdLeadAt;
    const validEmail = (value: unknown) => { const result = email(value); return result && validEmails.has(result) ? result : null; };
    return { row, interactionId, customerKey, canonicalLink, rawLink, customerName, createdLeadAt, createdAt, sourceName, fanpageName, suggestedBranchCode, assignedBranchCode, statusName, customerObjectName, validEmail };
  });

  const customerMap = new Map<string, (typeof normalizedData)[number]>();
  for (const item of [...normalizedData].sort((a, b) => a.createdLeadAt.getTime() - b.createdLeadAt.getTime())) {
    if (!customerMap.has(item.customerKey)) customerMap.set(item.customerKey, item);
  }
  const customerStats = new Map<string, { first: Date; last: Date; current: (typeof normalizedData)[number] }>();
  for (const item of normalizedData) {
    const current = customerStats.get(item.customerKey);
    if (!current) customerStats.set(item.customerKey, { first: item.createdLeadAt, last: item.createdLeadAt, current: item });
    else {
      if (item.createdLeadAt < current.first) current.first = item.createdLeadAt;
      if (item.createdLeadAt >= current.last) { current.last = item.createdLeadAt; current.current = item; }
    }
  }

  const summary = {
    mode: EXECUTE ? "execute" : "dry-run", workbook: WORKBOOK_PATH,
    sheets: workbook.worksheets.map((sheet) => ({ name: sheet.name, rows: sheet.actualRowCount, state: sheet.state })),
    import: { branches: branchRows.length, sources: sourceRows.length, fanpages: fanpageRows.length + generatedFanpages.size, statuses: statusRows.length, objects: objectRows.length, users: users.length, settings: duplicateRows.length + systemRows.length, customers: customerMap.size, interactions: normalizedData.length, adsCosts: adsRows.length, systemLogs: logRows.length },
    normalization: { mergedCustomerKeys, missingLinks: dataRows.filter((row) => !text(row.Link_chuẩn)).length, missingNames: dataRows.filter((row) => !text(row.Tên_KH)).length, missingFanpages: dataRows.filter((row) => !text(row.Fanpage)).length, generatedFanpages: [...generatedFanpages.keys()], adsMissingNames: adsRows.filter((row) => !text(row.Tên_quảng_cáo)).length, adsMissingCosts: adsRows.filter((row) => !text(row.Chi_phí_VND)).length, logsMissingActor: logRows.filter((row) => !text(row.Họ_tên) || !text(row.Vai_trò)).length },
  };
  if (!EXECUTE) { console.log(JSON.stringify(summary, null, 2)); return; }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  await prisma.$transaction(async (tx) => {
    await tx.systemLog.deleteMany(); await tx.mktPageReport.deleteMany();
    await tx.adsCost.deleteMany(); await tx.interaction.deleteMany(); await tx.customer.deleteMany();
    await tx.statusAllowedRole.deleteMany(); await tx.sourceDomain.deleteMany(); await tx.fanpage.deleteMany();
    await tx.appSetting.deleteMany(); await tx.user.deleteMany(); await tx.customerObject.deleteMany();
    await tx.status.deleteMany(); await tx.source.deleteMany(); await tx.branch.deleteMany();

    await tx.branch.createMany({ data: branchRows.map((row) => ({ code: req(row, "Mã_cơ_sở"), name: req(row, "Tên_cơ_sở"), active: bool(row.Hoạt_động), slaReceiveMinutes: int(row.SLA_nhận_phút, 30), slaProcessHours: int(row.SLA_xử_lý_giờ, 24), note: text(row.Ghi_chú) })) });
    await tx.source.createMany({ data: sourceRows.map((row) => ({ name: req(row, "Nguồn"), channelGroup: req(row, "Nhóm_kênh"), sourceGroup: req(row, "Nhóm_nguồn"), requireAdId: bool(row.Bắt_buộc_Ad_ID), active: bool(row.Hoạt_động), note: text(row.Ghi_chú) })) });
    await tx.sourceDomain.createMany({ data: sourceRows.flatMap((row) => (text(row.Domain_nhận_diện)?.split(";") ?? []).map((domain) => ({ sourceName: req(row, "Nguồn"), domain: domain.trim().toLocaleLowerCase() })).filter((item) => item.domain)) });
    await tx.fanpage.createMany({ data: fanpageRows.map((row) => ({ name: req(row, "Fanpage"), defaultSourceName: req(row, "Nguồn_mặc_định"), suggestedBranchCode: req(row, "Cơ_sở_gợi_ý"), requireAdId: bool(row.Bắt_buộc_Ad_ID), active: bool(row.Hoạt_động), note: text(row.Ghi_chú) })) });
    await tx.fanpage.createMany({ data: [...generatedFanpages.values()].map((item) => ({ ...item, requireAdId: false, active: false, note: "Tự sinh khi import: file nguồn không có Fanpage" })) });
    await tx.status.createMany({ data: statusRows.map((row) => ({ name: req(row, "Trạng_thái"), sortOrder: int(row.Thứ_tự), isClosingStatus: bool(row.Trạng_thái_đóng), requirePhone: bool(row.Yêu_cầu_SĐT), active: bool(row.Hoạt_động), note: text(row.Ghi_chú) })) });
    await tx.statusAllowedRole.createMany({ data: statusRows.flatMap((row) => (text(row.Vai_trò_được_cập_nhật)?.split(";") ?? []).map((role) => ({ statusName: req(row, "Trạng_thái"), role: role.trim() })).filter((item) => item.role)) });
    await tx.customerObject.createMany({ data: objectRows.map((row) => ({ name: req(row, "Đối_tượng"), sortOrder: int(row.Thứ_tự), active: bool(row.Hoạt_động) })) });
    await tx.appSetting.createMany({ data: [...duplicateRows.map((row) => ({ configGroup: "duplicate", key: req(row, "Tham_số"), value: text(row.Giá_trị) ?? "", description: text(row.Mô_tả) })), ...systemRows.map((row) => ({ configGroup: "system", key: req(row, "Tham_số"), value: text(row.Giá_trị) ?? "", description: text(row.Mô_tả) }))] });
    await tx.user.createMany({ data: users.map((user) => ({ ...user, passwordHash, mustChangePassword: true })) });

    const customerData = [...customerMap.entries()].map(([customerKey, base]) => { const stats = customerStats.get(customerKey)!; return { customerKey, displayName: stats.current.customerName, canonicalLink: base.canonicalLink, phoneNormalized: text(stats.current.row.SĐT_chuẩn), firstTouchAt: stats.first, lastTouchAt: stats.last, currentStatusName: stats.current.statusName }; });
    for (const batch of batches(customerData)) await tx.customer.createMany({ data: batch });
    for (const batch of batches(normalizedData)) await tx.interaction.createMany({ data: batch.map((item) => ({ interactionId: item.interactionId, customerKey: item.customerKey, version: int(item.row.Version, 1), activeFlag: bool(item.row.Active_Flag), createdLeadAt: item.createdLeadAt, sourceName: item.sourceName, fanpageName: item.fanpageName, adId: text(item.row.Ad_ID), firstTouchAdId: text(item.row.First_touch_Ad_ID), lastTouchAdId: text(item.row.Last_touch_Ad_ID), rawLink: item.rawLink, canonicalLink: item.canonicalLink, customerName: item.customerName, customerObjectName: item.customerObjectName, suggestedBranchCode: item.suggestedBranchCode, assignedBranchCode: item.assignedBranchCode, statusName: item.statusName, interactionType: req(item.row, "Loại_tương_tác"), touchCount: int(item.row.Lần_tương_tác, 1), assignedSaleEmail: item.validEmail(item.row.Email_tư_vấn), receivedAt: date(item.row.Ngày_nhận), phoneRaw: text(item.row.SĐT_gốc), phoneNormalized: text(item.row.SĐT_chuẩn), phoneCapturedAt: date(item.row.Ngày_có_SĐT), closedAt: date(item.row.Ngày_đóng), transferredToPse: bool(item.row.Đã_chuyển_PSE), pseProfileCode: text(item.row.Mã_hồ_sơ_PSE), createdByEmail: item.validEmail(item.row.Email_người_tạo) ?? fallbackUser, createdAt: item.createdAt, updatedByEmail: item.validEmail(item.row.Email_người_cập_nhật), updatedAt: date(item.row.Thời_gian_cập_nhật), reassignedByEmail: item.validEmail(item.row.Email_người_điều_chuyển), reassignReason: text(item.row.Lý_do_điều_chuyển), needsFollowup: bool(item.row.Cần_chăm_sóc_lại), mktPushedAt: date(item.row.Thời_gian_push_MKT), mktPushedByEmail: item.validEmail(item.row.Email_push_MKT), conversationLink: text(item.row.Link_hội_thoại), mktSuggestion: text(item.row.Gợi_ý_chăm_sóc_MKT), followupHandledByEmail: item.validEmail(item.row.Email_xử_lý_chăm_sóc_lại), followupHandledAt: date(item.row.Thời_gian_xử_lý_chăm_sóc_lại) })) });
    for (const batch of batches(adsRows)) await tx.adsCost.createMany({ data: batch.map((row) => { const period = reportPeriod(row.Kỳ_báo_cáo); const adId = req(row, "Ad_ID"); return { periodStart: period.start, periodEnd: period.end, adId, adName: text(row.Tên_quảng_cáo) ?? `Quảng cáo ${adId}`, sourceName: sourceNames.has(text(row.Nguồn) ?? "") ? text(row.Nguồn) : null, fanpageName: fanpageNames.has(text(row.Fanpage) ?? "") ? text(row.Fanpage) : null, branchCode: branchCodes.has(text(row.Cơ_sở) ?? "") ? text(row.Cơ_sở) : null, costVnd: text(row.Chi_phí_VND) ?? "0", note: text(row.Ghi_chú), updatedByEmail: validEmails.has(email(row.Người_cập_nhật) ?? "") ? email(row.Người_cập_nhật) : null, updatedAt: date(row.Cập_nhật_lúc) ?? new Date(0) }; }) });
    for (const batch of batches(logRows)) await tx.systemLog.createMany({ data: batch.map((row) => { const actor = email(row.Email); const interactionId = text(row.Interaction_ID); return { logId: req(row, "Log_ID"), loggedAt: date(row.Thời_gian) ?? new Date(0), actorEmail: actor && validEmails.has(actor) ? actor : null, actorName: text(row.Họ_tên) ?? "Hệ thống", actorRole: text(row.Vai_trò) ?? "Hệ thống", action: req(row, "Hành_động"), interactionId: interactionId && interactionIds.has(interactionId) ? interactionId : null, detailOld: json(row.Chi_tiết_cũ), detailNew: json(row.Chi_tiết_mới), result: req(row, "Kết_quả"), technicalInfo: text(row.Thông_tin_kỹ_thuật) }; }) });
  }, { timeout: 180_000, maxWait: 20_000 });

  const verification = { customers: await prisma.customer.count(), interactions: await prisma.interaction.count(), adsCosts: await prisma.adsCost.count(), systemLogs: await prisma.systemLog.count(), users: await prisma.user.count() };
  console.log(JSON.stringify({ ...summary, verification, defaultPassword: DEFAULT_PASSWORD }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
