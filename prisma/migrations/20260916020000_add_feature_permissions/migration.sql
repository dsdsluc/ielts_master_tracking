-- Bảng phân quyền theo tính năng + vai trò (Thêm/Sửa/Xóa/Báo cáo) — Admin cấu
-- hình ở /admin/permissions. Admin không có dòng riêng (luôn full quyền, xem
-- require-admin.ts) nên chỉ seed sẵn Marketing/Saler/Leader cho từng tính
-- năng — mặc định false hết (chưa phân quyền), Admin tự tick sau.
CREATE TABLE "feature_permissions" (
    "feature" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_report" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "feature_permissions_pkey" PRIMARY KEY ("feature", "role")
);

INSERT INTO "feature_permissions" ("feature", "role") VALUES
    ('interactions', 'Marketing'),
    ('interactions', 'Saler'),
    ('interactions', 'Leader'),
    ('followup', 'Marketing'),
    ('followup', 'Saler'),
    ('followup', 'Leader'),
    ('students', 'Marketing'),
    ('students', 'Saler'),
    ('students', 'Leader');
