import { useCallback, useEffect, useState } from "react";
import type { ApiError, Lookups } from "@ces/shared";

/** Lỗi từ API: có thông báo tiếng Việt và (nếu có) lỗi theo từng ô nhập. */
export class ApiRequestError extends Error {
  status: number;
  fields: Record<string, string>;
  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

/** Gọi API qua đường dẫn /api (Vite chuyển sang API, bỏ tiền tố /api). Chỉ gọi ở trình duyệt. */
export async function api<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiRequestError(0, "Không kết nối được máy chủ. Vui lòng thử lại.");
  }
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiError>) | null;
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? "Có lỗi xảy ra, vui lòng thử lại", data?.fields);
  return data as T;
}

/** Đổi object tham số thành chuỗi truy vấn, bỏ giá trị rỗng. */
export function queryString(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Tải một danh sách; đổi tham số hoặc gọi reload() thì tải lại. */
export function useFetch<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    setLoading(true);
    api<T>("GET", path, undefined, ctl.signal)
      .then((d) => {
        setData(d);
        setError(null);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message);
        setLoading(false);
      });
    return () => ctl.abort();
  }, [path, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

/** Danh sách để đổ vào các ô chọn (người dùng, khóa học, khách). */
export function useLookups() {
  return useFetch<Lookups>("/lookups");
}
