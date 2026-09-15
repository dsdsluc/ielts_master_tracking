const ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape 1 chuỗi trước khi chèn vào HTML email — nội dung như tên khách hàng
 * hay gợi ý của Marketing là dữ liệu người dùng nhập, không được tin tưởng
 * ngay cả trong nội bộ (email này còn được hiển thị lại nguyên trạng trong
 * app ở mục "Email đã gửi" qua dangerouslySetInnerHTML, không chỉ gửi qua
 * Gmail — thiếu bước này là mở đường XSS lưu trữ). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}
