-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "followup_target_sale_email" TEXT;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_followup_target_sale_email_fkey" FOREIGN KEY ("followup_target_sale_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;
