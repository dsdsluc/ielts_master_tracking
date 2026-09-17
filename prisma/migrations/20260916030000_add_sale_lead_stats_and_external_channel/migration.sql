-- 1) Bảng đếm riêng số lần Sale tạo liên hệ + số lần tạo ra đã Đủ điều kiện —
-- xem model SaleLeadStat (schema.prisma). Cập nhật tại createInteraction()
-- (mutations.ts), không tính bằng cách query lại Interaction.
CREATE TABLE "sale_lead_stats" (
    "sale_email" TEXT NOT NULL,
    "total_created" INTEGER NOT NULL DEFAULT 0,
    "total_qualified" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sale_lead_stats_pkey" PRIMARY KEY ("sale_email")
);

ALTER TABLE "sale_lead_stats"
    ADD CONSTRAINT "sale_lead_stats_sale_email_fkey"
    FOREIGN KEY ("sale_email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Nguồn "Zalo" cho tab "Ngoài" ở form tạo liên hệ (Zalo/TikTok/Giới thiệu/
-- Khác — TikTok/Giới thiệu/Khác đã có sẵn từ trước).
INSERT INTO "sources" ("name", "channel_group", "source_group", "require_ad_id", "active", "note")
VALUES ('Zalo', 'Mạng xã hội', 'Tự nhiên', false, true, NULL);

-- 3) Fanpage placeholder dùng chung cho MỌI liên hệ tạo từ tab "Ngoài" —
-- interactions.fanpage_name là khóa ngoại bắt buộc nhưng tab Ngoài không
-- thật sự thuộc fanpage nào. default_source_name/suggested_branch_code chỉ
-- là giá trị hợp lệ cho đủ ràng buộc DB — KHÔNG dùng để suy luận gì (tab
-- Ngoài tự chọn Nguồn + Cơ sở riêng, resolver không đối chiếu lại 2 cột này).
INSERT INTO "fanpages" ("name", "default_source_name", "suggested_branch_code", "require_ad_id", "active", "note")
VALUES (
    'Ngoài kênh online',
    'Khác',
    'TDM',
    false,
    true,
    'Placeholder hệ thống cho liên hệ tạo từ tab "Ngoài" (Zalo/TikTok/Giới thiệu/Khác không qua link) — không đại diện cho 1 fanpage thật, không xoá.'
);
