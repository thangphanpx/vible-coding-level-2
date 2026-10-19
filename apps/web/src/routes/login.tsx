import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { fieldErrors, loginSchema } from "@ces/shared";
import { Field, inputClass, primaryButton } from "../components/ui";
import { ApiRequestError } from "../lib/api";
import { useAuth } from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    // Cùng lược đồ Zod với API (packages/shared).
    const parsed = loginSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      await navigate({ to: "/", replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setErrors(err.fields);
        if (Object.keys(err.fields).length === 0) setFormError(err.message);
      } else setFormError("Có lỗi xảy ra, vui lòng thử lại");
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <div className="text-xl font-bold text-slate-900">CES CRM AI</div>
          <h1 className="mt-1 text-sm text-slate-600">Đăng nhập để tiếp tục</h1>
        </div>
        <Field label="Email" htmlFor="login-email" error={errors.email}>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            autoFocus
            className={inputClass}
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
          />
        </Field>
        <Field label="Mật khẩu" htmlFor="login-password" error={errors.password}>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          />
        </Field>
        {formError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <button type="submit" className={`${primaryButton} w-full`} disabled={saving}>
          {saving ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
        <p className="text-center text-xs text-slate-500">Tài khoản do quản trị viên tạo. Không có đăng ký tự do.</p>
      </form>
    </div>
  );
}
