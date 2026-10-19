import type { Context } from "hono";
import { fieldErrors, type ApiError } from "@ces/shared";
import { ZodError } from "zod";
import { ServiceError } from "../services/errors.ts";

/** Đọc nội dung JSON; nếu không phải JSON thì trả lỗi 400 dễ hiểu. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ServiceError(400, "Nội dung gửi lên không phải JSON hợp lệ");
  }
}

/** Đổi mọi lỗi thành phản hồi JSON tiếng Việt. */
export function handleError(err: Error, c: Context) {
  if (err instanceof ZodError) {
    return c.json({ error: "Dữ liệu không hợp lệ", fields: fieldErrors(err) } satisfies ApiError, 400);
  }
  if (err instanceof ServiceError) {
    return c.json({ error: err.message, ...(err.fields ? { fields: err.fields } : {}) } satisfies ApiError, err.status);
  }
  console.error("Lỗi không lường trước:", err.message);
  return c.json({ error: "Có lỗi hệ thống, vui lòng thử lại" } satisfies ApiError, 500);
}
