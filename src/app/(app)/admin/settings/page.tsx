import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { SettingCard } from "@/app/(app)/admin/settings/setting-card";

// Danh sách cố định — đúng 2 tham số thật sự được lib/interactions/settings.ts
// đọc (fallback về default nếu DB chưa có dòng nào). Không làm CRUD key/value
// tự do vì thêm 1 key lạ sẽ không được code nào đọc tới, gây hiểu lầm là có
// tác dụng.
const KNOWN_SETTINGS = [
  {
    configGroup: "duplicate",
    key: "DUP_WINDOW_HOURS",
    label: "Cửa sổ chống trùng liên hệ (giờ)",
    description:
      "Nếu cùng 1 khách (cùng Link chuẩn) nhắn lại trong khoảng thời gian này, hệ thống cảnh báo nghi trùng khi Sale tạo liên hệ mới.",
    fallback: "24",
  },
  {
    configGroup: "system",
    key: "SPAM_NO_REPLY_MIN_ATTEMPTS",
    label: "Số lần chăm sóc tối thiểu trước khi đóng Spam vì im lặng",
    description:
      "Sale phải bấm \"Ghi nhận đã liên hệ\" đủ số lần này, ở các ngày khác nhau, mới được đóng Spam với lý do khách im lặng.",
    fallback: "3",
  },
];

export default async function SettingsPage() {
  const rows = await prisma.appSetting.findMany();
  const valueByKey = new Map(rows.map((r) => [`${r.configGroup}.${r.key}`, r.value]));

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Cấu hình hệ thống"
        description="Tham số hệ thống và quy tắc chống trùng liên hệ."
      />

      <div className="flex flex-col gap-4">
        {KNOWN_SETTINGS.map((s) => {
          const mapKey = `${s.configGroup}.${s.key}`;
          const stored = valueByKey.get(mapKey);
          return (
            <SettingCard
              key={mapKey}
              configGroup={s.configGroup}
              settingKey={s.key}
              label={s.label}
              description={s.description}
              initialValue={stored ?? s.fallback}
              isDefault={stored === undefined}
            />
          );
        })}
      </div>
    </>
  );
}
