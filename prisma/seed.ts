// Migrate dữ liệu danh mục Cơ sở + Người dùng từ
// docs/Tracking_Leads_IELTS_Master.xlsx (tab CONFIG_BRANCHES, CONFIG_USERS).
// Toàn bộ user migrate được gán mật khẩu mặc định "12345678" (đã hash) và
// buộc đổi mật khẩu ở lần đăng nhập đầu tiên (mustChangePassword = true).
//
// Chạy: npm run seed
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const DEFAULT_PASSWORD = "12345678";

const branches = [
  { code: "TDM", name: "Thủ Dầu Một", active: true, slaReceiveMinutes: 30, slaProcessHours: 24 },
  { code: "Dĩ An", name: "Dĩ An", active: true, slaReceiveMinutes: 30, slaProcessHours: 24 },
  { code: "Thuận An", name: "Thuận An", active: true, slaReceiveMinutes: 30, slaProcessHours: 24 },
];

// Cơ_sở trong CONFIG_USERS ghi "Tất cả" cho vai trò quản lý/marketing — đây
// không phải một mã Branch hợp lệ, nên map về branchCode = null (không giới
// hạn 1 cơ sở) kèm viewAllBranches = true.
const users = [
  {
    email: "tram.ntq12345@gmail.com",
    fullName: "Quỳnh Trâm",
    role: "Sale/Admin",
    branchCode: "TDM" as string | null,
    active: true,
    viewAllBranches: false,
    canCloseMktReport: false,
  },
  {
    email: "iamphson@gmail.com",
    fullName: "Hồng Sơn",
    role: "Sale/Admin",
    branchCode: "Dĩ An" as string | null,
    active: true,
    viewAllBranches: false,
    canCloseMktReport: false,
  },
  {
    email: "vananhlt03@gmail.com",
    fullName: "Vân Anh",
    role: "Sale/Admin",
    branchCode: "TDM" as string | null,
    active: true,
    viewAllBranches: false,
    canCloseMktReport: false,
  },
  {
    email: "trambtt1226@gmail.com",
    fullName: "Bích Trâm",
    role: "Sale/Admin",
    branchCode: "TDM" as string | null,
    active: true,
    viewAllBranches: false,
    canCloseMktReport: false,
  },
  {
    email: "hungnguyenieltsmaster@gmail.com",
    fullName: "Nguyễn Phúc Hưng",
    role: "Quản trị hệ thống",
    branchCode: null as string | null,
    active: true,
    viewAllBranches: true,
    canCloseMktReport: true,
  },
  {
    email: "kimhuong0611@gmail.com",
    fullName: "Phạm Kim Hương",
    role: "Marketing",
    branchCode: null as string | null,
    active: true,
    viewAllBranches: true,
    canCloseMktReport: true,
  },
  {
    email: "huonglien296@gmail.com",
    fullName: "Bùi Thị Hương Liên",
    role: "Marketing",
    branchCode: null as string | null,
    active: true,
    viewAllBranches: true,
    canCloseMktReport: true,
  },
  {
    email: "binhduongieltsmaster@gmail.com",
    fullName: "Quản trị hệ thống",
    role: "Quản trị hệ thống",
    branchCode: null as string | null,
    active: true,
    viewAllBranches: true,
    canCloseMktReport: false,
  },
  {
    email: "huy.nguyen@ieltsmastervn.edu.vn",
    fullName: "Nguyễn Đình Huy",
    role: "BGĐ",
    branchCode: null as string | null,
    active: true,
    viewAllBranches: true,
    canCloseMktReport: true,
  },
  {
    email: "thanhtuan111020@gmail.com",
    fullName: "Tuấn",
    role: "Sale/Admin",
    branchCode: "TDM" as string | null,
    active: true,
    viewAllBranches: false,
    canCloseMktReport: false,
  },
];

async function main() {
  for (const branch of branches) {
    await prisma.branch.upsert({
      where: { code: branch.code },
      update: branch,
      create: branch,
    });
  }
  console.log(`Đã seed ${branches.length} cơ sở.`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const { branchCode, ...user } of users) {
    const connectBranch = branchCode ? { connect: { code: branchCode } } : undefined;
    const updateBranch = branchCode ? { connect: { code: branchCode } } : { disconnect: true };
    await prisma.user.upsert({
      where: { email: user.email },
      // Chạy lại seed không được ghi đè mật khẩu người dùng đã tự đổi —
      // passwordHash/mustChangePassword chỉ set khi tạo mới.
      update: { ...user, branch: updateBranch },
      create: { ...user, branch: connectBranch, passwordHash, mustChangePassword: true },
    });
  }
  console.log(`Đã seed ${users.length} người dùng (mật khẩu mặc định: ${DEFAULT_PASSWORD}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
