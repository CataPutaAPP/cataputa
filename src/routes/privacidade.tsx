import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalDoc";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Política de Privacidade — Privora" }] }),
  component: () => <LegalPage slug="privacidade" />,
});
