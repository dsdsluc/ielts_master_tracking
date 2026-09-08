import { ZodError } from "zod";
import { LinkValidationError } from "@/lib/interactions/link";

export class ApiError extends Error {
  status: number;
  code: string;
  data?: unknown;

  constructor(status: number, code: string, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export const Errors = {
  badRequest: (message: string, data?: unknown) => new ApiError(422, "VALIDATION_ERROR", message, data),
  forbidden: (message = "Bạn không có quyền thực hiện chức năng này.") => new ApiError(403, "FORBIDDEN", message),
  notFound: (message = "Không tìm thấy hội thoại.") => new ApiError(404, "NOT_FOUND", message),
  conflict: (message: string, data?: unknown) => new ApiError(409, "CONFLICT", message, data),
  staleVersion: () =>
    new ApiError(
      409,
      "DATA_CHANGED",
      "Dữ liệu vừa được người khác cập nhật. Hãy tải lại hội thoại và thực hiện lại.",
      undefined
    ),
  duplicateConfirmRequired: (data: unknown) =>
    new ApiError(
      409,
      "DUPLICATE_CONFIRM_REQUIRED",
      "Đã có hội thoại gần đây của cùng khách. Xác nhận nếu khách thực sự quay lại tạo lượt mới.",
      data
    ),
};

/** Chuẩn hoá mọi lỗi ném ra trong route handler thành 1 JSON response. */
export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof LinkValidationError) {
    return Response.json({ error: err.message, code: "VALIDATION_ERROR" }, { status: 422 });
  }
  if (err instanceof ZodError) {
    return Response.json(
      { error: err.issues[0]?.message ?? "Dữ liệu không hợp lệ.", code: "VALIDATION_ERROR" },
      { status: 422 }
    );
  }
  console.error(err);
  return Response.json({ error: "Đã có lỗi hệ thống. Vui lòng thử lại." }, { status: 500 });
}
