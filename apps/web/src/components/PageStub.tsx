export function PageStub({ title, note }: { title: string; note: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">{note}</p>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
        Trang này đang để trống, sẽ làm ở các bước sau.
      </div>
    </div>
  );
}
