import { Redis } from "@upstash/redis";

// Upstash là REST client (HTTP, không giữ kết nối TCP) — an toàn cho serverless
// (Vercel). Thiếu biến môi trường (chưa cấu hình trên môi trường này) thì tắt
// cache hoàn toàn, luôn compute thẳng — cache chỉ là tối ưu hiệu năng, KHÔNG
// phải nguồn sự thật, nên không có Redis không được làm sập trang.
const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN })
    : null;

/**
 * Đọc cache trước; miss (hoặc Redis lỗi/chưa cấu hình) thì gọi `compute()` rồi
 * ghi lại kết quả với TTL. Chỉ cache dữ liệu đã tính toán xong (JSON thuần —
 * không Date, không class instance) vì Upstash serialize qua JSON, đọc lại
 * sẽ mất kiểu Date.
 */
export async function cached<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  if (!redis) return compute();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch (err) {
    console.error("[cache] read failed, falling back to compute:", err);
  }

  const value = await compute();

  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (err) {
    console.error("[cache] write failed (ignored):", err);
  }

  return value;
}
