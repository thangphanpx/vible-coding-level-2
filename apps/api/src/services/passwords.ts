import { randomBytes, scrypt as scryptCb, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;

// Tham số scrypt (khuyến nghị tối thiểu của OWASP: N=2^17 r=8 p=1; ở đây dùng N=2^15 để API không treo trên máy yếu).
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;

/** Băm mật khẩu: trả chuỗi "scrypt$N$r$p$muối$băm" (base64). Không bao giờ lưu mật khẩu thô. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Bản đồng bộ cho seed (chạy một lần, không phải trong request). */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** So sánh mật khẩu với bản băm (thời gian không phụ thuộc nội dung). Bản băm hỏng thì trả false. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const parts = (stored ?? "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  try {
    const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

let dummy: string | undefined;
/** Bản băm giả dùng khi email không tồn tại, để thời gian phản hồi không lộ email nào có tài khoản. */
export function dummyHash(): string {
  return (dummy ??= hashPasswordSync("khong-ai-biet-mat-khau-nay"));
}
