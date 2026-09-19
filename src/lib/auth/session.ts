import "server-only";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies, headers } from "next/headers";

const SESSION_COOKIE = "session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("Thiếu biến môi trường SESSION_SECRET");
}
const encodedKey = new TextEncoder().encode(secretKey);

export type SessionPayload = {
  email: string;
  fullName: string;
  role: string;
  branchCode: string | null;
  viewAllBranches: boolean;
};

async function encrypt(payload: SessionPayload & JWTPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

async function decrypt(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionPayload) {
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  // Không dùng NODE_ENV === "production" để quyết định cờ Secure — build
  // production (next start) LUÔN có NODE_ENV=production kể cả khi tạm chạy
  // qua HTTP thô (vd VPS chưa có domain/SSL, chỉ có Nginx proxy HTTP). Cookie
  // Secure bị trình duyệt âm thầm từ chối lưu lại trên kết nối HTTP, khiến
  // login xong nhưng mọi trang sau đó không thấy session, tự đá về lại
  // /login. Dò đúng giao thức thực tế qua "x-forwarded-proto" (Vercel edge và
  // Nginx reverse proxy trong dự án này đều tự gắn header này) — tự động
  // chuyển sang Secure khi bật HTTPS sau này, không cần sửa code lại.
  const proto = (await headers()).get("x-forwarded-proto");
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: proto === "https",
    expires: new Date(Date.now() + SESSION_DURATION_MS),
    sameSite: "lax",
    path: "/",
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

// Dùng trong proxy.ts (chạy Edge/Node runtime riêng, không có next/headers cookies()).
export async function decryptSessionToken(token: string | undefined) {
  return decrypt(token);
}

export { SESSION_COOKIE };
