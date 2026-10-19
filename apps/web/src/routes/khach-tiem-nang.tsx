import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/khach-tiem-nang")({
  component: () => <PageStub title="Khách tiềm năng" note="Danh sách và hồ sơ khách tiềm năng." />,
});
