import { redirect } from "next/navigation";

// Đã gỡ khỏi nav — nhãn "Quá hạn SLA" giờ hiển thị thẳng trên từng dòng ở
// trang /leads (xem slaOverdue trong lib/interactions/queries.ts), nên trang
// riêng này không còn cần thiết. Chặn truy cập trực tiếp bằng redirect thay
// vì xoá route hẳn.
export default function SlaQueuePage() {
  redirect("/leads");
}
