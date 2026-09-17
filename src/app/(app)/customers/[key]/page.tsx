import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { getCustomerDetail } from "@/lib/customers/queries";
import { isLeaderLike } from "@/lib/interactions/scope";
import { ApiError } from "@/lib/interactions/errors";
import { CustomerProfileView } from "@/app/(app)/customers/[key]/customer-profile-view";

export default async function CustomerDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const actor = await getCurrentUser();

  let detail;
  try {
    detail = await getCustomerDetail(actor, key);
  } catch (err) {
    if (err instanceof ApiError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return <CustomerProfileView detail={detail} canManageAssignment={isLeaderLike(actor)} />;
}
