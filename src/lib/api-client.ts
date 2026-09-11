"use client";

// Helper gọi API dùng chung cho mọi client component, để không phải lặp lại
// try/catch + kiểm tra res.ok ở từng nơi (và để không quên xử lý 2 tình huống
// hay bị bỏ sót: mất mạng và hết phiên đăng nhập).

const NETWORK_ERROR_MESSAGE =
  "Không thể kết nối tới máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.";
const SERVER_ERROR_MESSAGE = "Máy chủ đang gặp sự cố. Vui lòng thử lại sau ít phút.";
const SESSION_EXPIRED_MESSAGE = "Phiên đăng nhập đã hết hạn, đang chuyển về trang đăng nhập…";

type ApiErrorBody = { error?: string; code?: string };

export class ApiClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Gọi fetch + parse JSON, không tự throw khi res không ok — dùng cho những
 * chỗ cần tự đọc status code (vd. 409 xác nhận trùng lặp ở leads-api.ts).
 * Vẫn tự xử lý lỗi mất mạng và hết phiên vì 2 trường hợp đó không bao giờ là
 * "kết quả hợp lệ" mà caller cần tự phân nhánh.
 */
export async function apiRequest<T = unknown>(
  input: string,
  init?: RequestInit
): Promise<{ res: Response; data: (T & ApiErrorBody) | null }> {
  const hasBody = init?.body !== undefined;
  let res: Response;
  try {
    res = await fetch(input, {
      credentials: "same-origin",
      ...init,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiClientError(NETWORK_ERROR_MESSAGE, 0);
  }

  if (res.status === 401) {
    // Điều hướng cứng (không dùng router.push) vì đây là Route Handler cần
    // xoá cookie phiên ở server trước khi redirect, không phải 1 page điều
    // hướng client-side thuần.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (typeof window !== "undefined") window.location.href = "/api/auth/session-expired";
    throw new ApiClientError(SESSION_EXPIRED_MESSAGE, 401);
  }

  const data = (await res.json().catch(() => null)) as (T & ApiErrorBody) | null;
  return { res, data };
}

/**
 * Gọi API và throw ApiClientError (message tiếng Việt) nếu thất bại — dùng
 * cho tuyệt đại đa số các lệnh gọi, nơi caller chỉ cần bắt lỗi 1 lần rồi hiển
 * thị message ra toast/FormMessage.
 */
export async function apiFetch<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const { res, data } = await apiRequest<T>(input, init);
  if (!res.ok) {
    const message =
      data?.error ?? (res.status >= 500 ? SERVER_ERROR_MESSAGE : `Yêu cầu thất bại (mã lỗi ${res.status}).`);
    throw new ApiClientError(message, res.status, data?.code);
  }
  return data as T;
}

/** Rút message tiếng Việt an toàn từ 1 lỗi bất kỳ để hiển thị cho người dùng. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Đã có lỗi không xác định xảy ra.";
}
