import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { MapBackground } from "@/components/MapBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import type { ServiceOffer, ServiceRequest, Urgency } from "@/types";

export const Route = createFileRoute("/prestador")({
  head: () => ({
    meta: [
      { title: "Painel do prestador — ServiHub" },
      {
        name: "description",
        content: "Fique disponível, receba ofertas de serviço e acompanhe os trabalhos em andamento.",
      },
      { property: "og:title", content: "Painel do prestador — ServiHub" },
      { property: "og:description", content: "Aceite ofertas e gerencie seus serviços." },
    ],
  }),
  component: PrestadorDashboard,
});

const urgencyLabel: Record<Urgency, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };

const initialFeed: ServiceRequest[] = [
  {
    id: "feed-1",
    client_id: "c1",
    client_name: "Ana Souza",
    service_type: "Elétrica",
    description: "Tomada da cozinha sem energia, preciso hoje.",
    location: "Vila Mariana, São Paulo",
    urgency: "alta",
    status: "aberta",
    wants_partner: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "feed-2",
    client_id: "c2",
    client_name: "Bruno Lima",
    service_type: "Frete",
    description: "Mudança de 12 caixas para bairro vizinho.",
    location: "Pinheiros, São Paulo",
    urgency: "media",
    status: "aberta",
    wants_partner: false,
    created_at: new Date().toISOString(),
  },
];

function PrestadorDashboard() {
  return (
    <DashboardShell role="prestador">
      <PrestadorContent />
    </DashboardShell>
  );
}

function PrestadorContent() {
  const { user } = useAuth();
  const [available, setAvailable] = useState(true);
  const [feed, setFeed] = useState<ServiceRequest[]>(initialFeed);
  const [ongoing, setOngoing] = useState<ServiceRequest[]>([]);
  const [offers, setOffers] = useState<ServiceOffer[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ service_type: "", description: "", price: "", location: "" });

  function accept(request: ServiceRequest) {
    setFeed((prev) => prev.filter((r) => r.id !== request.id));
    setOngoing((prev) => [{ ...request, status: "em_andamento" }, ...prev]);
    toast.success("Serviço aceito! O cliente foi avisado.");
  }

  function refuse(id: string) {
    setFeed((prev) => prev.filter((r) => r.id !== id));
    toast("Oferta recusada.");
  }

  function submitOffer(event: React.FormEvent) {
    event.preventDefault();
    if (!form.service_type || !form.description || !form.price || !form.location) {
      toast.error("Preencha todos os campos da oferta.");
      return;
    }
    const offer: ServiceOffer = {
      id: crypto.randomUUID(),
      request_id: "",
      provider_id: user?.id ?? null,
      service_type: form.service_type,
      description: form.description,
      price: Number(form.price.replace(",", ".")),
      location: form.location,
      status: "pendente",
      created_at: new Date().toISOString(),
    };
    setOffers((prev) => [offer, ...prev]);
    setForm({ service_type: "", description: "", price: "", location: "" });
    setOpen(false);
    toast.success("Oferta publicada para clientes da sua região.");
  }

  return (
    <main className="relative min-h-screen">
      <MapBackground className="fixed inset-0" />

      <div className="relative z-10 px-4 pt-24 pb-32">
        <div className="panel flex items-center justify-between p-4">
          <div>
            <p className="font-semibold">{available ? "Disponível" : "Indisponível"}</p>
            <p className="text-xs text-muted-foreground">
              {available ? "Você está recebendo novas ofertas" : "Você não receberá ofertas agora"}
            </p>
          </div>
          <Switch checked={available} onCheckedChange={setAvailable} />
        </div>

        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Ofertas disponíveis
          </h2>
          {!available ? (
            <div className="panel p-5 text-sm text-muted-foreground">
              Ative sua disponibilidade para ver novas ofertas.
            </div>
          ) : feed.length === 0 ? (
            <div className="panel p-5 text-sm text-muted-foreground">
              Nenhuma oferta no momento. Fique de olho!
            </div>
          ) : (
            feed.map((r) => (
              <article key={r.id} className="panel space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{r.service_type}</h3>
                    <p className="text-xs text-muted-foreground">{r.client_name}</p>
                  </div>
                  <Badge variant="secondary">Urgência {urgencyLabel[r.urgency]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{r.description}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3.5" /> {r.location}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => accept(r)}>
                    <Check className="mr-1 size-4" /> Aceitar
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => refuse(r.id)}>
                    <X className="mr-1 size-4" /> Recusar
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Serviços em andamento
          </h2>
          {ongoing.length === 0 ? (
            <div className="panel p-5 text-sm text-muted-foreground">
              Nenhum serviço em andamento.
            </div>
          ) : (
            ongoing.map((r) => (
              <article key={r.id} className="panel space-y-1 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{r.service_type}</h3>
                  <Badge className="bg-success text-success-foreground">Em andamento</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{r.description}</p>
                <p className="text-xs text-muted-foreground">{r.location}</p>
              </article>
            ))
          )}
        </section>

        {offers.length > 0 && (
          <section className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Minhas ofertas publicadas
            </h2>
            {offers.map((o) => (
              <article key={o.id} className="panel space-y-1 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{o.service_type}</h3>
                  <span className="text-sm font-semibold text-primary">
                    R$ {o.price.toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{o.description}</p>
                <p className="text-xs text-muted-foreground">{o.location}</p>
              </article>
            ))}
          </section>
        )}
      </div>

      {!open && (
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-1/2 z-30 h-14 -translate-x-1/2 rounded-full px-7 text-base shadow-glow"
        >
          <Plus className="mr-1 size-5" /> Ofertar Serviço
        </Button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nova oferta</h2>
            <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => setOpen(false)}>
              <X className="size-5" />
            </Button>
          </div>
          <form onSubmit={submitOffer} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de serviço</Label>
              <Input
                value={form.service_type}
                onChange={(e) => setForm((p) => ({ ...p, service_type: e.target.value }))}
                placeholder="Ex.: Instalação elétrica"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                value={form.price}
                inputMode="decimal"
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="150,00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Região de atendimento</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Bairro, cidade"
              />
            </div>
            <Button type="submit" className="h-12 w-full">
              Publicar oferta
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}
