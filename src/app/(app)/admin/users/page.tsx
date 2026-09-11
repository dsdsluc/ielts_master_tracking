import { User, UserCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/dal";
import { ROLES } from "@/lib/interactions/constants";
import { ActiveToggle } from "@/app/(app)/admin/active-toggle";
import { UserDialog } from "@/app/(app)/admin/users/user-dialog";
import { ResetPasswordDialog } from "@/app/(app)/admin/users/reset-password-dialog";
import { setUserActive } from "@/app/(app)/admin/users/actions";

export default async function UsersPage() {
  const actor = await requireRole(ROLES.ADMIN);
  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: "desc" }, { fullName: "asc" }],
      select: {
        email: true,
        fullName: true,
        role: true,
        active: true,
        viewAllBranches: true,
        canCloseMktReport: true,
        mustChangePassword: true,
        note: true,
        branchCode: true,
        branch: { select: { name: true } },
      },
    }),
    prisma.branch.findMany({ select: { code: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Quản trị"
        title="Người dùng"
        description="Tài khoản nội bộ, vai trò và cơ sở phụ trách."
        action={<UserDialog mode="create" branchOptions={branches} />}
      />

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Chưa có người dùng nào"
          description="Thêm người dùng để phân quyền theo cơ sở và vai trò."
        />
      ) : (
        <div className="shadow-bubble overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3">
            <p className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{users.length}</strong> người dùng
            </p>
          </div>
          <Table className="sm:min-w-[820px]">
            <TableHeader className="sticky top-0 z-10 bg-secondary/80 backdrop-blur-md">
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Người dùng</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Vai trò</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase sm:table-cell">Cơ sở</TableHead>
                <TableHead className="hidden px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase md:table-cell">Mật khẩu</TableHead>
                <TableHead className="px-4 font-condensed text-[10px] tracking-wider text-muted-foreground uppercase">Hoạt động</TableHead>
                <TableHead className="w-20 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.email} className="odd:bg-secondary/10">
                  <TableCell className="min-w-56 px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                        <User className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {user.fullName}
                          {user.email === actor.email && <span className="ml-1.5 text-xs text-muted-foreground">(bạn)</span>}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-sm text-foreground">{user.role}</TableCell>
                  <TableCell className="hidden px-4 text-sm text-muted-foreground sm:table-cell">
                    {user.viewAllBranches ? "Tất cả" : (user.branch?.name ?? "—")}
                  </TableCell>
                  <TableCell className="hidden px-4 md:table-cell">
                    {user.mustChangePassword ? (
                      <Badge variant="secondary">Mặc định — cần đổi</Badge>
                    ) : (
                      <Badge variant="outline">Đã đổi</Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4">
                    <ActiveToggle active={user.active} entityKey={user.email} action={setUserActive} />
                  </TableCell>
                  <TableCell className="flex items-center gap-1 pr-4 pl-1">
                    <ResetPasswordDialog email={user.email} fullName={user.fullName} />
                    <UserDialog
                      mode="edit"
                      user={{
                        email: user.email,
                        fullName: user.fullName,
                        role: user.role,
                        branchCode: user.branchCode,
                        viewAllBranches: user.viewAllBranches,
                        canCloseMktReport: user.canCloseMktReport,
                        note: user.note,
                      }}
                      branchOptions={branches}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
