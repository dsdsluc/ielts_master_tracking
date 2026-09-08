// Port detectSourceFromLink_/assertFanpageMatchesSource_/suggestBranchFromFanpage_/
// sourceRequiresAdId_ (DuplicateService.gs + LeadService.gs). Nguồn được HỆ
// THỐNG tự nhận diện từ domain của Link_gốc — Sale không tự chọn Nguồn, chỉ
// chọn Fanpage; hệ thống đối chiếu Fanpage phải cùng Nguồn vừa nhận diện.
import { prisma } from "@/lib/prisma";
import { extractUrlHost } from "@/lib/interactions/link";
import { ApiError } from "@/lib/interactions/errors";

export async function detectSourceFromLink(rawLink: string): Promise<{ sourceName: string; host: string }> {
  const host = extractUrlHost(rawLink);
  if (!host) throw new ApiError(422, "VALIDATION_ERROR", "Link khách hàng không hợp lệ nên chưa thể tự xác định nguồn.");

  const sources = await prisma.source.findMany({
    where: { active: true },
    include: { domains: true },
  });

  const matched = sources.find((source) =>
    source.domains.some(({ domain }) => {
      const pattern = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
      return host === pattern || host.endsWith("." + pattern);
    })
  );
  const fallback = matched ?? sources.find((s) => s.name === "Khác");
  if (!fallback) {
    throw new ApiError(422, "VALIDATION_ERROR", `Không tìm thấy nguồn phù hợp với domain "${host}". Hãy thêm domain vào cấu hình Nguồn.`);
  }
  return { sourceName: fallback.name, host };
}

export async function assertFanpageMatchesSource(fanpageName: string, sourceName: string) {
  const fanpage = await prisma.fanpage.findFirst({ where: { name: fanpageName, active: true } });
  if (!fanpage) throw new ApiError(422, "VALIDATION_ERROR", "Fanpage không có trong danh mục hoặc đang ngừng hoạt động.");
  if (fanpage.defaultSourceName !== sourceName) {
    throw new ApiError(422, "VALIDATION_ERROR", `Fanpage đã chọn không thuộc nguồn ${sourceName}. Hãy chọn lại trang sau khi hệ thống nhận diện nguồn.`);
  }
  return fanpage;
}

export async function suggestBranchFromFanpage(fanpageName: string): Promise<string | null> {
  const fanpage = await prisma.fanpage.findFirst({ where: { name: fanpageName, active: true } });
  return fanpage?.suggestedBranchCode ?? null;
}

export async function sourceRequiresAdId(sourceName: string, fanpageName: string): Promise<boolean> {
  const [source, fanpage] = await Promise.all([
    prisma.source.findFirst({ where: { name: sourceName, active: true } }),
    prisma.fanpage.findFirst({ where: { name: fanpageName, active: true } }),
  ]);
  return !!source?.requireAdId || !!fanpage?.requireAdId;
}
