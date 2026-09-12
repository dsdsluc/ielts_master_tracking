-- AlterTable
ALTER TABLE "ads_cost" ADD COLUMN     "ad_set_name" TEXT,
ADD COLUMN     "campaign_name" TEXT,
ADD COLUMN     "impressions" INTEGER,
ADD COLUMN     "link_clicks" INTEGER,
ADD COLUMN     "media_type" TEXT,
ADD COLUMN     "messaging_conversations" INTEGER,
ADD COLUMN     "post_engagements" INTEGER,
ADD COLUMN     "result_type" TEXT,
ADD COLUMN     "results" INTEGER,
ADD COLUMN     "thru_plays" INTEGER;
