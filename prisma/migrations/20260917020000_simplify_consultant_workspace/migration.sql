-- Giữ lại tư vấn viên hoạt động gần nhất trước khi bỏ cơ chế claim nhiều người.
DO $$
BEGIN
  IF to_regclass('public.workspace_claims') IS NOT NULL THEN
    UPDATE "interactions" AS i
       SET "assigned_sale_email" = latest."sale_email"
      FROM (
        SELECT DISTINCT ON ("interaction_id") "interaction_id", "sale_email"
          FROM "workspace_claims"
         ORDER BY "interaction_id", "last_activity_at" DESC
      ) AS latest
     WHERE i."interaction_id" = latest."interaction_id"
       AND i."assigned_sale_email" IS NULL;
  END IF;
END $$;

DROP TABLE IF EXISTS "workspace_claims";

CREATE INDEX IF NOT EXISTS "interactions_assigned_sale_email_idx"
  ON "interactions"("assigned_sale_email");
