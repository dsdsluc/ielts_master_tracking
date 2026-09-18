-- Khoá hội thoại chung cho email KHÔNG gắn với 1 liên hệ cụ thể (nhắc KPI,
-- digest SLA, digest gợi ý phân bổ, thông báo phân bổ khách hàng...) — xem
-- comment model EmailMessage trong schema.prisma.
ALTER TABLE "email_messages" ADD COLUMN "thread_key" TEXT;

CREATE INDEX "email_messages_thread_key_idx" ON "email_messages"("thread_key");
