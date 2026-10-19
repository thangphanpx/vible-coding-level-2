import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/lop-hoc")({
  component: () => <PageStub title="Lớp học" note="Lớp học, ghi danh và học phí." />,
});
