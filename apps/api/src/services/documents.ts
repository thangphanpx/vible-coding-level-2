import type { DatabaseSync } from "node:sqlite";
import { canManageDocs, type Doc, type DocHit, type DocumentInput } from "@ces/shared";
import { inTransaction, writeAudit } from "./audit.ts";
import { forbidden, notFound } from "./errors.ts";
import type { Actor } from "./scope.ts";
import { unaccent } from "./sql.ts";

/** Độ dài tối đa của một đoạn; mục dài hơn thì cắt tiếp theo đoạn văn. */
const MAX_CHUNK = 1200;

/**
 * Cắt tài liệu thành các đoạn theo tiêu đề (dòng bắt đầu bằng #). Mục quá dài được cắt tiếp theo đoạn văn.
 * Mỗi đoạn giữ tiêu đề của mục chứa nó để khi trích dẫn có thể ghi "tên tài liệu, mục ...".
 */
export function chunkText(text: string): { heading: string | null; content: string }[] {
  const sections: { heading: string | null; lines: string[] }[] = [{ heading: null, lines: [] }];
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const h = /^#{1,6}\s+(.*\S)\s*$/.exec(line);
    if (h) sections.push({ heading: h[1], lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  const out: { heading: string | null; content: string }[] = [];
  for (const s of sections) {
    const body = s.lines.join("\n").trim();
    if (!body) continue;
    let current = "";
    for (const para of body.split(/\n{2,}/)) {
      if (current && current.length + para.length + 2 > MAX_CHUNK) {
        out.push({ heading: s.heading, content: current });
        current = "";
      }
      current = current ? `${current}\n\n${para}` : para;
    }
    if (current) out.push({ heading: s.heading, content: current });
  }
  return out;
}

export function listDocuments(db: DatabaseSync): Doc[] {
  const rows = db
    .prepare(
      `SELECT d.id, d.title, d.file_name, d.created_at, u.full_name AS uploaded_by_name,
              (SELECT count(*) FROM document_chunks c WHERE c.document_id = d.id) AS chunk_count
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by ORDER BY d.created_at DESC, d.id`,
    )
    .all() as { id: string; title: string; file_name: string; created_at: string; uploaded_by_name: string | null; chunk_count: number }[];
  return rows.map((r) => ({
    id: r.id, title: r.title, fileName: r.file_name, chunkCount: r.chunk_count, uploadedByName: r.uploaded_by_name, createdAt: r.created_at,
  }));
}

export function addDocument(db: DatabaseSync, actor: Actor, data: DocumentInput): Doc {
  if (!canManageDocs(actor.role)) throw forbidden("Chỉ Admin được nạp tài liệu");
  const chunks = chunkText(data.content);
  const title = data.title || data.fileName.replace(/\.(txt|md)$/i, "");
  return inTransaction(db, () => {
    const { id } = db
      .prepare("INSERT INTO documents (title, file_name, uploaded_by) VALUES (?, ?, ?) RETURNING id")
      .get(title, data.fileName, actor.id) as { id: string };
    const insertChunk = db.prepare("INSERT INTO document_chunks (document_id, chunk_index, heading, content) VALUES (?, ?, ?, ?) RETURNING rowid");
    const insertFts = db.prepare("INSERT INTO chunk_fts (rowid, heading, content) VALUES (?, ?, ?)");
    chunks.forEach((c, i) => {
      const { rowid } = insertChunk.get(id, i, c.heading, c.content) as { rowid: number };
      // Chỉ mục lưu bản đã bỏ dấu; bản gốc (có dấu) vẫn nằm trong document_chunks để hiển thị.
      insertFts.run(rowid, unaccent(`${title} ${c.heading ?? ""}`), unaccent(c.content));
    });
    writeAudit(db, actor, { action: "nap_tai_lieu", entityType: "documents", entityId: id, detail: `Nạp tài liệu "${title}" (${chunks.length} đoạn)` });
    return listDocuments(db).find((d) => d.id === id)!;
  });
}

export function deleteDocument(db: DatabaseSync, actor: Actor, id: string): void {
  if (!canManageDocs(actor.role)) throw forbidden("Chỉ Admin được xóa tài liệu");
  const doc = db.prepare("SELECT title FROM documents WHERE id = ?").get(id) as { title: string } | undefined;
  if (!doc) throw notFound("tài liệu");
  inTransaction(db, () => {
    // Bảng chỉ mục FTS không tự xóa theo khóa ngoại: xóa tay trước.
    db.prepare("DELETE FROM chunk_fts WHERE rowid IN (SELECT rowid FROM document_chunks WHERE document_id = ?)").run(id);
    db.prepare("DELETE FROM documents WHERE id = ?").run(id);
    writeAudit(db, actor, { action: "xoa_tai_lieu", entityType: "documents", entityId: id, detail: `Xóa tài liệu "${doc.title}"` });
  });
}

/** Tách câu hỏi thành các từ khóa không dấu (chỉ chữ và số), bỏ từ quá ngắn. */
function keywords(q: string): string[] {
  return [...new Set(unaccent(q).split(/[^a-z0-9]+/).filter((w) => w.length >= 2))].slice(0, 12);
}

/**
 * Tìm các đoạn liên quan nhất. Xếp hạng BM25. Đoạn chứa ĐỦ mọi từ khóa xếp trước; nếu không có đoạn nào
 * chứa đủ thì nới ra "chứa một trong các từ" để vẫn có kết quả gần đúng.
 */
export function searchDocs(db: DatabaseSync, q: string, limit = 5): DocHit[] {
  const words = keywords(q);
  if (words.length === 0) return [];
  const run = (op: "AND" | "OR") => {
    const match = words.map((w) => `"${w}"`).join(` ${op} `);
    return db
      .prepare(
        `SELECT c.document_id, d.title, c.heading, c.content
         FROM chunk_fts f JOIN document_chunks c ON c.rowid = f.rowid JOIN documents d ON d.id = c.document_id
         WHERE chunk_fts MATCH ? ORDER BY bm25(chunk_fts) LIMIT ?`,
      )
      .all(match, limit) as { document_id: string; title: string; heading: string | null; content: string }[];
  };
  let rows = run("AND");
  if (rows.length === 0 && words.length > 1) {
    // Nới ra "một trong các từ", nhưng đoạn phải khớp ít nhất một nửa số từ khóa:
    // nếu không, từ phổ biến như "bao" (khớp "báo") sẽ kéo về những đoạn chẳng liên quan.
    const need = Math.ceil(words.length / 2);
    rows = run("OR").filter((r) => {
      const tokens = new Set(unaccent(`${r.title} ${r.heading ?? ""} ${r.content}`).split(/[^a-z0-9]+/));
      return words.filter((w) => tokens.has(w)).length >= need;
    });
  }
  return rows.map((r) => ({ documentId: r.document_id, source: r.title, heading: r.heading, content: r.content }));
}
