import { Megaphone } from "lucide-react";
import { ListPage } from "@/components/list-page";

export default function AdsCostPage() {
  return (
    <ListPage
      eyebrow="Marketing"
      title="Chi phí quảng cáo"
      description="Chi phí theo Ad ID từng kỳ báo cáo — dùng để tính CP/liên hệ trên Dashboard."
      columns={[
        "Kỳ báo cáo",
        "Ad ID",
        "Tên quảng cáo",
        "Nguồn",
        "Fanpage",
        "Cơ sở",
        "Chi phí (VND)",
      ]}
      emptyIcon={Megaphone}
      emptyTitle="Chưa có dữ liệu chi phí"
      emptyDescription="Thêm chi phí quảng cáo theo kỳ để tính hiệu quả trên Dashboard."
    />
  );
}
