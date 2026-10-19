/// <reference types="vite/client" />
import { useEffect } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { ROLE_LABELS, canViewPage } from "@ces/shared";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "../lib/auth";
import { menu } from "../menu";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CES CRM AI" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="vi">
      <head>
        <HeadContent />
      </head>
      <body className="bg-slate-50 text-slate-800">
        <AuthProvider>
          <Shell />
        </AuthProvider>
        <Scripts />
      </body>
    </html>
  );
}

/** Khung chung: chưa đăng nhập thì chuyển về /login; đã đăng nhập thì có menu bên trái. */
function Shell() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onLogin = pathname === "/login";
  // Menu chỉ hiện các trang vai trò này được xem (bảng quyền ở packages/shared; API vẫn kiểm quyền thật).
  const visibleMenu = user ? menu.filter((m) => canViewPage(user.role, m.to)) : [];
  const pageAllowed = user ? canViewPage(user.role, pathname) : false;

  useEffect(() => {
    if (status === "anon" && !onLogin) void navigate({ to: "/login", replace: true });
    if (status === "authed" && onLogin) void navigate({ to: "/", replace: true });
  }, [status, onLogin, navigate]);

  if (status === "loading") {
    return <div className="p-8 text-slate-500">Đang tải...</div>;
  }
  if (status === "anon") {
    // Đang ở /login thì hiện trang đăng nhập; trang khác thì chờ chuyển hướng.
    return onLogin ? <Outlet /> : <div className="p-8 text-slate-500">Đang chuyển đến trang đăng nhập...</div>;
  }
  if (onLogin) return <div className="p-8 text-slate-500">Đang chuyển hướng...</div>;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
        <div className="mb-6 text-lg font-bold text-slate-900">CES CRM AI</div>
        <nav className="flex flex-col gap-1">
          {visibleMenu.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              activeOptions={{ exact: m.to === "/" }}
              className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              activeProps={{ className: "bg-slate-900 !text-white hover:bg-slate-900" }}
            >
              {m.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-200 pt-4 text-sm">
          <Link to="/ho-so" className="block rounded-md px-3 py-2 hover:bg-slate-100" activeProps={{ className: "bg-slate-900 !text-white hover:bg-slate-900" }}>
            <span className="block font-medium">{user?.fullName}</span>
            <span className="block text-xs opacity-70">{user ? ROLE_LABELS[user.role] : ""}</span>
          </Link>
          <button type="button" className="mt-2 w-full rounded-md px-3 py-2 text-left text-slate-700 hover:bg-slate-100" onClick={() => void logout()}>
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        {pageAllowed ? (
          <Outlet />
        ) : (
          <div role="alert">
            <h1 className="text-2xl font-semibold text-slate-900">Bạn không có quyền xem trang này</h1>
            <p className="mt-2 text-slate-600">Vai trò của bạn không được truy cập trang này. Hãy chọn một mục trong menu bên trái.</p>
          </div>
        )}
      </main>
    </div>
  );
}
