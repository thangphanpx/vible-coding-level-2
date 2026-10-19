import { createFileRoute } from "@tanstack/react-router";
import { PageStub } from "../components/PageStub";

export const Route = createFileRoute("/tro-ly-ai")({
  component: () => <PageStub title="Trợ lý AI" note="Khung trò chuyện với trợ lý AI." />,
});
