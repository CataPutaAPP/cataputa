import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  MapPin, Clock, Loader2, Building2, Camera, Save, Handshake,
  Settings, Inbox, BedDouble, Plus, Pencil, Trash2, X, Eye, EyeOff,
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
import { playNotificationSound } from "@/lib/notifications";
import { brl } from "@/lib/fees";

export const Route = createFileRoute("/parceiro")({
  head: () => ({
    meta: [
      { title: "Painel do parceiro — Privora" },
      { name: "description", content: "Cadastre seus quartos e ganhe com cada atendimento." },
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

interface Room {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  sort_order: number;
}

interface Booking {
  id: string;
  request_id: string;
  room_id: string;
  room_price: number;
  partner_net: number;
  duration_minutes: number;
  status: "pendente" | "confirmada" | "em_uso" | "concluida" | "cancelada";
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

const durationOptions = [30, 60, 120, 180, 240, 360, 720];
const fmtDuration = (m: number) => (m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`);

const emptyRoom = { id: "", name: "", description: "", price: "", duration: 60, photo_url: "" as string | null };

/* ─── Component ─────────────────────────────────────────────────────── */

function ParceiroContent() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"local" | "quartos" | "reservas">("quartos");

  // ── Local (endereço + geolocalização) ──
  const [saving, setSaving] = useState(false);
  const [localType, setLocalType] = useState("");
  const [localAddress, setLocalAddress] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  const [legacyPrice, setLegacyPrice] = useState<number | null>(null);
  const [localLat, setLocalLat] = useState("");
  const [localLng, setLocalLng] = useState("");

  // ── Quartos ──
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomForm, setRoomForm] = useState<typeof emptyRoom | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // ── Reservas ──
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles")
        .select("local_type, local_address, local_description, local_price, lat, lng")
        .eq("id", user.id).single();
      if (data) {
        setLocalType(data.local_type ?? "");
        setLocalAddress(data.local_address ?? "");
        setLocalDesc(data.local_description ?? "");
        setLegacyPrice(data.local_price ? Number(data.local_price) : null);
        if (data.lat) setLocalLat(String(data.lat));
        if (data.lng) setLocalLng(String(data.lng));
      }
    })();
  }, [user]);

  const fetchRooms = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("partner_rooms").select("*")
      .eq("partner_id", user.id).order("sort_order").order("created_at");
    setRooms((data as Room[]) ?? []);
  }, [user]);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("room_bookings").select("*")
      .eq("partner_id", user.id).order("created_at", { ascending: false }).limit(50);
    setBookings((data as Booking[]) ?? []);
  }, [user]);

  useEffect(() => { fetchRooms(); fetchBookings(); }, [fetchRooms, fetchBookings]);

  // Realtime: parceiro é avisado na hora quando um quarto é reservado/confirmado
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`partner-bookings-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "room_bookings", filter: `partner_id=eq.${user.id}` },
        (payload) => {
          const b = payload.new as Booking;
          const old = payload.old as Partial<Booking>;
          if (payload.eventType === "INSERT") {
            toast("Quarto sendo reservado — aguardando pagamento do cliente", { icon: "🛏️" });
          } else if (payload.eventType === "UPDATE" && b.status === "confirmada" && old?.status !== "confirmada") {
            playNotificationSound("accepted");
            toast.success(`Reserva confirmada! ${brl(b.room_price)} — pagamento no seu estabelecimento`);
          } else if (payload.eventType === "UPDATE" && b.status === "cancelada" && old?.status !== "cancelada") {
            toast("Uma reserva foi cancelada.", { icon: "⚠️" });
          }
          fetchBookings();
        })
      .subscribe();
    const fallback = setInterval(fetchBookings, 60000);
    return () => { supabase.removeChannel(channel); clearInterval(fallback); };
  }, [user, fetchBookings]);

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

  const activeRooms = rooms.filter((r) => r.is_active);
  const minRoomPrice = activeRooms.length ? Math.min(...activeRooms.map((r) => Number(r.price))) : null;

  async function handleSaveLocal() {
    if (!localType) return toast.error("Selecione o tipo do local.");
    if (!localAddress.trim()) return toast.error("Informe o endereço.");
    if (!localLat || !localLng) return toast.error("Capture a localização no mapa.");
    if (!user) return;
    setSaving(true);
    // local_price é só referência legada; o catálogo de quartos é a fonte dos preços
    const { error } = await supabase.rpc("update_partner_local", {
      p_user_id: user.id,
      p_local_type: localType,
      p_local_address: localAddress.trim(),
      p_local_description: localDesc.trim() || null,
      p_local_price: minRoomPrice ?? legacyPrice ?? 1,
      p_lat: parseFloat(localLat),
      p_lng: parseFloat(localLng),
    });
    setSaving(false);
    if (error) { toast.error(error.message || "Erro ao salvar."); return; }
    toast.success("Local salvo!");
    if (rooms.length === 0) { setTab("quartos"); setRoomForm({ ...emptyRoom }); }
  }

  // ── CRUD de quartos ──
  async function handleRoomPhoto(file: File) {
    if (!user) return;
    if (!file.type.startsWith("image/")) return toast.error("Apenas imagens.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Máximo 5MB por foto.");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/rooms/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: false });
    setUploading(false);
    if (error) return toast.error(`Erro no upload: ${error.message}`);
    const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(path);
    setRoomForm((f) => (f ? { ...f, photo_url: publicUrl } : f));
  }

  async function handleSaveRoom() {
    if (!user || !roomForm) return;
    const price = parseFloat(String(roomForm.price).replace(",", "."));
    if (!roomForm.name.trim()) return toast.error("Dê um nome ao quarto.");
    if (!price || price <= 0) return toast.error("Informe um valor válido.");
    if (!roomForm.photo_url) return toast.error("Adicione uma foto do quarto.");
    setSavingRoom(true);
    const payload = {
      partner_id: user.id,
      name: roomForm.name.trim(),
      description: roomForm.description.trim() || null,
      photo_url: roomForm.photo_url,
      price,
      duration_minutes: roomForm.duration,
      updated_at: new Date().toISOString(),
    };
    const { error } = roomForm.id
      ? await supabase.from("partner_rooms").update(payload).eq("id", roomForm.id)
      : await supabase.from("partner_rooms").insert({ ...payload, sort_order: rooms.length });
    setSavingRoom(false);
    if (error) { console.error(error); return toast.error("Erro ao salvar quarto."); }
    toast.success(roomForm.id ? "Quarto atualizado!" : "Quarto cadastrado! Já aparece para clientes próximos.");
    setRoomForm(null);
    fetchRooms();
  }

  async function toggleRoom(r: Room) {
    const { error } = await supabase.from("partner_rooms").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) return toast.error("Erro ao atualizar.");
    fetchRooms();
  }

  async function deleteRoom(r: Room) {
    if (!confirm(`Excluir "${r.name}"?`)) return;
    const { error } = await supabase.from("partner_rooms").delete().eq("id", r.id);
    if (error) {
      // quarto com histórico de reservas não pode ser apagado — só desativado
      toast.error("Este quarto tem reservas no histórico. Ele foi desativado em vez de excluído.");
      await supabase.from("partner_rooms").update({ is_active: false }).eq("id", r.id);
    } else toast.success("Quarto excluído.");
    fetchRooms();
  }

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "Quarto";
  const openBookings = bookings.filter((b) => ["pendente", "confirmada", "em_uso"].includes(b.status));
  const totalEarnings = bookings.filter((b) => b.status === "concluida").reduce((s, b) => s + Number(b.room_price), 0);
  const isConfigured = !!localAddress && !!localLat && activeRooms.length > 0;

  const statusLabel: Record<Booking["status"], { text: string; cls: string }> = {
    pendente: { text: "Aguardando pagamento", cls: "bg-yellow-500/20 text-yellow-400" },
    confirmada: { text: "Confirmada", cls: "bg-green-500/20 text-green-400 animate-pulse" },
    em_uso: { text: "Em uso", cls: "bg-primary/20 text-primary" },
    concluida: { text: "Concluída", cls: "bg-green-500/20 text-green-400" },
    cancelada: { text: "Cancelada", cls: "opacity-60" },
  };

  const TabBtn = ({ id, icon, children }: { id: typeof tab; icon: React.ReactNode; children: React.ReactNode }) => (
    <button onClick={() => setTab(id)}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-all ${tab === id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
      {icon}{children}
    </button>
  );

  return (
    <main className="min-h-screen px-4 pb-16 pt-20" style={{ background: "#0a0a12" }}>
      {/* Stats */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Status</p>
          <p className={`mt-1 text-sm font-bold ${isConfigured ? "text-green-400" : "text-yellow-400"}`}>{isConfigured ? "Ativo" : "Pendente"}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Reservas ativas</p>
          <p className="mt-1 text-sm font-bold">{openBookings.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 text-center">
          <p className="text-[10px] text-muted-foreground">Reservas concluídas</p>
          <p className="mt-1 text-sm font-bold text-green-400">{brl(totalEarnings)}</p>
        </div>
      </div>

      {!isConfigured && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs text-yellow-300">
          Para aparecer no mapa: salve seu endereço com localização em <b>Meu local</b> e cadastre ao menos um quarto ativo.
        </div>
      )}

      <div className="mb-4 flex gap-2">
        <TabBtn id="quartos" icon={<BedDouble className="size-4" />}>Quartos</TabBtn>
        <TabBtn id="reservas" icon={<Handshake className="size-4" />}>Reservas{openBookings.length > 0 && ` (${openBookings.length})`}</TabBtn>
        <TabBtn id="local" icon={<Settings className="size-4" />}>Meu local</TabBtn>
      </div>

      {/* ── Quartos ── */}
      {tab === "quartos" && !roomForm && (
        <div className="space-y-3">
          {rooms.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <BedDouble className="size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum quarto cadastrado ainda.</p>
            </div>
          )}
          {rooms.map((r) => (
            <article key={r.id} className={`flex gap-3 rounded-2xl border border-border bg-card p-3 ${r.is_active ? "" : "opacity-50"}`}>
              <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {r.photo_url ? <img src={r.photo_url} alt={r.name} className="size-full object-cover" />
                  : <div className="flex size-full items-center justify-center"><Camera className="size-6 text-muted-foreground" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="shrink-0 font-bold text-primary">{brl(r.price)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  <Clock className="mr-1 inline size-3" />{fmtDuration(r.duration_minutes)} · pago no seu estabelecimento
                </p>
                {!r.photo_url && <p className="mt-0.5 text-[11px] text-yellow-400">Sem foto — adicione para aparecer melhor</p>}
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => setRoomForm({
                    id: r.id, name: r.name, description: r.description ?? "", price: String(r.price),
                    duration: r.duration_minutes, photo_url: r.photo_url,
                  })}><Pencil className="mr-1 size-3" />Editar</Button>
                  <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => toggleRoom(r)}>
                    {r.is_active ? <><EyeOff className="mr-1 size-3" />Pausar</> : <><Eye className="mr-1 size-3" />Ativar</>}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive" onClick={() => deleteRoom(r)}>
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
          <Button className="h-12 w-full" onClick={() => setRoomForm({ ...emptyRoom })}>
            <Plus className="mr-2 size-5" /> Adicionar quarto
          </Button>
        </div>
      )}

      {tab === "quartos" && roomForm && (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{roomForm.id ? "Editar quarto" : "Novo quarto"}</h3>
            <Button variant="ghost" size="icon" onClick={() => setRoomForm(null)}><X className="size-5" /></Button>
          </div>

          <div className="space-y-1.5">
            <Label>Foto</Label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleRoomPhoto(f); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()}
              className="flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary/30">
              {uploading ? <Loader2 className="size-6 animate-spin text-primary" />
                : roomForm.photo_url ? <img src={roomForm.photo_url} alt="" className="size-full object-cover" />
                : <span className="flex flex-col items-center gap-1 text-xs text-muted-foreground"><Camera className="size-6" />Toque para enviar</span>}
            </button>
          </div>

          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="Suíte com hidro, Standard..." />
          </div>

          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input value={roomForm.price} inputMode="decimal" placeholder="120,00"
              onChange={(e) => setRoomForm({ ...roomForm, price: e.target.value })} />
            {parseFloat(String(roomForm.price).replace(",", ".")) > 0 && (
              <p className="text-xs text-muted-foreground">
                O cliente paga <span className="font-semibold text-green-400">
                  {brl(parseFloat(String(roomForm.price).replace(",", ".")))}
                </span> direto no seu estabelecimento. A Privora não cobra comissão sobre reservas.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Tempo de permanência</Label>
            <div className="flex flex-wrap gap-2">
              {durationOptions.map((d) => (
                <button key={d} onClick={() => setRoomForm({ ...roomForm, duration: d })}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${roomForm.duration === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  {fmtDuration(d)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea rows={2} value={roomForm.description} onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })}
              placeholder="Hidromassagem, garagem privativa, ar-condicionado..." />
          </div>

          <Button className="h-12 w-full" disabled={savingRoom || uploading} onClick={handleSaveRoom}>
            {savingRoom ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
            {savingRoom ? "Salvando..." : "Salvar quarto"}
          </Button>
        </div>
      )}

      {/* ── Reservas ── */}
      {tab === "reservas" && (
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Inbox className="size-12 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">
                {isConfigured ? "Nenhuma reserva ainda. Você será avisado na hora." : "Complete seu cadastro para começar a receber reservas."}
              </p>
            </div>
          ) : bookings.map((b) => {
            const st = statusLabel[b.status] ?? { text: b.status, cls: "" };
            return (
              <article key={b.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent"><Building2 className="size-5" /></div>
                    <div>
                      <p className="text-sm font-semibold">{roomName(b.room_id)}</p>
                      <p className="text-xs text-muted-foreground">{fmtDuration(b.duration_minutes)} · {brl(b.room_price)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className={`text-[10px] ${st.cls}`}>{st.text}</Badge>
                    <p className={`mt-1 text-sm font-bold ${b.status === "cancelada" ? "text-muted-foreground line-through" : "text-green-400"}`}>{brl(b.room_price)}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  <Clock className="mr-1 inline size-3" />
                  {b.starts_at
                    ? `${new Date(b.starts_at).toLocaleString("pt-BR")} até ${b.ends_at ? new Date(b.ends_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}`
                    : `Solicitada em ${new Date(b.created_at).toLocaleString("pt-BR")}`}
                </p>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Meu local ── */}
      {tab === "local" && (
        <div className="space-y-5">
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

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Endereço completo</Label>
            <Input value={localAddress} onChange={(e) => setLocalAddress(e.target.value)} placeholder="Rua, número, bairro, cidade..." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Descrição do estabelecimento</Label>
            <Textarea rows={3} value={localDesc} onChange={(e) => setLocalDesc(e.target.value)}
              placeholder="Estacionamento, sigilo, horário de funcionamento..." />
          </div>

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

          {user && (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="mb-2 text-sm font-semibold">Fotos do estabelecimento</p>
              <PhotoManager userId={user.id} onDone={() => {}} />
            </div>
          )}

          <Button className="h-13 w-full text-base" disabled={saving} onClick={handleSaveLocal}>
            {saving ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Save className="mr-2 size-5" />}
            {saving ? "Salvando..." : "Salvar local"}
          </Button>
        </div>
      )}
    </main>
  );
}
