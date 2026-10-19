import { createFileRoute } from "@tanstack/react-router";
import { ROLE_LABELS } from "@ces/shared";
import { primaryButton } from "../components/ui";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/ho-so")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Hồ sơ của tôi</h1>
      <dl className="mt-6 max-w-md divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Họ tên</dt>
          <dd className="font-medium text-slate-900">{user.fullName}</dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Email</dt>
          <dd className="font-medium text-slate-900">{user.email}</dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-slate-500">Vai trò</dt>
          <dd className="font-medium text-slate-900">{ROLE_LABELS[user.role]}</dd>
        </div>
      </dl>
      <button type="button" className={`${primaryButton} mt-6`} onClick={() => void logout()}>
        Đăng xuất
      </button>
    </div>
  );
}
