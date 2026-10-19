import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/viec-can-lam")({
  component: () => <PageStub title="Việc cần làm" note="Việc gọi lại, nhắc học phí, nhắc buổi học." />,
});
