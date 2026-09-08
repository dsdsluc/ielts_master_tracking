import { getLeadFormOptions } from "@/app/(app)/leads/get-lead-form-options";
import { LeadWorkspace } from "@/app/(app)/leads/[id]/lead-workspace";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const options = await getLeadFormOptions();

  return <LeadWorkspace interactionId={id} options={options} />;
}
