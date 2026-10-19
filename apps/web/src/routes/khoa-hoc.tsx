import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/khoa-hoc")({
  component: () => <PageStub title="Khóa học và lịch khai giảng" note="Các khóa học và lịch khai giảng." />,
});
