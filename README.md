# Theo dõi Liên hệ · IELTS Master

Hệ thống theo dõi và chăm sóc lead nội bộ, xây trên Next.js (App Router) + Prisma 7 + PostgreSQL.

## Chạy local

1. Cài dependencies:

   ```bash
   npm install
   ```

2. Sao chép `.env.example` thành `.env` và điền `DATABASE_URL` (Postgres) + `SESSION_SECRET`:

   ```bash
   cp .env.example .env
   ```

3. Tạo Prisma Client + áp migration:

   ```bash
   npx prisma generate
   npx prisma migrate deploy
   npm run seed
   ```

4. Chạy dev server:

   ```bash
   npm run dev
   ```

   Mở [http://localhost:3000](http://localhost:3000).

## Deploy lên Vercel

1. Import repo này vào Vercel (Next.js được nhận diện tự động, không cần cấu hình build riêng).
2. Khai báo 2 biến môi trường ở **Project Settings → Environment Variables** (xem chi tiết trong `.env.example`):
   - `DATABASE_URL` — chuỗi kết nối Postgres. Nếu dùng Neon, dùng đúng connection string dạng **pooler** (có `-pooler` trong host) để chạy ổn định trên serverless, tránh cạn kết nối DB.
   - `SESSION_SECRET` — chuỗi ngẫu nhiên riêng cho production (không dùng lại giá trị ở local), tạo bằng `openssl rand -base64 32`.
3. `npm install` sẽ tự chạy `prisma generate` (khai báo ở script `postinstall`) — không cần bước thủ công nào thêm, Vercel build bình thường qua `next build`.
4. Database (bảng + migration) cần được tạo trước khi app chạy được — chạy `npx prisma migrate deploy` nhắm vào DB production (từ máy local hoặc CI, trỏ `DATABASE_URL` production) trước lần deploy đầu tiên.

## Scripts

- `npm run dev` — dev server (Turbopack).
- `npm run build` / `npm start` — build & chạy production.
- `npm run lint` — ESLint.
- `npm run seed` — seed danh mục (cơ sở, người dùng) từ dữ liệu gốc.
- `npm run seed:data:pilot` — seed dữ liệu pilot cho môi trường thử nghiệm.
