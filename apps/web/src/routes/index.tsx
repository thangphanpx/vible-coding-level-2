import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/")({
  component: () => <PageStub title="Tổng quan" note="Số liệu nhanh về khách, việc và lớp học." />,
});
