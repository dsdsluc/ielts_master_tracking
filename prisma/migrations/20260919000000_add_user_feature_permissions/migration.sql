-- Phân quyền riêng theo TỪNG NGƯỜI DÙNG — cộng dồn (OR) với feature_permissions
-- theo vai trò, xem canAccessFeature() ở lib/auth/feature-access.ts. Không
-- seed sẵn dòng nào, giống hệt feature_permissions — Admin tick từ tab "Theo
-- người dùng" ở /admin/permissions, dòng thật chỉ tạo lúc bấm lưu lần đầu.
CREATE TABLE "user_feature_permissions" (
    "user_email" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "can_create" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_report" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_feature_permissions_pkey" PRIMARY KEY ("user_email", "feature")
);

ALTER TABLE "user_feature_permissions"
    ADD CONSTRAINT "user_feature_permissions_user_email_fkey"
    FOREIGN KEY ("user_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;
