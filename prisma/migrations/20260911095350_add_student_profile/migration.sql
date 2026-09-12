-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "interaction_id" TEXT,
    "student_name" TEXT NOT NULL,
    "age" INTEGER,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "parent_name" TEXT,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "level" TEXT,
    "training_track" TEXT,
    "school" TEXT,
    "aspiration" TEXT,
    "stage" TEXT,
    "stage_reason" TEXT,
    "assigned_to_email" TEXT NOT NULL,
    "assigned_by_email" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_email" TEXT,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_care_logs" (
    "id" TEXT NOT NULL,
    "student_profile_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logged_by_email" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "stage_at_log_time" TEXT,

    CONSTRAINT "student_care_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_profiles_assigned_to_email_idx" ON "student_profiles"("assigned_to_email");

-- CreateIndex
CREATE INDEX "student_profiles_interaction_id_idx" ON "student_profiles"("interaction_id");

-- CreateIndex
CREATE INDEX "student_care_logs_student_profile_id_idx" ON "student_care_logs"("student_profile_id");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("interaction_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_assigned_to_email_fkey" FOREIGN KEY ("assigned_to_email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_assigned_by_email_fkey" FOREIGN KEY ("assigned_by_email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_updated_by_email_fkey" FOREIGN KEY ("updated_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_care_logs" ADD CONSTRAINT "student_care_logs_student_profile_id_fkey" FOREIGN KEY ("student_profile_id") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_care_logs" ADD CONSTRAINT "student_care_logs_logged_by_email_fkey" FOREIGN KEY ("logged_by_email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;
