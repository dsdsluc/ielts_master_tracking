/*
  Warnings:

  - You are about to drop the column `email_thread_message_id` on the `interactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "interactions" DROP COLUMN "email_thread_message_id";

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "to_email" TEXT NOT NULL,
    "bcc_emails" TEXT[],
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sent_by_email" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_message_interactions" (
    "id" TEXT NOT NULL,
    "email_message_id" TEXT NOT NULL,
    "interaction_id" TEXT NOT NULL,

    CONSTRAINT "email_message_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_message_id_key" ON "email_messages"("message_id");

-- CreateIndex
CREATE INDEX "email_messages_sent_at_idx" ON "email_messages"("sent_at");

-- CreateIndex
CREATE INDEX "email_message_interactions_interaction_id_idx" ON "email_message_interactions"("interaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_message_interactions_email_message_id_interaction_id_key" ON "email_message_interactions"("email_message_id", "interaction_id");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_sent_by_email_fkey" FOREIGN KEY ("sent_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message_interactions" ADD CONSTRAINT "email_message_interactions_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_message_interactions" ADD CONSTRAINT "email_message_interactions_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("interaction_id") ON DELETE CASCADE ON UPDATE CASCADE;
