import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/nhat-ky")({
  component: () => <PageStub title="Nhật ký" note="Ai làm gì, lúc nào." />,
});
