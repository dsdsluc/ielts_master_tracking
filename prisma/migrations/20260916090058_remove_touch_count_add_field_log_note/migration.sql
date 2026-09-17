-- AlterTable
ALTER TABLE "interactions" DROP COLUMN "touch_count";

-- AlterTable
ALTER TABLE "interaction_field_logs" ADD COLUMN "note" TEXT;
