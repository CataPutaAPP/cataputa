import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Handshake, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import type { Partnership, PartnershipStatus } from "@/types";

export const Route = createFileRoute("/parceiro")({
  head: () => ({
    meta: [
      { title: "Painel do parceiro — ServiHub" },
      {
        name: "description",
        content: "Veja negociações abertas a parceiros, aceite participação e acompanhe suas parcerias.",
      },
      { property: "og:title", content: "Painel do parceiro — ServiHub" },
      { property: "og:description", content: "Participe de negociações e acompanhe parcerias." },
    ],
  }),
  component: ParceiroDashboard,
});

const statusLabel: Record<PartnershipStatus, string> = {
  convite: "Convite",
  ativa: "Ativa",
  recusada: "Recusada",
  concluida: "Concluída",
};

const initialPartnerships: Partnership[] = [
  {
    id: "p1",
    request_id: "feed-1",
    partner_id: null,
    client_name: "Ana Souza",
    service_type: "Elétrica",
    description: "Cliente optou por incluir um parceiro na negociação.",
    share_percent: 20,
    status: "convite",
    created_at: new Date().toISOString(),
  },
  {
    id: "p2",
    request_id: "feed-3",
    partner_id: null,
    client_name: "Carlos Dias",
    service_type: "Reforma",
    description: "Pintura de dois quartos com prazo de uma semana.",
    share_percent: 15,
    status: "convite",
    created_at: new Date().toISOString(),
  },
  {
    id: "p3",
    request_id: "feed-4",
    partner_id: "me",
    client_name: "Duda Martins",
    service_type: "Limpeza",
    description: "Limpeza pós-obra em apartamento.",
    share_percent: 25,
    status: "ativa",
    created_at: new Date().toISOString(),
  },
];

function ParceiroDashboard() {
  return (
    <DashboardShell role="parceiro">
      <ParceiroContent />
    </DashboardShell>
  );
}

function ParceiroContent() {
  const { user } = useAuth();
  const [partnerships, setPartnerships] = useState<Partnership[]>(initialPartnerships);

  const invites = partnerships.filter((p) => p.status === "convite");
  const mine = partnerships.filter((p) => p.status !== "convite");

  function update(id: string, status: PartnershipStatus) {
    setPartnerships((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, status, partner_id: status === "ativa" ? (user?.id ?? null) : p.partner_id } : p,
      ),
    );
    toast[status === "ativa" ? "success" : "message"](
      status === "ativa" ? "Participação aceita!" : "Convite recusado.",
    );
  }

  return (
    <DashboardShellBody>
      <h1 className="text-2xl font-semibold">Negociações com parceria</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clientes que optaram por incluir um parceiro na negociação.
      </p>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Convites abertos
        </h2>
        {invites.length === 0 ? (
          <div className="panel p-5 text-sm text-muted-foreground">
            Nenhum convite aberto por enquanto.
          </div>
        ) : (
          invites.map((p) => (
            <article key={p.id} className="panel space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{p.service_type}</h3>
                  <p className="text-xs text-muted-foreground">{p.client_name}</p>
                </div>
                <Badge variant="secondary">{p.share_percent}% de participação</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => update(p.id, "ativa")}>
                  <Check className="mr-1 size-4" /> Aceitar participação
                </Button>
                <Button variant="secondary" className="flex-1" onClick={() => update(p.id, "recusada")}>
                  <X className="mr-1 size-4" /> Recusar
                </Button>
              </div>
            </article>
          ))
        )}
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Status das parcerias
        </h2>
        {mine.length === 0 ? (
          <div className="panel p-5 text-sm text-muted-foreground">
            Você ainda não participa de nenhuma parceria.
          </div>
        ) : (
          mine.map((p) => (
            <article key={p.id} className="panel flex items-center gap-3 p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                <Handshake className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{p.service_type}</h3>
                <p className="truncate text-xs text-muted-foreground">
                  {p.client_name} · {p.share_percent}%
                </p>
              </div>
              <Badge
                className={
                  p.status === "ativa"
                    ? "bg-success text-success-foreground"
                    : p.status === "recusada"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-secondary text-secondary-foreground"
                }
              >
                {statusLabel[p.status]}
              </Badge>
            </article>
          ))
        )}
      </section>
    </DashboardShellBody>
  );
}

function DashboardShellBody({ children }: { children: React.ReactNode }) {
  return <main className="px-4 pt-24 pb-16">{children}</main>;
}
