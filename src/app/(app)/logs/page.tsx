import { ScrollText } from "lucide-react";
import { ListPage } from "@/components/list-page";

export default function LogsPage() {
  return (
    <ListPage
      eyebrow="Nhật ký"
      title="System Log"
      description="Nhật ký thao tác toàn hệ thống — phục vụ audit và đối chiếu."
      columns={[
        "Thời gian",
        "Người thực hiện",
        "Vai trò",
        "Hành động",
        "Liên hệ liên quan",
        "Kết quả",
      ]}
      emptyIcon={ScrollText}
      emptyTitle="Chưa có nhật ký nào"
      emptyDescription="Mọi thao tác quan trọng trên hệ thống sẽ được ghi lại tại đây."
    />
  );
}
