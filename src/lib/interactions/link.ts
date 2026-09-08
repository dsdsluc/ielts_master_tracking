// Port 1:1 từ DuplicateService.gs trong docs/TRACKING_LEADS/Backend.js
// (normalizeUrl_, normalizeHost_, normalizePhone_, normalizeConversationLink_,
// validateConversationLinkInput_). Đây là logic đã chạy thật trên production
// cũ — không viết lại "cho gọn", giữ đúng case đặc biệt của từng domain.

const TRACKED_QUERY_KEYS = ["fbclid", "gclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "mibextid"];

export function normalizeHost(hostRaw: string): string {
  let h = hostRaw.trim().toLowerCase().replace(/^(www\.|mobile\.)/, "");
  // m.me là domain thật của Messenger, không được cắt thành "me".
  if (h.startsWith("m.") && h !== "m.me") h = h.slice(2);
  return h;
}

export function extractUrlHost(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) return "";
  const withScheme = /^https?:\/\//i.test(s) ? s : "https://" + s.replace(/^\/+/, "");
  const m = withScheme.match(/^https?:\/\/([^/?#]+)/i);
  return m ? normalizeHost(m[1]) : "";
}

/** Chuẩn hóa Link_gốc -> Link_chuẩn dùng để dedup. */
export function canonicalizeLink(raw: string): string {
  let s = raw.trim();
  if (!s) return "";
  s = s.replace(/\\/g, "/").replace(/\s+/g, "");
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  s = s.split("#")[0];
  const lower = s.toLowerCase();
  const hostMatch = lower.match(/^https?:\/\/([^/?]+)/i);
  if (!hostMatch) return "";
  const host = normalizeHost(hostMatch[1]);
  const rest = lower.slice(hostMatch[0].length);
  const [pathRaw, query = ""] = rest.split("?");
  const path = (pathRaw || "").replace(/\/+/g, "/").replace(/\/$/, "");

  if (/facebook\.com$/.test(host)) {
    if (path === "/profile.php") {
      const idMatch = query.match(/(?:^|&)id=([^&]+)/);
      if (idMatch) return "https://facebook.com/profile.php?id=" + decodeURIComponent(idMatch[1]);
    }
    const fp = path.split("/").filter(Boolean);
    return fp.length ? "https://facebook.com/" + fp[0] : "https://facebook.com";
  }
  if (/tiktok\.com$/.test(host)) {
    const tp = path.split("/").filter(Boolean);
    return tp.length ? "https://tiktok.com/" + tp[0] : "https://tiktok.com";
  }
  if (/instagram\.com$/.test(host)) {
    const ip = path.split("/").filter(Boolean);
    return ip.length ? "https://instagram.com/" + ip[0] : "https://instagram.com";
  }

  const cleanedQuery = query
    .split("&")
    .filter((pair) => !TRACKED_QUERY_KEYS.includes(pair.split("=")[0]))
    .join("&");
  return ("https://" + host + path + (cleanedQuery ? "?" + cleanedQuery : "")).replace(/\/$/, "");
}

export function looksLikeUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return false;
  return /^https?:\/\//i.test(s) || /^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#]|$)/i.test(s);
}

function parseUrlParts(raw: string): { host: string; path: string; query: string } | null {
  const s = raw.trim();
  if (!looksLikeUrl(s)) return null;
  const withScheme = /^https?:\/\//i.test(s) ? s : "https://" + s.replace(/^\/+/, "");
  const m = withScheme.match(/^https?:\/\/([^/?#]+)([^?#]*)(?:\?([^#]*))?/i);
  if (!m) return null;
  return { host: normalizeHost(m[1]), path: (m[2] || "").replace(/\/+/g, "/"), query: m[3] || "" };
}

/**
 * Link hội thoại: chỉ cho lưu nếu là URL hợp lệ. Với business.facebook.com
 * (Meta Inbox), bắt buộc phải trỏ đúng 1 hội thoại cụ thể (có
 * selected_item_id) — không cho lưu link "Inbox chung" vì không tìm lại
 * được đúng khách sau này.
 */
export function validateConversationLink(raw: string | undefined | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const parts = parseUrlParts(s);
  if (!parts) throw new LinkValidationError("Link hội thoại không hợp lệ. Hãy dán URL hội thoại cụ thể hoặc để trống.");
  if (parts.host === "business.facebook.com") {
    if (!/^\/latest\/inbox(?:\/|$)/i.test(parts.path)) {
      throw new LinkValidationError("Link hội thoại không hợp lệ. Hãy dán URL hội thoại cụ thể hoặc để trống.");
    }
    const hasSelected = /(?:^|&)selected_item_id=/.test(parts.query);
    if (!hasSelected) {
      throw new LinkValidationError(
        "Link hội thoại đang mở Inbox chung. Hãy mở đúng khách để link có selected_item_id, hoặc để trống trường này."
      );
    }
  }
  return s;
}

export class LinkValidationError extends Error {}

const VN_PHONE_RE = /^0\d{9}$/;

/** Chuẩn hóa SĐT về 10 số bắt đầu bằng 0. Trả về "" nếu không hợp lệ. */
export function normalizePhone(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  let digits = s.replace(/\D/g, "");
  if (digits.startsWith("0084")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("84") && (digits.length === 11 || digits.length === 12)) digits = "0" + digits.slice(2);
  if (digits.length === 9 && digits.charAt(0) !== "0") digits = "0" + digits;
  return VN_PHONE_RE.test(digits) ? digits : "";
}
