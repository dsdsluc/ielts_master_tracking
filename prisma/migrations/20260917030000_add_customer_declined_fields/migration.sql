-- "Tư vấn xong" (khách từ chối) — xem comment trong schema.prisma (model Customer)
ALTER TABLE "customers" ADD COLUMN "declined_at" TIMESTAMP(3);
ALTER TABLE "customers" ADD COLUMN "declined_by_email" TEXT;

CREATE INDEX "customers_declined_at_idx" ON "customers"("declined_at");

ALTER TABLE "customers" ADD CONSTRAINT "customers_declined_by_email_fkey" FOREIGN KEY ("declined_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;
