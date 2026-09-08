import { createHash, randomUUID } from "node:crypto";

/** INT-yyyyMMdd-HHmmss-XXXXXX — port newInteractionId_(). */
export function newInteractionId(): string {
  const now = new Date();
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  return `INT-${stamp}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

/**
 * CUS-<12 hex đầu của SHA1(seed)> — port makeCustomerKey_(). Cố ý DETERMINISTIC
 * theo Link_chuẩn ("url:" + linkNorm) để cùng một khách (cùng link) luôn ra
 * cùng Customer_Key kể cả trước khi có Customer row nào — khớp hành vi gốc.
 */
export function makeCustomerKey(seed: string): string {
  const hash = createHash("sha1").update(seed, "utf8").digest("hex").toUpperCase();
  return `CUS-${hash.slice(0, 12)}`;
}

export function newLogId(): string {
  const now = new Date();
  const stamp =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0") +
    "-" +
    String(now.getHours()).padStart(2, "0") +
    String(now.getMinutes()).padStart(2, "0") +
    String(now.getSeconds()).padStart(2, "0");
  return `TL248-${stamp}-${randomUUID().slice(0, 8).toUpperCase()}`;
}
