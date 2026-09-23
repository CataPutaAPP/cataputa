import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  X,
  Navigation,
  Radar,
  Eye,
  Check,
  XCircle,
  Loader2,
  Star,
  Home,
  Users,
  DollarSign,
  Clock,
  MapPin,
  Sparkles,
  Send,
  Car,
  MessageCircle,
  UserCircle,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { LeafletMap, type MapCoords, type MapMarker } from "@/components/LeafletMap";
import { MatchView, type ActiveService } from "@/components/MatchView";
import { PhotoManager } from "@/components/ProviderProfile";
import { ChatPanel, useUnreadChats } from "@/components/ChatPanel";
import { CheckoutSheet, type CheckoutItem } from "@/components/CheckoutSheet";
import { ProviderStats } from "@/components/ProviderStats";
import { ProviderVideoManager } from "@/components/ProviderVideo";
import { HistorySheet } from "@/components/HistorySheet";
import { useMyPlan } from "@/lib/plans";
import { useRealtime } from "@/lib/realtime";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import {
  type ServiceType,
  type LocalOption,
  serviceSubTypes,
  serviceFlags,
  genderOptions,
  radiusOptions,
  providerLocalOptions,
  getSubLabel,
  getLocalLabel,
  isCarro,
} from "@/lib/service-options";
import { brl } from "@/lib/fees";

export const Route = createFileRoute("/prestador")({
  head: () => ({
    meta: [
      { title: "Painel do prestador — Privora" },
      {
        name: "description",
        content: "Receba demandas, envie propostas e oferte seus serviços.",
      },
    ],
  }),
  component: PrestadorDashboard,
});

/* ─── Types ─────────────────────────────────────────────────────────── */

interface NearbyRequest {
  id: string;
  client_id: string;
  service_type: ServiceType;
  sub_type: string;
  flags: string[];
  gender_pref: string[];
  local_option: LocalOption;
  lat: number;
  lng: number;
  status: string;
  created_at: string;
  distance_km: number;
}

interface MyProposal {
  id: string;
  request_id: string;
  price: number;
  client_price: number;
  status: string;
  created_at: string;
  message: string | null;
}

/* ─── Component ─────────────────────────────────────────────────────── */

function PrestadorDashboard() {
  return (
    <DashboardShell role="prestador">
      <PrestadorContent />
    </DashboardShell>
  );
}

function PrestadorContent() {
  const { user, updateLocation } = useAuth();

  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [view, setView] = useState<"map" | "offer" | "details" | "match" | "perfil">("map");
  const [radius, setRadius] = useState(10);
  const [available, setAvailable] = useState(true);

  // "Online" agora fica salvo no banco e manda sinal de vida — é o que alimenta
  // o radar do cliente. Sem sinal por alguns minutos, o perfil sai do radar.
  useEffect(() => {
    if (!user) return;
    supabase.rpc("my_availability").then(({ data }) => { if (data != null) setAvailable(!!data); });
  }, [user]);
  useEffect(() => {
    if (!user) return;
    supabase.rpc("set_availability", { p_available: available });
    if (!available) return;
    const beat = setInterval(() => { supabase.rpc("set_availability", { p_available: true }); }, 120000);
    return () => clearInterval(beat);
  }, [user, available]);

  // Requests from clients
  const [requests, setRequests] = useState<NearbyRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<NearbyRequest | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Proposal form
  const [proposalPrice, setProposalPrice] = useState("");
  const [proposalMessage, setProposalMessage] = useState("");
  const [proposalLocal, setProposalLocal] = useState<LocalOption>("local_atendente");
  const [sendingProposal, setSendingProposal] = useState(false);

  // My proposals
  const [myProposals, setMyProposals] = useState<MyProposal[]>([]);

  // Active service (post-accept)
  const [activeService, setActiveService] = useState<ActiveService | null>(null);

  // Offer form
  const [offerType, setOfferType] = useState<ServiceType | "">("");
  const [offerSubType, setOfferSubType] = useState("");
  const [offerFlags, setOfferFlags] = useState<string[]>([]);
  const [offerPrice, setOfferPrice] = useState("");
  const [offerLocal, setOfferLocal] = useState<LocalOption>("local_atendente");
  const [offerDesc, setOfferDesc] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  const [chatProposalId, setChatProposalId] = useState<string | null>(null);
  // não deixa propor "Parceiro" onde não existe nenhum cadastrado
  const [quartosPerto, setQuartosPerto] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [minhasOfertas, setMinhasOfertas] = useState<{ offer_id: string; service_type: string; sub_type: string; price: number; local_option: string; ativa: boolean }[]>([]);
  const [acaoOferta, setAcaoOferta] = useState<string | null>(null);

  const fetchMinhasOfertas = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("my_offers");
    setMinhasOfertas((data as typeof minhasOfertas) ?? []);
  }, [user]);
  useEffect(() => { fetchMinhasOfertas(); }, [fetchMinhasOfertas]);

  async function retirarProposta(id: string) {
    if (!window.confirm("Retirar esta proposta? O cliente deixa de vê-la.")) return;
    const { error } = await supabase.rpc("withdraw_proposal", { p_proposal_id: id });
    if (error) return toast.error(error.message);
    toast.success("Proposta retirada.");
    fetchMyProposals();
  }

  async function pausarOferta(id: string, ativa: boolean) {
    setAcaoOferta(id);
    const { error } = await supabase.rpc("toggle_offer", { p_offer_id: id, p_active: !ativa });
    setAcaoOferta(null);
    if (error) return toast.error(error.message);
    toast.success(ativa ? "Oferta pausada." : "Oferta reativada.");
    fetchMinhasOfertas();
  }

  async function apagarOferta(id: string) {
    if (!window.confirm("Apagar esta oferta? Não dá para desfazer.")) return;
    setAcaoOferta(id);
    const { error } = await supabase.rpc("delete_offer", { p_offer_id: id });
    setAcaoOferta(null);
    if (error) return toast.error(error.message);
    toast.success("Oferta apagada.");
    fetchMinhasOfertas();
  }
  useEffect(() => {
    if (!coords) return;
    supabase.rpc("nearby_partner_rooms", { p_lat: coords.lat, p_lng: coords.lng, p_radius_km: radius })
      .then(({ data }) => setQuartosPerto(((data as unknown[]) ?? []).length));
  }, [coords, radius]);
  const [vips, setVips] = useState<Set<string>>(new Set());
  const [prioritarios, setPrioritarios] = useState<Set<string>>(new Set());
  const { plan: myPlan, refresh: refreshPlan } = useMyPlan();
  const [boostCheckout, setBoostCheckout] = useState<CheckoutItem | null>(null);
  const [boostProduct, setBoostProduct] = useState<{ code: string; name: string; price: number; duration_hours: number } | null>(null);
  useEffect(() => {
    supabase.from("billing_products").select("code, name, price, duration_hours").eq("code", "impulso_24h").eq("is_active", true).maybeSingle()
      .then(({ data }) => setBoostProduct(data as typeof boostProduct));
  }, []);
  const boostActive = !!myPlan?.boost_until && new Date(myPlan.boost_until).getTime() > Date.now();
  const { counts: unread } = useUnreadChats(user?.id);

  // Fotos do perfil: mínimo obrigatório para propor e ofertar
  const MIN_PHOTOS = 3;
  const [photoCount, setPhotoCount] = useState<number | null>(null);
  const fetchPhotoCount = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase.from("provider_photos")
      .select("id", { count: "exact", head: true }).eq("user_id", user.id);
    setPhotoCount(count ?? 0);
  }, [user]);
  useEffect(() => { fetchPhotoCount(); }, [fetchPhotoCount]);
  const needsPhotos = photoCount !== null && photoCount < MIN_PHOTOS;
  function requirePhotos(): boolean {
    if (!needsPhotos) return true;
    toast.error(`Complete seu perfil: mínimo de ${MIN_PHOTOS} fotos para enviar propostas e ofertas.`);
    setView("perfil");
    return false;
  }


  // Proposta começa com o local que o cliente pediu; "no carro" é fixo
  useEffect(() => {
    if (!selectedRequest) return;
    setProposalLocal(isCarro(selectedRequest.sub_type) ? "carro" : selectedRequest.local_option);
  }, [selectedRequest]);
  useEffect(() => { if (isCarro(offerSubType)) setOfferLocal("carro"); else if (offerLocal === "carro") setOfferLocal("local_atendente"); }, [offerSubType]);

  const handleCoordsChange = useCallback((c: MapCoords) => {
    setCoords(c);
    if (user) updateLocation(c.lat, c.lng);
  }, [user, updateLocation]);

  // Fetch nearby requests
  const fetchRequests = useCallback(async () => {
    if (!coords) return;
    setLoadingRequests(true);

    const { data, error } = await supabase.rpc("nearby_requests", {
      p_lat: coords.lat,
      p_lng: coords.lng,
      p_radius_km: radius,
    });

    if (!error && data) {
      setRequests(data as NearbyRequest[]);
    }
    setLoadingRequests(false);
  }, [coords, radius]);

  // Fetch my proposals
  const fetchMyProposals = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("proposals")
      .select("*")
      .eq("provider_id", user.id)
      .in("status", ["pendente", "aceita"])
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setMyProposals(data as MyProposal[]);
  }, [user]);

  // Fetch active service (where I'm the accepted provider)
  const activeIdRef = useRef<string | null>(null);
  const fetchActiveService = useCallback(async () => {
    if (!user) return;
    try {
      // Se ja existe um atendimento aberto na tela, recarrega ELE pelo id —
      // sem filtro de status. Senao a conclusao some com o registro e a
      // avaliacao nunca chega a aparecer.
      const { data, error } = activeIdRef.current
        ? await supabase
            .from("service_requests")
            .select("*")
            .eq("id", activeIdRef.current)
            .maybeSingle()
        : await supabase
            .from("service_requests")
            .select("*")
            .eq("accepted_provider_id", user.id)
            .in("status", ["aceita", "a_caminho", "em_andamento"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
      if (error) { console.error("fetchActiveService", error); setActiveService(null); return; }
      if (data) {
        // Fetch proposal and client separately to avoid join issues
        const [{ data: prop }, { data: cli }] = await Promise.all([
          data.accepted_proposal_id
            ? supabase.from("proposals").select("price, client_price, message, local_option").eq("id", data.accepted_proposal_id).single()
            : Promise.resolve({ data: null }),
          supabase.from("profiles").select("full_name, avatar_url, gender, rating_avg, rating_count").eq("id", data.client_id).single(),
        ]);
        setActiveService({
          ...data,
          proposal: prop ?? undefined,
          client: cli ?? undefined,
        } as ActiveService);
        setView("match");
      } else {
        activeIdRef.current = null;
        setActiveService(null);
      }
    } catch (e) {
      console.error("fetchActiveService catch", e);
      setActiveService(null);
    }
  }, [user]);

  useEffect(() => {
    if (!coords || !available) return;
    fetchRequests();
    fetchMyProposals();
    fetchActiveService();
  }, [coords, available, fetchRequests, fetchMyProposals, fetchActiveService]);

  // Tempo real: chamados novos na região e respostas às minhas propostas
  useRealtime(
    `prestador-${user?.id ?? "anon"}`,
    [
      { table: "service_requests" },
      { table: "proposals", filter: `provider_id=eq.${user?.id}` },
    ],
    () => { fetchRequests(); fetchMyProposals(); fetchActiveService(); },
    { enabled: !!user && !!coords && available },
  );

  // Reset offer form when type changes
  useEffect(() => { setOfferSubType(""); setOfferFlags([]); }, [offerType]);

  // Clientes VIP (plano Black) aparecem sinalizados na lista de chamados
  const clientKey = requests.map((r) => r.client_id).join(",");
  useEffect(() => {
    const ids = [...new Set(requests.map((r) => r.client_id))];
    if (!ids.length) { setVips(new Set()); return; }
    supabase.rpc("vip_clients", { p_ids: ids }).then(({ data }) => setVips(new Set((data as string[]) ?? [])));
    supabase.rpc("priority_clients", { p_ids: ids }).then(({ data }) => setPrioritarios(new Set((data as string[]) ?? [])));
  }, [clientKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map markers from client requests
  // chamado de quem tem prioridade (Pass Black) aparece primeiro
  const requestsOrdenados = [...requests].sort((a, b) =>
    Number(prioritarios.has(b.client_id)) - Number(prioritarios.has(a.client_id)));

  const mapMarkers: MapMarker[] = requests.map((r) => ({
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    color: r.service_type === "massagem" ? "#22c55e" : "#eab308",
    size: 20,
    onClick: () => { setSelectedRequest(r); setView("details"); },
  }));

  function toggleFlag(val: string) {
    setOfferFlags((arr) =>
      arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val],
    );
  }

  // Send proposal for a client request
  async function handleSendProposal() {
    if (!selectedRequest || !user) return;
    const price = parseFloat(proposalPrice.replace(",", "."));
    if (!price || price <= 0) return toast.error("Informe um valor válido.");
    if (!requirePhotos()) return;
    // P4: Verificar lock
    const { data: locked } = await supabase.rpc("is_user_locked", { p_user_id: user.id });
    if (locked) return toast.error("Você já está em um atendimento ativo. Conclua antes de enviar propostas.");

    setSendingProposal(true);

    const { error } = await supabase.from("proposals").insert({
      request_id: selectedRequest.id,
      provider_id: user.id,
      price,
      local_option: proposalLocal,
      message: proposalMessage || null,
    });

    setSendingProposal(false);

    if (error) {
      if (error.code === "23505") {
        toast.error("Você já enviou uma proposta para esta solicitação.");
      } else {
        toast.error("Erro ao enviar proposta.");
        console.error(error);
      }
      return;
    }

    toast.success(`Proposta enviada! Você recebe ${brl(price)} integral, direto do cliente.`);
    setProposalPrice("");
    setProposalMessage("");
    setSelectedRequest(null);
    setView("map");
    fetchMyProposals();
  }

  // Create service offer
  async function handleCreateOffer() {
    if (!offerType || !offerSubType) return toast.error("Selecione tipo e subtipo.");
    const price = parseFloat(offerPrice.replace(",", "."));
    if (!price || price <= 0) return toast.error("Informe um valor válido.");
    if (!user || !coords) return;
    if (!requirePhotos()) return;
    // P4: Verificar lock
    const { data: locked } = await supabase.rpc("is_user_locked", { p_user_id: user.id });
    if (locked) return toast.error("Você já está em um atendimento ativo. Conclua antes de criar ofertas.");

    setSubmittingOffer(true);

    const { error } = await supabase.from("service_offers").insert({
      provider_id: user.id,
      service_type: offerType,
      sub_type: offerSubType,
      flags: offerFlags,
      gender: user.gender ?? "mulheres",
      price,
      local_option: offerLocal,
      lat: coords.lat,
      lng: coords.lng,
      radius_km: radius,
      description: offerDesc || null,
    });

    setSubmittingOffer(false);

    if (error) {
      toast.error("Erro ao criar oferta.");
      console.error(error);
      return;
    }

    toast.success(`Oferta publicada! Você recebe ${brl(price)} integral por atendimento.`);
    setOfferType("");
    setOfferSubType("");
    setOfferFlags([]);
    setOfferPrice("");
    setOfferDesc("");
    setView("map");
  }

  const providerNet = (val: string) => {
    const n = parseFloat(val.replace(",", "."));
    return isNaN(n) || n <= 0 ? null : n.toFixed(2);
  };

  return (
    <main className="relative min-h-screen" style={{ background: "#0a0a12" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <LeafletMap onCoordsChange={handleCoordsChange} markers={mapMarkers} radiusKm={radius} />
      </div>

      {/* ── Top controls ───────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-[76px] z-20 flex items-center gap-2 px-4 py-3">
        {/* Availability toggle */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-md">
          <div className={`size-2 rounded-full ${available ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs font-medium">{available ? "Online" : "Offline"}</span>
          <Switch checked={available} onCheckedChange={setAvailable} className="scale-75" />
        </div>

        {/* Meu perfil */}
        <button onClick={() => setView("perfil")}
          className={`relative flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur-md ${needsPhotos ? "border-yellow-500/60 text-yellow-400" : "border-border"}`}>
          <UserCircle className="size-4" /> Perfil
          {needsPhotos && <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-yellow-500" />}
        </button>

        {/* Radius */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-md">
          <Radar className="size-3.5 text-primary" />
          {radiusOptions.map((r) => (
            <button key={r.value} onClick={() => setRadius(r.value)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${radius === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>

        {coords && (
          <button onClick={() => window.dispatchEvent(new CustomEvent("map:center"))} className="flex size-9 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-md hover:bg-secondary">
            <Navigation className="size-4 text-primary" />
          </button>
        )}
      </div>

      {/* ── Request count badge ────────────────────────────────── */}
      {view === "map" && available && (
        <div className="fixed left-4 top-[148px] z-20">
          <Badge variant="secondary" className="backdrop-blur-md">
            {loadingRequests ? <Loader2 className="mr-1 size-3 animate-spin" /> : <MapPin className="mr-1 size-3" />}
            {requests.length} solicitações no raio
          </Badge>
        </div>
      )}

      {/* ── Active service card (floating) ─────────────────────── */}
      {view === "map" && activeService && ["aceita", "a_caminho", "em_andamento"].includes(activeService.status) && (
        <button onClick={() => setView("match")}
          className="fixed inset-x-4 bottom-24 z-20 rounded-xl border border-primary/40 bg-card/90 p-4 text-left backdrop-blur-sm animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <p className="text-sm font-semibold">Serviço ativo</p>
            </div>
            <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-[10px]">
              {activeService.status === "aceita" ? "Aceito" : activeService.status === "a_caminho" ? "A caminho" : "Em andamento"}
            </Badge>
          </div>
          <p className="mt-1.5 text-xs font-medium text-primary">Toque para acompanhar →</p>
        </button>
      )}

      {/* ── Floating cards: proposals OU requests (sem sobreposição) ── */}
      {view === "map" && !activeService && !selectedRequest && (
        <div className="fixed inset-x-4 bottom-24 z-20 max-h-48 space-y-2 overflow-y-auto">
          {/* Propostas pendentes/aceitas primeiro */}
          {myProposals.map((p) => {
            const isAccepted = p.status === "aceita";
            return (
              <div key={p.id} onClick={isAccepted ? () => fetchActiveService() : undefined}
                className={`rounded-xl border bg-card/90 p-3 backdrop-blur-sm ${isAccepted ? "border-green-500/40 cursor-pointer" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Proposta R$ {Number(p.price).toFixed(2)}</p>
                  <Badge variant="secondary" className={`text-[10px] ${isAccepted ? "bg-green-500/20 text-green-400" : ""}`}>
                    {p.status === "pendente" ? "Aguardando cliente" : isAccepted ? "Aceita! Toque →" : p.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">Você recebe {brl(p.price)} integral</p>
                  {p.status === "pendente" && (
                    <button onClick={(e) => { e.stopPropagation(); retirarProposta(p.id); }}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-destructive hover:text-destructive">
                      Retirar
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); setChatProposalId(p.id); }}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-secondary">
                    <MessageCircle className="size-3.5" /> Chat
                    {unread[p.id] ? <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread[p.id]}</span> : null}
                  </button>
                </div>
              </div>
            );
          })}
          {/* Solicitações disponíveis (só se não tem propostas) */}
          {myProposals.length === 0 && requests.slice(0, 5).map((r) => (
            <button key={r.id} onClick={() => { setSelectedRequest(r); setView("details"); }}
              className="w-full rounded-xl border border-border bg-card/90 p-3 text-left backdrop-blur-sm transition-all hover:bg-card active:scale-[0.98]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{getSubLabel(r.service_type, r.sub_type)}</p>
                  <Badge variant="secondary" className="text-[10px]">{r.service_type === "massagem" ? "Massagem" : "Acompanhante"}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{r.distance_km} km</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {vips.has(r.client_id) && <span className="mr-1 rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">★ VIP</span>}
                {r.gender_pref.join(", ")} · {getLocalLabel(isCarro(r.sub_type) ? "carro" : r.local_option, "prestador")}
              </p>
              <p className="mt-1 text-xs font-medium text-primary">Toque para enviar proposta →</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Match / Service view ───────────────────────────── */}
      {view === "match" && activeService && user && (
        <MatchView
          service={activeService}
          role="prestador"
          userId={user.id}
          onClose={() => { activeIdRef.current = null; setView("map"); setActiveService(null); }}
          onRefresh={fetchActiveService}
        />
      )}

      {/* ── Request detail + proposal form ─────────────────────── */}
      {view === "details" && selectedRequest && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Solicitação de cliente</h2>
            <Button variant="ghost" size="icon" onClick={() => { setView("map"); setSelectedRequest(null); }}>
              <X className="size-5" />
            </Button>
          </div>

          {/* Request details */}
          <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between">
              <Badge>{selectedRequest.service_type === "massagem" ? "Massagem" : "Acompanhante"}</Badge>
              <span className="text-xs text-muted-foreground">{selectedRequest.distance_km} km</span>
            </div>
            <p className="font-semibold">{getSubLabel(selectedRequest.service_type, selectedRequest.sub_type)}</p>

            {selectedRequest.flags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedRequest.flags.map((f) => (
                  <span key={f} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                    {serviceFlags.find((x) => x.value === f)?.label ?? f}
                  </span>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>Gênero: {selectedRequest.gender_pref.join(", ")}</span>
              <span>Local pedido: {getLocalLabel(isCarro(selectedRequest.sub_type) ? "carro" : selectedRequest.local_option, "prestador")}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              <Clock className="mr-1 inline size-3" />
              {new Date(selectedRequest.created_at).toLocaleString("pt-BR")}
            </p>
          </div>

          {/* Proposal form */}
          <div className="mt-5 space-y-4">
            <h3 className="text-sm font-semibold">Enviar proposta</h3>

            <div className="space-y-1.5">
              <Label>Seu valor (R$)</Label>
              <Input
                value={proposalPrice}
                onChange={(e) => setProposalPrice(e.target.value)}
                placeholder="300,00"
                inputMode="decimal"
              />
              {providerNet(proposalPrice) && (
                <p className="text-xs text-muted-foreground">
                  Você recebe: <span className="font-semibold text-green-400">R$ {providerNet(proposalPrice)}</span>
                  <span className="ml-1">(valor integral, pago direto pelo cliente — sem comissão)</span>
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Inclua deslocamento e todos os custos — você recebe só o valor combinado, nada por fora.
                {proposalLocal === "parceiro" && " O quarto do parceiro é pago pelo cliente, no local."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Local do atendimento</Label>
              {isCarro(selectedRequest.sub_type) ? (
                <div className="flex items-center gap-2 rounded-xl border border-primary bg-primary/10 p-3 text-xs text-primary">
                  <Car className="size-4" /> No carro — o ponto de encontro é a sua localização
                </div>
              ) : (
                <div className="flex gap-2">
                  {providerLocalOptions.map((opt) => {
                    const semParceiro = opt.value === "parceiro" && quartosPerto === 0;
                    return (
                      <button
                        key={opt.value}
                        disabled={semParceiro}
                        title={semParceiro ? `Nenhum parceiro em ${radius} km` : undefined}
                        onClick={() => setProposalLocal(opt.value)}
                        className={`flex-1 rounded-xl border p-2.5 text-center text-xs font-medium transition-all ${
                          semParceiro ? "cursor-not-allowed border-border opacity-40"
                            : proposalLocal === opt.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Mensagem (opcional)</Label>
              <Textarea
                rows={2}
                value={proposalMessage}
                onChange={(e) => setProposalMessage(e.target.value)}
                placeholder="Estou a 5 min, posso atender agora..."
              />
            </div>

            <Button className="h-12 w-full" disabled={sendingProposal} onClick={handleSendProposal}>
              {sendingProposal ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Send className="mr-2 size-5" />}
              {sendingProposal ? "Enviando..." : "Enviar proposta"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Aviso de perfil incompleto ─────────────────────────── */}
      {view === "map" && needsPhotos && (
        <button onClick={() => setView("perfil")}
          className="fixed inset-x-4 top-[132px] z-20 rounded-xl border border-yellow-500/40 bg-card/95 p-3 text-left text-xs backdrop-blur">
          <span className="font-semibold text-yellow-400">Perfil incompleto:</span>{" "}
          adicione pelo menos {MIN_PHOTOS} fotos ({photoCount}/{MIN_PHOTOS}) para enviar propostas e ofertas. Toque aqui →
        </button>
      )}

      {/* ── Meu perfil (fotos) ─────────────────────────────────── */}
      {view === "perfil" && user && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Meu perfil</h2>
              <p className="text-xs text-muted-foreground">Estas fotos aparecem em todas as suas propostas e ofertas. Troque quando quiser.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => { fetchPhotoCount(); setView("map"); }}><X className="size-5" /></Button>
          </div>
          <div className={`mb-4 rounded-xl border p-3 text-xs ${needsPhotos ? "border-yellow-500/40 bg-yellow-500/5 text-yellow-300" : "border-green-500/30 bg-green-500/5 text-green-400"}`}>
            {needsPhotos
              ? `Mínimo obrigatório: ${MIN_PHOTOS} fotos (você tem ${photoCount}).`
              : "Perfil completo — você já pode propor e ofertar."}
          </div>
          <Button variant="secondary" className="mb-4 w-full" onClick={() => setShowHistory(true)}>
            Histórico de atendimentos
          </Button>

          <div className="mb-5">
            <ProviderStats />
          </div>

          {minhasOfertas.length > 0 && (
            <div className="mb-5 rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 font-semibold">Minhas ofertas publicadas</p>
              <div className="space-y-2">
                {minhasOfertas.map((o) => (
                  <div key={o.offer_id} className={`flex items-center gap-2 rounded-xl border border-border p-2.5 ${o.ativa ? "" : "opacity-50"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {getSubLabel(o.service_type as ServiceType, o.sub_type)} · {brl(o.price)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {getLocalLabel(o.local_option, "prestador")} · {o.ativa ? "no ar" : "pausada"}
                      </p>
                    </div>
                    <Button size="sm" variant="secondary" className="h-8 px-2 text-xs" disabled={acaoOferta === o.offer_id}
                      onClick={() => pausarOferta(o.offer_id, o.ativa)}>
                      {o.ativa ? "Pausar" : "Reativar"}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-destructive" disabled={acaoOferta === o.offer_id}
                      onClick={() => apagarOferta(o.offer_id)}>
                      Apagar
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <PhotoManager userId={user.id} onDone={fetchPhotoCount} />

          <div className="mt-5">
            <ProviderVideoManager userId={user.id} />
          </div>

          {boostProduct && (
            <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-semibold">⚡ {boostProduct.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Seu perfil aparece em destaque nas propostas por {boostProduct.duration_hours}h.</p>
              {boostActive && (
                <p className="mt-2 text-xs font-medium text-green-400">
                  Ativo até {new Date(myPlan!.boost_until!).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              <Button className="mt-3 h-10 w-full" disabled={!myPlan?.can_buy}
                onClick={() => setBoostCheckout({ type: "impulso", code: boostProduct.code, name: boostProduct.name, price: Number(boostProduct.price) })}>
                {!myPlan?.can_buy ? "Disponível em breve" : `${boostActive ? "Somar mais " + boostProduct.duration_hours + "h" : "Impulsionar"} · ${brl(boostProduct.price)}`}
              </Button>
            </div>
          )}
          <Button className="mt-5 h-12 w-full" onClick={() => { fetchPhotoCount(); setView("map"); }}>Concluir</Button>
        </div>
      )}

      {showHistory && <HistorySheet onClose={() => setShowHistory(false)} />}

      {chatProposalId && <ChatPanel proposalId={chatProposalId} onClose={() => setChatProposalId(null)} />}
      {boostCheckout && (
        <CheckoutSheet item={boostCheckout} cardBlocked={!!myPlan?.card_blocked} isAdmin={!!myPlan?.is_admin}
          onClose={() => setBoostCheckout(null)} onPaid={() => refreshPlan()} />
      )}

      {/* ── FAB ─────────────────────────────────────────────────── */}
      {view === "map" && !selectedRequest && (
        <Button size="lg" onClick={() => setView("offer")} className="fixed bottom-6 left-1/2 z-30 h-14 -translate-x-1/2 rounded-full px-7 text-base shadow-glow">
          <Plus className="mr-1 size-5" /> Ofertar Serviço
        </Button>
      )}

      {/* ── Offer bottom sheet ─────────────────────────────────── */}
      {view === "offer" && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ofertar serviço</h2>
            <Button variant="ghost" size="icon" onClick={() => setView("map")}><X className="size-5" /></Button>
          </div>

          <div className="space-y-5">
            {/* Type */}
            <Field label="Tipo de serviço">
              <div className="flex gap-2">
                {(["massagem", "acompanhante"] as ServiceType[]).map((t) => (
                  <Chip key={t} active={offerType === t} onClick={() => setOfferType(t)} className="capitalize">{t}</Chip>
                ))}
              </div>
            </Field>

            {/* Sub-type */}
            {offerType && (
              <Field label={offerType === "massagem" ? "Tipo de massagem" : "Duração / Modalidade"}>
                <div className="flex flex-wrap gap-2">
                  {serviceSubTypes[offerType].map((s) => (
                    <Pill key={s.value} active={offerSubType === s.value} onClick={() => setOfferSubType(s.value)}>{s.label}</Pill>
                  ))}
                </div>
              </Field>
            )}

            {/* Flags (for acompanhante) */}
            {offerType === "acompanhante" && offerSubType && (
              <Field label="Serviços que você oferece">
                <div className="flex flex-wrap gap-2">
                  {serviceFlags.map((f) => (
                    <Pill key={f.value} active={offerFlags.includes(f.value)} onClick={() => toggleFlag(f.value)} showCheck small>
                      {f.label}
                    </Pill>
                  ))}
                </div>
              </Field>
            )}

            {/* Price */}
            {offerSubType && (
              <Field label="Seu valor (R$)">
                <Input
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="250,00"
                  inputMode="decimal"
                />
                {providerNet(offerPrice) && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Você recebe: <span className="font-semibold text-green-400">R$ {providerNet(offerPrice)}</span>
                    <span className="ml-1">(valor integral — sem comissão)</span>
                  </p>
                )}
              </Field>
            )}

            {/* Local */}
            {offerSubType && (
              <Field label="Local">
                {isCarro(offerSubType) ? (
                  <div className="flex items-center gap-2 rounded-xl border border-primary bg-primary/10 p-3 text-xs text-primary">
                    <Car className="size-4" /> No carro — o ponto de encontro é a sua localização
                  </div>
                ) : (
                  <div className="flex gap-2">
                    {providerLocalOptions.filter((opt) => !(opt.value === "parceiro" && quartosPerto === 0)).map((opt) => (
                      <Chip key={opt.value} active={offerLocal === opt.value} onClick={() => setOfferLocal(opt.value)}>
                        {opt.label}
                      </Chip>
                    ))}
                  </div>
                )}
              </Field>
            )}

            {/* Description */}
            {offerSubType && (
              <Field label="Descrição (opcional)">
                <Textarea
                  rows={2}
                  value={offerDesc}
                  onChange={(e) => setOfferDesc(e.target.value)}
                  placeholder="Atendo em apartamento próprio, sigilo total..."
                />
              </Field>
            )}

            {/* Submit */}
            {offerSubType && offerPrice && (
              <Button className="h-13 w-full text-base" disabled={submittingOffer} onClick={handleCreateOffer}>
                {submittingOffer ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}
                {submittingOffer ? "Publicando..." : "Publicar oferta"}
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── UI helpers ────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><p className="text-sm font-semibold">{label}</p>{children}</div>;
}

function Chip({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"} ${className}`}>
      {children}
    </button>
  );
}

function Pill({ active, onClick, children, showCheck = false, small = false }: { active: boolean; onClick: () => void; children: React.ReactNode; showCheck?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full border font-medium transition-all ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
      {showCheck && active && <Check className={small ? "size-3" : "size-3.5"} />}
      {children}
    </button>
  );
}
