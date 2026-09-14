import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/lib/auth/dal";
import { CAN_CREATE_OR_EDIT_LEAD } from "@/lib/interactions/constants";
import { StudentsSection } from "@/app/(app)/students/students-section";

export default async function StudentsPage() {
  const actor = await requireRole(...CAN_CREATE_OR_EDIT_LEAD);

  return (
    <>
      <PageHeader
        eyebrow="Vận hành"
        title="Học viên đang tư vấn"
        description="Theo dõi tiến trình gọi điện tư vấn ghi danh từng học viên."
      />
      <StudentsSection actor={actor} />
    </>
  );
}
