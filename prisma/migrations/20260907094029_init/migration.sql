-- CreateTable
CREATE TABLE "branches" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sla_receive_minutes" INTEGER NOT NULL,
    "sla_process_hours" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "sources" (
    "name" TEXT NOT NULL,
    "channel_group" TEXT NOT NULL,
    "source_group" TEXT NOT NULL,
    "require_ad_id" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "source_domains" (
    "id" SERIAL NOT NULL,
    "source_name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,

    CONSTRAINT "source_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fanpages" (
    "name" TEXT NOT NULL,
    "default_source_name" TEXT NOT NULL,
    "suggested_branch_code" TEXT NOT NULL,
    "require_ad_id" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "fanpages_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "statuses" (
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_closing_status" BOOLEAN NOT NULL DEFAULT false,
    "require_phone" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,

    CONSTRAINT "statuses_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "status_allowed_roles" (
    "id" SERIAL NOT NULL,
    "status_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "status_allowed_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_objects" (
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "customer_objects_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "users" (
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "branch_code" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "view_all_branches" BOOLEAN NOT NULL DEFAULT false,
    "user_key" TEXT,
    "can_close_mkt_report" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" SERIAL NOT NULL,
    "config_group" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "canonical_link" TEXT NOT NULL,
    "phone_normalized" TEXT,
    "first_touch_at" TIMESTAMP(3) NOT NULL,
    "last_touch_at" TIMESTAMP(3) NOT NULL,
    "current_status_name" TEXT NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_key")
);

-- CreateTable
CREATE TABLE "interactions" (
    "interaction_id" TEXT NOT NULL,
    "customer_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_lead_at" TIMESTAMP(3) NOT NULL,
    "source_name" TEXT NOT NULL,
    "fanpage_name" TEXT NOT NULL,
    "ad_id" TEXT,
    "first_touch_ad_id" TEXT,
    "last_touch_ad_id" TEXT,
    "raw_link" TEXT NOT NULL,
    "canonical_link" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_object_name" TEXT NOT NULL,
    "suggested_branch_code" TEXT NOT NULL,
    "assigned_branch_code" TEXT NOT NULL,
    "status_name" TEXT NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "touch_count" INTEGER NOT NULL DEFAULT 1,
    "assigned_sale_email" TEXT,
    "received_at" TIMESTAMP(3),
    "phone_raw" TEXT,
    "phone_normalized" TEXT,
    "phone_captured_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "transferred_to_pse" BOOLEAN NOT NULL DEFAULT false,
    "pse_profile_code" TEXT,
    "created_by_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_by_email" TEXT,
    "updated_at" TIMESTAMP(3),
    "reassigned_by_email" TEXT,
    "reassign_reason" TEXT,
    "needs_followup" BOOLEAN NOT NULL DEFAULT false,
    "mkt_pushed_at" TIMESTAMP(3),
    "mkt_pushed_by_email" TEXT,
    "conversation_link" TEXT,
    "mkt_suggestion" TEXT,
    "followup_handled_by_email" TEXT,
    "followup_handled_at" TIMESTAMP(3),

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("interaction_id")
);

-- CreateTable
CREATE TABLE "interaction_migration_meta" (
    "interaction_id" TEXT NOT NULL,
    "legacy_stt" INTEGER,
    "legacy_row" INTEGER,
    "migration_note" TEXT,

    CONSTRAINT "interaction_migration_meta_pkey" PRIMARY KEY ("interaction_id")
);

-- CreateTable
CREATE TABLE "ads_cost" (
    "id" SERIAL NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "ad_id" TEXT NOT NULL,
    "ad_name" TEXT NOT NULL,
    "source_name" TEXT,
    "fanpage_name" TEXT,
    "branch_code" TEXT,
    "cost_vnd" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "updated_by_email" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ads_cost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_log" (
    "log_id" TEXT NOT NULL,
    "logged_at" TIMESTAMP(3) NOT NULL,
    "actor_email" TEXT,
    "actor_name" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "interaction_id" TEXT,
    "detail_old" JSONB,
    "detail_new" JSONB,
    "result" TEXT NOT NULL,
    "technical_info" TEXT,

    CONSTRAINT "system_log_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_domains_source_name_domain_key" ON "source_domains"("source_name", "domain");

-- CreateIndex
CREATE UNIQUE INDEX "status_allowed_roles_status_name_role_key" ON "status_allowed_roles"("status_name", "role");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_config_group_key_key" ON "app_settings"("config_group", "key");

-- CreateIndex
CREATE UNIQUE INDEX "customers_canonical_link_key" ON "customers"("canonical_link");

-- CreateIndex
CREATE INDEX "interactions_customer_key_idx" ON "interactions"("customer_key");

-- CreateIndex
CREATE INDEX "interactions_status_name_idx" ON "interactions"("status_name");

-- CreateIndex
CREATE INDEX "interactions_assigned_branch_code_idx" ON "interactions"("assigned_branch_code");

-- CreateIndex
CREATE INDEX "interactions_created_lead_at_idx" ON "interactions"("created_lead_at");

-- CreateIndex
CREATE INDEX "ads_cost_ad_id_idx" ON "ads_cost"("ad_id");

-- CreateIndex
CREATE INDEX "system_log_logged_at_idx" ON "system_log"("logged_at");

-- CreateIndex
CREATE INDEX "system_log_interaction_id_idx" ON "system_log"("interaction_id");

-- AddForeignKey
ALTER TABLE "source_domains" ADD CONSTRAINT "source_domains_source_name_fkey" FOREIGN KEY ("source_name") REFERENCES "sources"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fanpages" ADD CONSTRAINT "fanpages_default_source_name_fkey" FOREIGN KEY ("default_source_name") REFERENCES "sources"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fanpages" ADD CONSTRAINT "fanpages_suggested_branch_code_fkey" FOREIGN KEY ("suggested_branch_code") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_allowed_roles" ADD CONSTRAINT "status_allowed_roles_status_name_fkey" FOREIGN KEY ("status_name") REFERENCES "statuses"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_current_status_name_fkey" FOREIGN KEY ("current_status_name") REFERENCES "statuses"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_customer_key_fkey" FOREIGN KEY ("customer_key") REFERENCES "customers"("customer_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_source_name_fkey" FOREIGN KEY ("source_name") REFERENCES "sources"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_fanpage_name_fkey" FOREIGN KEY ("fanpage_name") REFERENCES "fanpages"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_customer_object_name_fkey" FOREIGN KEY ("customer_object_name") REFERENCES "customer_objects"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_suggested_branch_code_fkey" FOREIGN KEY ("suggested_branch_code") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_assigned_branch_code_fkey" FOREIGN KEY ("assigned_branch_code") REFERENCES "branches"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_status_name_fkey" FOREIGN KEY ("status_name") REFERENCES "statuses"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_assigned_sale_email_fkey" FOREIGN KEY ("assigned_sale_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_created_by_email_fkey" FOREIGN KEY ("created_by_email") REFERENCES "users"("email") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_updated_by_email_fkey" FOREIGN KEY ("updated_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_reassigned_by_email_fkey" FOREIGN KEY ("reassigned_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_followup_handled_by_email_fkey" FOREIGN KEY ("followup_handled_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_mkt_pushed_by_email_fkey" FOREIGN KEY ("mkt_pushed_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_migration_meta" ADD CONSTRAINT "interaction_migration_meta_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("interaction_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads_cost" ADD CONSTRAINT "ads_cost_source_name_fkey" FOREIGN KEY ("source_name") REFERENCES "sources"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads_cost" ADD CONSTRAINT "ads_cost_fanpage_name_fkey" FOREIGN KEY ("fanpage_name") REFERENCES "fanpages"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads_cost" ADD CONSTRAINT "ads_cost_branch_code_fkey" FOREIGN KEY ("branch_code") REFERENCES "branches"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_actor_email_fkey" FOREIGN KEY ("actor_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_log" ADD CONSTRAINT "system_log_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "interactions"("interaction_id") ON DELETE SET NULL ON UPDATE CASCADE;
