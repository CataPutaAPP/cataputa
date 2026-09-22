import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalDoc";

export const Route = createFileRoute("/termos")({
  head: () => ({ meta: [{ title: "Termos de Uso — Privora" }] }),
  component: () => <LegalPage slug="termos" />,
});
