/// <reference types="vite/client" />
import type { ReactNode } from "react";
import { HeadContent, Link, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import appCss from "../styles.css?url";
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
        <div className="flex min-h-screen">
          <aside className="w-64 shrink-0 border-r border-slate-200 bg-white p-4">
            <div className="mb-6 text-lg font-bold text-slate-900">CES CRM AI</div>
            <nav className="flex flex-col gap-1">
              {menu.map((m) => (
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
          </aside>
          <main className="flex-1 p-8">
            <Outlet />
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
