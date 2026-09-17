-- AlterTable: cho phép chi phí quảng cáo mặc định 0 (quảng cáo miễn phí)
ALTER TABLE "ads_cost" ALTER COLUMN "cost_vnd" SET DEFAULT 0;
