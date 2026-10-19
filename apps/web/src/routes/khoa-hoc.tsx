import { createFileRoute } from "@tanstack/react-router";
import type { Course } from "@ces/shared";
import { formatDate, formatVnd } from "../components/ui";
import { useFetch } from "../lib/api";

export const Route = createFileRoute("/khoa-hoc")({
  component: CoursesPage,
});

function CoursesPage() {
  const { data, error, reload } = useFetch<Course[]>("/courses");
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Khóa học và lịch khai giảng</h1>
      {error && (
        <p className="mt-4 text-red-600">
          {error}{" "}
          <button type="button" className="underline" onClick={reload}>Thử lại</button>
        </p>
      )}
      {!error && !data && <p className="mt-4 text-slate-500">Đang tải...</p>}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {data?.map((c) => (
          <section key={c.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-lg font-semibold text-slate-900">{c.name}</h2>
              <span className="text-sm font-medium text-slate-900">{formatVnd(c.tuitionVnd)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{c.sessions} buổi</p>
            {c.description && <p className="mt-3 text-sm text-slate-700">{c.description}</p>}
            <h3 className="mt-4 text-sm font-medium text-slate-700">Lịch khai giảng</h3>
            <ul className="mt-1 divide-y divide-slate-100 text-sm">
              {c.intakes.map((i) => (
                <li key={i.id} className="flex justify-between py-1.5">
                  <span>{formatDate(i.startDate)}</span>
                  <span className="text-slate-500">{i.seats} chỗ</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
