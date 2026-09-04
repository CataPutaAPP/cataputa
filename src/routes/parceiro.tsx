import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Check, X, Handshake, MapPin, DollarSign, Clock,
  Loader2, Inbox, RefreshCw, Building2, Sparkles, Star,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { getSubLabel, type ServiceType } from "@/lib/service-options";

export const Route = createFileRoute("/parceiro")({
  head: () => ({
    meta: [
      { title: "Painel do parceiro — CataPuta Web" },
      { name: "description", content: "Forneça locais para atendimento e ganhe comissão." },
    ],
  }),
  component: () => <DashboardShell role="parceiro"><ParceiroContent /></DashboardShell>,
});

/* ─── Types ─────────────────────────────────────────────────────────── */

interface OpenPartnership {
  partnership_id: string;
  request_id: string;
  share_percent: number;
  share_amount: number;
  status: string;
  created_at: string;
  service_type: string;
  sub_type: string;
  request_lat: number;
  request_lng: number;
  distance_km: number;
}

interface MyPartnership {
  id: string;
  request_id: string;
  address: string | null;
  share_percent: number;
  share_amount: number;
  status: string;
  created_at: string;
  // joined
  request?: {
    service_type: string;
    sub_type: string;
    status: string;
  };
}

/* ─── Component ─────────────────────────────────────────────────────── */

function ParceiroContent() {
  const { user, updateLocation } = useAuth();
  const [tab, setTab] = useState<"abertos" | "meus">("abertos");
  const [loading, setLoading] = useState(false);

  // Open partnerships nearby
  const [openList, setOpenList] = useState<OpenPartnership[]>([]);

  // My partnerships
  const [myList, setMyList] = useState<MyPartnership[]>([]);

  // Accept form
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (user) updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true },
    );
  }, [user, updateLocation]);

  // Fetch open partnerships
  const fetchOpen = useCallback(async () => {
    if (!user?.lat || !user?.lng) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("nearby_partnerships", {
      p_lat: user.lat,
      p_lng: user.lng,
      p_radius_km: 20,
    });
    if (data) setOpenList(data as OpenPartnership[]);
    if (error) console.error("nearby_partnerships", error);
    setLoading(false);
  }, [user]);

  // Fetch my partnerships
  const fetchMine = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("partnerships")
      .select("*, request:service_requests!request_id(service_type, sub_type, status)")
      .eq("partner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      setMyList(data.map((d: any) => ({
        ...d,
        request: Array.isArray(d.request) ? d.request[0] : d.request,
      })) as MyPartnership[]);
    }
  }, [user]);

  useEffect(() => {
    fetchOpen();
    fetchMine();
    const interval = setInterval(() => { fetchOpen(); fetchMine(); }, 15000);
    return () => clearInterval(interval);
  }, [fetchOpen, fetchMine]);

  // Accept partnership
  async function handleAccept(partnershipId: string) {
    if (!address.trim()) return toast.error("Informe o endereço do local.");
    if (!user) return;
    setSubmitting(true);
    const { error } = await supabase.rpc("accept_partnership", {
      p_partnership_id: partnershipId,
      p_partner_id: user.id,
      p_address: address.trim(),
      p_lat: user.lat ?? null,
      p_lng: user.lng ?? null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message || "Erro ao aceitar."); return; }
    toast.success("Parceria aceita! O endereço foi enviado.");
    setAcceptingId(null);
    setAddress("");
    fetchOpen();
    fetchMine();
  }

  const statusLabel: Record<string, { text: string; cls: string }> = {
    convite: { text: "Aberta", cls: "bg-yellow-500/20 text-yellow-400" },
    aceita: { text: "Aceita", cls: "bg-green-500/20 text-green-400" },
    recusada: { text: "Recusada", cls: "opacity-50" },
    em_andamento: { text: "Em andamento", cls: "bg-primary/20 text-primary" },
    concluida: { text: "Concluída", cls: "bg-green-500/20 text-green-400" },
  };

  return (
    <main className="min-h-screen px-4 pb-16 pt-20" style={{ background: "#0a0a12" }}>
      {/* Header stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Disponíveis</p>
          <p className="mt-1 text-2xl font-bold text-primary">{openList.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Minhas parcerias</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{myList.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("abertos")}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${tab === "abertos" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          Disponíveis
        </button>
        <button onClick={() => setTab("meus")}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${tab === "meus" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          Minhas parcerias
        </button>
      </div>

      {/* Tab: Abertos */}
      {tab === "abertos" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Solicitações que precisam de local (20 km)</p>
            <Button variant="ghost" size="sm" onClick={fetchOpen} disabled={loading}>
              <RefreshCw className={`mr-1 size-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>

          {openList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Inbox className="size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {!user?.lat ? "Ative a localização para ver oportunidades." : "Nenhuma solicitação com parceiro no raio."}
              </p>
            </div>
          ) : (
            openList.map((p) => (
              <article key={p.partnership_id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                      <Building2 className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{getSubLabel(p.service_type as any, p.sub_type)}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.service_type === "massagem" ? "Massagem" : "Acompanhante"} · {p.distance_km} km
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">R$ {Number(p.share_amount).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">{p.share_percent}% comissão</p>
                  </div>
                </div>

                <p className="mt-2 text-[10px] text-muted-foreground">
                  <Clock className="mr-1 inline size-3" />{new Date(p.created_at).toLocaleString("pt-BR")}
                </p>

                {acceptingId === p.partnership_id ? (
                  <div className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Endereço do local</Label>
                      <Input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Rua, número, bairro, complemento..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1" disabled={submitting} onClick={() => handleAccept(p.partnership_id)}>
                        {submitting ? <Loader2 className="mr-1 size-4 animate-spin" /> : <Check className="mr-1 size-4" />}
                        {submitting ? "Enviando..." : "Confirmar"}
                      </Button>
                      <Button variant="secondary" onClick={() => { setAcceptingId(null); setAddress(""); }}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button className="mt-3 h-10 w-full" onClick={() => setAcceptingId(p.partnership_id)}>
                    <Handshake className="mr-2 size-4" /> Fornecer local
                  </Button>
                )}
              </article>
            ))
          )}
        </div>
      )}

      {/* Tab: Meus */}
      {tab === "meus" && (
        <div className="space-y-3">
          {myList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Handshake className="size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Você ainda não aceitou nenhuma parceria.</p>
            </div>
          ) : (
            myList.map((p) => {
              const st = statusLabel[p.status] ?? { text: p.status, cls: "" };
              return (
                <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                        <Handshake className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {p.request ? getSubLabel(p.request.service_type as any, p.request.sub_type) : "Serviço"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.address ?? "Sem endereço"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className={`text-[10px] ${st.cls}`}>{st.text}</Badge>
                      <p className="mt-1 text-sm font-bold text-green-400">R$ {Number(p.share_amount).toFixed(2)}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    <Clock className="mr-1 inline size-3" />{new Date(p.created_at).toLocaleString("pt-BR")}
                  </p>
                  {p.request?.status === "concluida" && p.status !== "concluida" && (
                    <p className="mt-2 text-xs text-green-400">Serviço concluído — pagamento será liberado</p>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}
