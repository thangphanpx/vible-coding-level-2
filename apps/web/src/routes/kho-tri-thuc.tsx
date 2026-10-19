import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/kho-tri-thuc")({
  component: () => <PageStub title="Kho tri thức" note="Tài liệu để trợ lý AI tra cứu." />,
});
