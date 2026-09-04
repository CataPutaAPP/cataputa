import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  MapPin, DollarSign, Clock, Loader2, Building2, Camera,
  Save, Eye, Handshake, Star, Settings, Inbox,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PhotoManager } from "@/components/ProviderProfile";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/parceiro")({
  head: () => ({
    meta: [
      { title: "Painel do parceiro — CataPuta Web" },
      { name: "description", content: "Cadastre seu espaço e ganhe com cada atendimento." },
    ],
  }),
  component: () => <DashboardShell role="parceiro"><ParceiroContent /></DashboardShell>,
});

/* ─── Types ─────────────────────────────────────────────────────────── */

const localTypes = [
  { value: "motel", label: "Motel" },
  { value: "drive", label: "Drive" },
  { value: "hotel", label: "Hotel" },
  { value: "hostel", label: "Hostel" },
  { value: "quarto", label: "Quarto" },
  { value: "garagem", label: "Garagem" },
  { value: "outro", label: "Outro" },
];

interface MyBooking {
  id: string;
  request_id: string;
  share_percent: number;
  share_amount: number;
  status: string;
  created_at: string;
  request?: {
    service_type: string;
    sub_type: string;
    status: string;
  };
}

/* ─── Component ─────────────────────────────────────────────────────── */

function ParceiroContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"local" | "reservas">("local");
  const [saving, setSaving] = useState(false);

  // Local setup form
  const [localType, setLocalType] = useState(user?.local_type ?? "");
  const [localAddress, setLocalAddress] = useState(user?.local_address ?? "");
  const [localDesc, setLocalDesc] = useState(user?.local_description ?? "");
  const [localPrice, setLocalPrice] = useState(user?.local_price?.toString() ?? "");
  const [localLat, setLocalLat] = useState(user?.lat?.toString() ?? "");
  const [localLng, setLocalLng] = useState(user?.lng?.toString() ?? "");

  // Bookings
  const [bookings, setBookings] = useState<MyBooking[]>([]);

  // Load profile data
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("local_type, local_address, local_description, local_price, lat, lng")
        .eq("id", user.id)
        .single();
      if (data) {
        setLocalType(data.local_type ?? "");
        setLocalAddress(data.local_address ?? "");
        setLocalDesc(data.local_description ?? "");
        setLocalPrice(data.local_price?.toString() ?? "");
        if (data.lat) setLocalLat(data.lat.toString());
        if (data.lng) setLocalLng(data.lng.toString());
      }
    })();
  }, [user]);

  // Geolocation
  function captureLocation() {
    if (!navigator.geolocation) return toast.error("Geolocalização não disponível.");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocalLat(pos.coords.latitude.toFixed(6));
        setLocalLng(pos.coords.longitude.toFixed(6));
        toast.success("Localização capturada!");
      },
      () => toast.error("Não foi possível capturar a localização."),
      { enableHighAccuracy: true },
    );
  }

  // Save local
  async function handleSave() {
    if (!localType) return toast.error("Selecione o tipo do local.");
    if (!localAddress.trim()) return toast.error("Informe o endereço.");
    const price = parseFloat(localPrice.replace(",", "."));
    if (!price || price <= 0) return toast.error("Informe um preço válido.");
    if (!localLat || !localLng) return toast.error("Capture a localização no mapa.");
    if (!user) return;

    setSaving(true);
    const { error } = await supabase.rpc("update_partner_local", {
      p_user_id: user.id,
      p_local_type: localType,
      p_local_address: localAddress.trim(),
      p_local_description: localDesc.trim() || null,
      p_local_price: price,
      p_lat: parseFloat(localLat),
      p_lng: parseFloat(localLng),
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao salvar."); return; }
    toast.success("Local salvo! Você aparecerá no mapa para clientes.");
  }

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("partnerships")
      .select("*, request:service_requests!request_id(service_type, sub_type, status)")
      .eq("partner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) {
      setBookings(data.map((d: any) => ({
        ...d,
        request: Array.isArray(d.request) ? d.request[0] : d.request,
      })) as MyBooking[]);
    }
  }, [user]);

  useEffect(() => {
    fetchBookings();
    const interval = setInterval(fetchBookings, 15000);
    return () => clearInterval(interval);
  }, [fetchBookings]);

  const totalEarnings = bookings
    .filter((b) => b.status === "concluida" || b.request?.status === "concluida")
    .reduce((sum, b) => sum + Number(b.share_amount), 0);

  const activeCount = bookings.filter((b) => ["aceita", "em_andamento"].includes(b.status)).length;
  const isConfigured = !!localType && !!localAddress && parseFloat(localPrice) > 0 && !!localLat;

  const statusLabel: Record<string, { text: string; cls: string }> = {
    convite: { text: "Pendente", cls: "bg-yellow-500/20 text-yellow-400" },
    aceita: { text: "Confirmada", cls: "bg-green-500/20 text-green-400" },
    em_andamento: { text: "Em uso", cls: "bg-primary/20 text-primary animate-pulse" },
    concluida: { text: "Concluída", cls: "bg-green-500/20 text-green-400" },
    recusada: { text: "Cancelada", cls: "opacity-50" },
  };

  return (
    <main className="min-h-screen px-4 pb-16 pt-20" style={{ background: "#0a0a12" }}>
      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Status</p>
          <p className={`mt-1 text-sm font-bold ${isConfigured ? "text-green-400" : "text-yellow-400"}`}>
            {isConfigured ? "Ativo" : "Pendente"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Reservas</p>
          <p className="mt-1 text-sm font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Ganhos</p>
          <p className="mt-1 text-sm font-bold text-green-400">R$ {totalEarnings.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("local")}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${tab === "local" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          <Settings className="mr-1.5 inline size-4" /> Meu local
        </button>
        <button onClick={() => setTab("reservas")}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${tab === "reservas" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
          <Handshake className="mr-1.5 inline size-4" /> Reservas {activeCount > 0 && `(${activeCount})`}
        </button>
      </div>

      {/* Tab: Meu local */}
      {tab === "local" && (
        <div className="space-y-5">
          {/* Type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Tipo do local</Label>
            <div className="flex flex-wrap gap-2">
              {localTypes.map((t) => (
                <button key={t.value} onClick={() => setLocalType(t.value)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${localType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Endereço completo</Label>
            <Input value={localAddress} onChange={(e) => setLocalAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade..." />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Descrição do espaço</Label>
            <Textarea rows={3} value={localDesc} onChange={(e) => setLocalDesc(e.target.value)}
              placeholder="Descreva o ambiente: quarto privativo, suíte, estacionamento, sigilo..." />
          </div>

          {/* Price */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Preço por uso (R$)</Label>
            <Input value={localPrice} onChange={(e) => setLocalPrice(e.target.value)}
              placeholder="80,00" inputMode="decimal" />
            {parseFloat(localPrice.replace(",", ".")) > 0 && (
              <p className="text-xs text-muted-foreground">
                Você recebe: <span className="font-semibold text-green-400">
                  R$ {(parseFloat(localPrice.replace(",", ".")) * 0.90).toFixed(2)}
                </span>
                <span className="ml-1">(plataforma retém 10%)</span>
              </p>
            )}
          </div>

          {/* Geolocation */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Localização exata</Label>
            {localLat && localLng ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 p-3">
                <MapPin className="size-5 text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Localização capturada</p>
                  <p className="text-[10px] text-muted-foreground">{localLat}, {localLng}</p>
                </div>
                <Button variant="secondary" size="sm" onClick={captureLocation}>Atualizar</Button>
              </div>
            ) : (
              <Button variant="secondary" className="w-full" onClick={captureLocation}>
                <MapPin className="mr-2 size-4" /> Capturar minha localização
              </Button>
            )}
          </div>

          {/* Photos */}
          {user && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <PhotoManager userId={user.id} onDone={() => {}} />
            </div>
          )}

          {/* Save */}
          <Button className="h-13 w-full text-base" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
            {saving ? "Salvando..." : "Salvar local"}
          </Button>
        </div>
      )}

      {/* Tab: Reservas */}
      {tab === "reservas" && (
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Inbox className="size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {isConfigured
                  ? "Nenhuma reserva ainda. Clientes verão seu local no mapa."
                  : "Configure seu local na aba anterior para começar a receber reservas."
                }
              </p>
            </div>
          ) : (
            bookings.map((b) => {
              const st = statusLabel[b.status] ?? { text: b.status, cls: "" };
              return (
                <article key={b.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                        <Building2 className="size-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">
                          {b.request?.service_type === "massagem" ? "Massagem" : "Acompanhante"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.request?.sub_type ?? "Serviço"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className={`text-[10px] ${st.cls}`}>{st.text}</Badge>
                      <p className="mt-1 text-sm font-bold text-green-400">
                        +R$ {Number(b.share_amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    <Clock className="mr-1 inline size-3" />{new Date(b.created_at).toLocaleString("pt-BR")}
                  </p>
                </article>
              );
            })
          )}
        </div>
      )}
    </main>
  );
}
