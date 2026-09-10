-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "sla_flagged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sla_flagged_at" TIMESTAMP(3),
ADD COLUMN     "sla_flagged_by_email" TEXT;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_sla_flagged_by_email_fkey" FOREIGN KEY ("sla_flagged_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;
