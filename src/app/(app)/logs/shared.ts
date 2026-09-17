// Sentinel dùng làm đoạn URL (/logs/[email]) cho các dòng log không gắn được
// với actor nào (actorEmail null — hệ thống tự ghi, hoặc actor không xác định).
// Không dùng chuỗi rỗng vì Next.js không match được route segment rỗng.
export const SYSTEM_ACTOR_KEY = "_system";
