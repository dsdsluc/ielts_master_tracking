/** Khoá ngày theo giờ địa phương của server — dùng để gộp số liệu theo ngày
 * mà không lệch múi giờ như khi dùng toISOString().slice(0,10) (luôn theo UTC). */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
