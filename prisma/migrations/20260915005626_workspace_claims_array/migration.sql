-- CreateTable
CREATE TABLE "workspace_claims" (
    "id" TEXT NOT NULL,
    "interaction_id" TEXT NOT NULL,
    "sale_email" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_claims_interaction_id_idx" ON "workspace_claims"("interaction_id");

-- CreateIndex
CREATE INDEX "workspace_claims_sale_email_idx" ON "workspace_claims"("sale_email");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_claims_interaction_id_sale_email_key" ON "workspace_claims"("interaction_id", "sale_email");

-- AddForeignKey
ALTER TABLE "workspace_claims" ADD CONSTRAINT "workspace_claims_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("interaction_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_claims" ADD CONSTRAINT "workspace_claims_sale_email_fkey" FOREIGN KEY ("sale_email") REFERENCES "users"("email") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: chuyển các lượt claim độc quyền cũ (workspace_claimed_by_email)
-- sang bảng nhiều-nhiều mới trước khi xoá cột, không mất dữ liệu đang có.
INSERT INTO "workspace_claims" ("id", "interaction_id", "sale_email", "claimed_at", "last_activity_at")
SELECT
    md5(random()::text || clock_timestamp()::text || "interaction_id"),
    "interaction_id",
    "workspace_claimed_by_email",
    COALESCE("updated_at", "created_at"),
    COALESCE("updated_at", "created_at")
FROM "interactions"
WHERE "workspace_claimed_by_email" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "interactions" DROP CONSTRAINT "interactions_workspace_claimed_by_email_fkey";

-- DropIndex
DROP INDEX "interactions_workspace_claimed_by_email_idx";

-- AlterTable
ALTER TABLE "interactions" DROP COLUMN "workspace_claimed_by_email";
