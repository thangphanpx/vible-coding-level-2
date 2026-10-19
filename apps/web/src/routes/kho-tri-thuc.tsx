import { useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { canManageDocs, documentInputSchema, type Doc, type DocHit } from "@ces/shared";
import { Field, formatDate, inputClass, primaryButton, secondaryButton } from "../components/ui";
import { ApiRequestError, api, useFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/kho-tri-thuc")({
  component: KnowledgePage,
});

function KnowledgePage() {
  const { user } = useAuth();
  const canManage = canManageDocs(user!.role);
  const docs = useFetch<Doc[]>("/documents");
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Kho tri thức</h1>
      <p className="mt-1 text-sm text-slate-600">Tài liệu của công ty (chính sách, quy định, giới thiệu khóa học). Trợ lý AI tra cứu ở đây khi trả lời.</p>
      {notice && <p role="status" className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}

      {canManage && <UploadForm onUploaded={(d) => { setNotice(`Đã nạp "${d.title}" (${d.chunkCount} đoạn).`); docs.reload(); }} />}

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 font-medium">Tài liệu</th>
              <th className="px-4 py-3 font-medium">Số đoạn</th>
              <th className="px-4 py-3 font-medium">Người nạp</th>
              <th className="px-4 py-3 font-medium">Ngày nạp</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {docs.error && <tr><td colSpan={5} className="px-4 py-6 text-center text-red-600">{docs.error}</td></tr>}
            {!docs.error && !docs.data && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Đang tải...</td></tr>}
            {docs.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">Chưa có tài liệu nào.{canManage ? " Hãy nạp tài liệu đầu tiên ở trên." : ""}</td></tr>}
            {docs.data?.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{d.title}<span className="block text-xs font-normal text-slate-500">{d.fileName}</span></td>
                <td className="px-4 py-3">{d.chunkCount}</td>
                <td className="px-4 py-3">{d.uploadedByName ?? "—"}</td>
                <td className="px-4 py-3">{formatDate(d.createdAt)}</td>
                <td className="px-4 py-3 text-right">
                  {canManage && (
                    <button
                      type="button"
                      className="text-sm font-medium text-red-700 underline"
                      onClick={async () => {
                        await api("DELETE", `/documents/${d.id}`).catch(() => undefined);
                        setNotice(`Đã xóa "${d.title}".`);
                        docs.reload();
                      }}
                    >
                      Xóa
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SearchBox />
    </div>
  );
}

function UploadForm({ onUploaded }: { onUploaded: (d: Doc) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Vui lòng chọn một file .txt hoặc .md");
    const parsed = documentInputSchema.safeParse({ fileName: file.name, content: await file.text() });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    try {
      onUploaded(await api<Doc>("POST", "/documents", parsed.data));
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <Field label="Nạp tài liệu (.txt hoặc .md)" htmlFor="doc-file" error={error ?? undefined}>
        <input id="doc-file" ref={fileRef} type="file" accept=".txt,.md" className="text-sm" />
      </Field>
      <button type="submit" className={primaryButton} disabled={busy}>Nạp tài liệu</button>
    </form>
  );
}

/** Ô thử tìm: xem trợ lý sẽ thấy những đoạn nào khi tra cứu. */
function SearchBox() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<DocHit[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setError(null);
    try {
      setHits(await api<DocHit[]>("GET", `/documents/search?q=${encodeURIComponent(q.trim())}`));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Có lỗi xảy ra");
    }
  }
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-900">Thử tìm trong tài liệu</h2>
      <form onSubmit={submit} className="mt-2 flex max-w-xl gap-2">
        <input aria-label="Từ khóa cần tìm" className={inputClass} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ví dụ: hoan phi truoc khai giang" />
        <button type="submit" className={secondaryButton}>Tìm</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      {hits && hits.length === 0 && <p className="mt-3 text-sm text-slate-500">Không có đoạn nào phù hợp.</p>}
      <ul className="mt-3 space-y-3">
        {hits?.map((h, i) => (
          <li key={i} className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <p className="text-xs text-slate-500">[Nguồn: {h.source}{h.heading ? `, mục ${h.heading}` : ""}]</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{h.content}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
