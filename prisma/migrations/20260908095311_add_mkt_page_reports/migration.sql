-- CreateTable
CREATE TABLE "mkt_page_reports" (
    "id" SERIAL NOT NULL,
    "report_date" DATE NOT NULL,
    "fanpage_name" TEXT NOT NULL,
    "total_leads" INTEGER,
    "qualified_leads" INTEGER,
    "closed_at" TIMESTAMP(3),
    "closed_by_email" TEXT,

    CONSTRAINT "mkt_page_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mkt_page_reports_report_date_fanpage_name_key" ON "mkt_page_reports"("report_date", "fanpage_name");

-- AddForeignKey
ALTER TABLE "mkt_page_reports" ADD CONSTRAINT "mkt_page_reports_fanpage_name_fkey" FOREIGN KEY ("fanpage_name") REFERENCES "fanpages"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mkt_page_reports" ADD CONSTRAINT "mkt_page_reports_closed_by_email_fkey" FOREIGN KEY ("closed_by_email") REFERENCES "users"("email") ON DELETE SET NULL ON UPDATE CASCADE;
