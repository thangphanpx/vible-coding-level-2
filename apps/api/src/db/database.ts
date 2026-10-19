import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { unaccent } from "../services/sql.ts";

const schemaPath = new URL("./schema.sql", import.meta.url);

/** Đường dẫn file DB lấy từ biến môi trường DB_PATH (đặt trong apps/api/.env). */
export function getDbPath(): string {
  const path = process.env.DB_PATH;
  if (!path) {
    throw new Error("Thiếu biến DB_PATH. Hãy sao chép apps/api/.env.example thành apps/api/.env.");
  }
  return path;
}

/** Áp dụng schema.sql (chạy lại nhiều lần không sao). */
export function migrate(db: DatabaseSync): void {
  db.exec(readFileSync(schemaPath, "utf8"));
}

/** Mở DB, bật khóa ngoại, áp dụng schema. Truyền ":memory:" để dùng DB tạm (kiểm thử). */
export function openDatabase(path: string = getDbPath()): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  // Hàm tìm kiếm không dấu dùng trong câu SQL: unaccent(cột) LIKE ...
  db.function("unaccent", { deterministic: true }, unaccent);
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);
  return db;
}
