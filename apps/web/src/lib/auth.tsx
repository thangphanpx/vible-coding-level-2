import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { SessionUser } from "@ces/shared";
import { UNAUTHORIZED_EVENT, api } from "./api";

type Status = "loading" | "anon" | "authed";
type AuthValue = {
  status: Status;
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Giữ người đang đăng nhập cho cả app. Hỏi API "tôi là ai" khi mở trang (chỉ chạy ở trình duyệt). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: Status; user: SessionUser | null }>({ status: "loading", user: null });

  useEffect(() => {
    let alive = true;
    api<{ user: SessionUser }>("GET", "/auth/me")
      .then((r) => alive && setState({ status: "authed", user: r.user }))
      .catch(() => alive && setState({ status: "anon", user: null }));
    // API báo 401 giữa chừng (phiên hết hạn) thì coi như đã đăng xuất.
    const onUnauthorized = () => setState({ status: "anon", user: null });
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => {
      alive = false;
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api<{ user: SessionUser }>("POST", "/auth/login", { email, password });
    setState({ status: "authed", user: r.user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("POST", "/auth/logout");
    } finally {
      setState({ status: "anon", user: null });
    }
  }, []);

  const value = useMemo<AuthValue>(() => ({ ...state, login, logout }), [state, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth phải nằm trong AuthProvider");
  return v;
}
