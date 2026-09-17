-- AlterTable: extend customers with consulting/enrollment profile fields
ALTER TABLE "customers"
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "date_of_birth" TIMESTAMP(3),
  ADD COLUMN "gender" TEXT,
  ADD COLUMN "parent_name" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "level" TEXT,
  ADD COLUMN "training_track" TEXT,
  ADD COLUMN "school" TEXT,
  ADD COLUMN "aspiration" TEXT,
  ADD COLUMN "stage" TEXT,
  ADD COLUMN "stage_reason" TEXT,
  ADD COLUMN "enrolled_at" TIMESTAMP(3),
  ADD COLUMN "case_deadline" TIMESTAMP(3),
  ADD COLUMN "needs_leader_support" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "appointment_at" TIMESTAMP(3),
  ADD COLUMN "assigned_to_email" TEXT,
  ADD COLUMN "assigned_by_email" TEXT,
  ADD COLUMN "assigned_at" TIMESTAMP(3),
  ADD COLUMN "note" TEXT,
  ADD COLUMN "updated_by_email" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "customers_assigned_to_email_idx" ON "customers"("assigned_to_email");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_to_email_fkey" FOREIGN KEY ("assigned_to_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_by_email_fkey" FOREIGN KEY ("assigned_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_email_fkey" FOREIGN KEY ("updated_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: customer_care_logs
CREATE TABLE "customer_care_logs" (
    "id" TEXT NOT NULL,
    "customer_key" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_by_email" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "stage_at_log_time" TEXT,

    CONSTRAINT "customer_care_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_care_logs_customer_key_idx" ON "customer_care_logs"("customer_key");

-- AddForeignKey
ALTER TABLE "customer_care_logs" ADD CONSTRAINT "customer_care_logs_customer_key_fkey" FOREIGN KEY ("customer_key") REFERENCES "customers"("customer_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_care_logs" ADD CONSTRAINT "customer_care_logs_logged_by_email_fkey" FOREIGN KEY ("logged_by_email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
