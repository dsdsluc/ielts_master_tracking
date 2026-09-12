-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "appointment_at" TIMESTAMP(3),
ADD COLUMN     "case_deadline" TIMESTAMP(3),
ADD COLUMN     "needs_leader_support" BOOLEAN NOT NULL DEFAULT false;
