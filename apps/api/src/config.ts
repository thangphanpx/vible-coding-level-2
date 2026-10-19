/** Cấu hình đọc từ biến môi trường (.env). Thiếu secret thì API không khởi động. */
export type AppConfig = {
  /** Khóa bí mật để băm mã phiên (HMAC). Tối thiểu 32 ký tự. */
  sessionSecret: string;
  /** Các Origin được phép gửi request ghi (trình duyệt luôn gửi Origin khi POST/PATCH). */
  allowedOrigins: string[];
  /** true khi chạy qua https: cookie có thêm cờ Secure. */
  cookieSecure: boolean;
  /** Số ngày một phiên đăng nhập còn hiệu lực. */
  sessionDays: number;
  /** Khóa của dịch vụ AI: request mang đúng khóa này (và cookie hợp lệ) được ghi nhãn "do AI làm". KHÔNG cấp thêm quyền. null = tắt. */
  aiServiceKey: string | null;
  /** Đồng hồ (kiểm thử thay bằng đồng hồ giả để thử hết hạn / khóa 15 phút). */
  now: () => Date;
};

export const DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const secret = env.SESSION_SECRET ?? "";
  if (secret.length < 32) {
    throw new Error(
      "Thiếu hoặc quá ngắn biến SESSION_SECRET (cần tối thiểu 32 ký tự). Hãy đặt trong apps/api/.env (xem .env.example).",
    );
  }
  const origins = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    sessionSecret: secret,
    allowedOrigins: origins.length ? origins : DEFAULT_ORIGINS,
    cookieSecure: env.COOKIE_SECURE === "true",
    sessionDays: Number(env.SESSION_DAYS ?? 7) || 7,
    aiServiceKey: (env.AI_SERVICE_KEY ?? "").length >= 16 ? env.AI_SERVICE_KEY! : null,
    now: () => new Date(),
  };
}
