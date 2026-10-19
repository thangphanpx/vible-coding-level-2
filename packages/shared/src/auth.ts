import { z } from "zod";
import type { Role } from "./common.ts";

/** Người đang đăng nhập (API trả về, web giữ). Không bao giờ chứa mật khẩu. */
export type SessionUser = { id: string; email: string; fullName: string; role: Role };

export const loginSchema = z.object({
  email: z
    .string({ error: "Vui lòng nhập email" })
    .trim()
    .min(1, "Vui lòng nhập email")
    .toLowerCase()
    .pipe(z.email("Email không hợp lệ")),
  password: z
    .string({ error: "Vui lòng nhập mật khẩu" })
    .min(1, "Vui lòng nhập mật khẩu")
    .max(200, "Mật khẩu quá dài"),
});
export type LoginInput = z.input<typeof loginSchema>;
