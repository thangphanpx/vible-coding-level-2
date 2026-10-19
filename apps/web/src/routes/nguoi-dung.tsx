import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/nguoi-dung")({
  component: () => <PageStub title="Người dùng" note="Quản lý tài khoản (chỉ admin)." />,
});
