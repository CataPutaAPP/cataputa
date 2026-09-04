import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { MapBackground } from "@/components/MapBackground";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import type { ServiceRequest, Urgency } from "@/types";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Painel do cliente — ServiHub" },
      {
        name: "description",
        content: "Solicite serviços, defina urgência e acompanhe suas solicitações ativas.",
      },
      { property: "og:title", content: "Painel do cliente — ServiHub" },
      { property: "og:description", content: "Solicite serviços e acompanhe o andamento." },
    ],
  }),
  component: ClienteDashboard,
});

const urgencyLabel: Record<Urgency, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
};

function ClienteDashboard() {
  return (
    <DashboardShell role="cliente">
      <ClienteContent />
    </DashboardShell>
  );
}

function ClienteContent() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [form, setForm] = useState({
    service_type: "",
    description: "",
    location: "",
    urgency: "media" as Urgency,
    wants_partner: false,
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.service_type || !form.description || !form.location) {
      toast.error("Preencha tipo, descrição e localização.");
      return;
    }
    const request: ServiceRequest = {
      id: crypto.randomUUID(),
      client_id: user?.id ?? "",
      client_name: user?.full_name ?? "Visitante",
      service_type: form.service_type,
      description: form.description,
      location: form.location,
      urgency: form.urgency,
      status: "aberta",
      wants_partner: form.wants_partner,
      created_at: new Date().toISOString(),
    };
    setRequests((prev) => [request, ...prev]);
    setForm({ service_type: "", description: "", location: "", urgency: "media", wants_partner: false });
    setOpen(false);
    toast.success("Solicitação enviada! Prestadores próximos foram notificados.");
  }

  return (
    <main className="relative min-h-screen">
      <MapBackground className="fixed inset-0" />

      <div className="relative z-10 px-4 pt-24 pb-32">
        <h1 className="text-2xl font-semibold">Olá, {user?.full_name?.split(" ")[0] ?? "visitante"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O que você precisa resolver hoje?
        </p>

        <section className="mt-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Solicitações ativas
          </h2>
          {requests.length === 0 ? (
            <div className="panel p-5 text-sm text-muted-foreground">
              Você ainda não tem solicitações. Toque em "Solicitar Serviço" para começar.
            </div>
          ) : (
            requests.map((r) => (
              <article key={r.id} className="panel space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{r.service_type}</h3>
                  <Badge variant="secondary">{r.status === "aberta" ? "Aberta" : "Em andamento"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{r.description}</p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {r.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" /> Urgência {urgencyLabel[r.urgency]}
                  </span>
                  {r.wants_partner && <span className="text-primary">Aberta a parceiros</span>}
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {!open && (
        <Button
          size="lg"
          onClick={() => setOpen(true)}
          className="fixed bottom-6 left-1/2 z-30 h-14 -translate-x-1/2 rounded-full px-7 text-base shadow-glow"
        >
          <Plus className="mr-1 size-5" /> Solicitar Serviço
        </Button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nova solicitação</h2>
            <Button variant="ghost" size="icon" aria-label="Fechar" onClick={() => setOpen(false)}>
              <X className="size-5" />
            </Button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de serviço</Label>
              <Select
                value={form.service_type}
                onValueChange={(v) => setForm((p) => ({ ...p, service_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {["Elétrica", "Encanamento", "Limpeza", "Frete", "Reforma", "Tecnologia"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descreva o que precisa ser feito"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="Rua, número, bairro"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Urgência</Label>
              <Select
                value={form.urgency}
                onValueChange={(v) => setForm((p) => ({ ...p, urgency: v as Urgency }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border p-3">
              <div>
                <p className="text-sm font-medium">Aceitar parceiro</p>
                <p className="text-xs text-muted-foreground">
                  Permite que um parceiro participe da negociação
                </p>
              </div>
              <Switch
                checked={form.wants_partner}
                onCheckedChange={(v) => setForm((p) => ({ ...p, wants_partner: v }))}
              />
            </div>
            <Button type="submit" className="h-12 w-full">
              Enviar solicitação
            </Button>
          </form>
        </div>
      )}
    </main>
  );
}
