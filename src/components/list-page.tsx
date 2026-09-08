import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { DataTableShell } from "@/components/data-table-shell";

export function ListPage({
  eyebrow,
  title,
  description,
  columns,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  columns: string[];
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  action?: ReactNode;
}) {
  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={action}
      />
      <DataTableShell
        columns={columns}
        emptyIcon={emptyIcon}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    </>
  );
}
