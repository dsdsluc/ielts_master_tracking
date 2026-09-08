import { extractUrlHost } from "@/lib/interactions/link";

export type LeadFormOptions = {
  sourceDomains: { sourceName: string; domain: string }[];
  fanpages: { name: string; defaultSourceName: string }[];
  branches: { code: string; name: string }[];
  objects: string[];
};

/** Nhận diện Nguồn từ domain trong link — mirror detectSourceFromLink phía
 * server (lib/interactions/source-detection.ts), chỉ dùng để gợi ý/lọc UI.
 * Server vẫn là nơi xác thực cuối cùng khi submit. */
export function detectSourceName(rawLink: string, sourceDomains: LeadFormOptions["sourceDomains"]): string | null {
  const host = extractUrlHost(rawLink);
  if (!host) return null;
  const matched = sourceDomains.find(({ domain }) => host === domain || host.endsWith("." + domain));
  return matched?.sourceName ?? null;
}
