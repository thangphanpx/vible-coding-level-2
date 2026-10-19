import { getDbPath, openDatabase } from "./database.ts";

const db = openDatabase();
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all() as { name: string }[];
console.log(`Đã áp dụng schema vào ${getDbPath()} (${tables.length} bảng): ${tables.map((t) => t.name).join(", ")}`);
db.close();
