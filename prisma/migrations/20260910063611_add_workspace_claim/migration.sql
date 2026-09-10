-- AlterTable
ALTER TABLE "interactions" ADD COLUMN     "workspace_claimed_by_email" TEXT;

-- CreateIndex
CREATE INDEX "interactions_workspace_claimed_by_email_idx" ON "interactions"("workspace_claimed_by_email");

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_workspace_claimed_by_email_fkey" FOREIGN KEY ("workspace_claimed_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;
