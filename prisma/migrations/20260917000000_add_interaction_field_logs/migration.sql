-- Nhật ký thay đổi từng field của Interaction khi Sửa thông tin — chỉ ghi khi
-- GHI ĐÈ 1 giá trị đã có sẵn (điền lần đầu vào field trống không tính là
-- "thay đổi") — xem updateInteractionInfo() trong lib/interactions/mutations.ts.
CREATE TABLE "interaction_field_logs" (
    "id" TEXT NOT NULL,
    "interaction_id" TEXT NOT NULL,
    "field_key" TEXT NOT NULL,
    "field_label" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by_email" TEXT NOT NULL,
    "changed_by_name" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_field_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interaction_field_logs_interaction_id_idx" ON "interaction_field_logs"("interaction_id");

-- CreateIndex
CREATE INDEX "interaction_field_logs_field_key_idx" ON "interaction_field_logs"("field_key");

-- AddForeignKey
ALTER TABLE "interaction_field_logs" ADD CONSTRAINT "interaction_field_logs_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("interaction_id") ON DELETE CASCADE ON UPDATE CASCADE;
