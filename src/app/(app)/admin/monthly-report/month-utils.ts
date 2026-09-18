// Hàm thuần xử lý chuỗi "YYYY-MM" — tách riêng khỏi lib/admin/monthly-report.ts
// (có "server-only", đọc DB) để Client Component (month-picker, nút điều
// hướng tháng) import được mà không kéo theo Prisma vào bundle trình duyệt.

export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `Tháng ${Number(m)}/${y}`;
}

/** Tháng liền trước/sau (delta âm/dương) — dùng cho nút điều hướng và chọn
 * nhanh tháng so sánh. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
