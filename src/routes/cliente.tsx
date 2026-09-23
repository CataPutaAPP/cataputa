import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import { MapPin, Plus, X, Navigation, Radar, Sparkles, Eye, Check, Loader2, Star, Home, Users, Clock, Inbox, Bell, Car, Building2, MessageCircle, History } from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { LeafletMap, type MapCoords, type MapMarker } from "@/components/LeafletMap";
import { MatchView, type ActiveService } from "@/components/MatchView";
import { ProviderPhotoStrip, ProviderProfileView } from "@/components/ProviderProfile";
import { RoomPicker, type NearbyRoom } from "@/components/RoomPicker";
import { ChatPanel, useUnreadChats } from "@/components/ChatPanel";
import { OffersSheet } from "@/components/OffersSheet";
import { RadarSheet } from "@/components/RadarSheet";
import { HistorySheet } from "@/components/HistorySheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useMyPlan, featureLimit } from "@/lib/plans";
import { useServiceOptions } from "@/lib/options";
import { playNotificationSound } from "@/lib/notifications";
import {
  type ServiceType, type LocalOption, serviceSubTypes, serviceFlags,
  genderOptions, radiusOptions, localOptions, getSubLabel, getLocalLabel, isCarro,
} from "@/lib/service-options";
import { brl, type ProposalQuote } from "@/lib/fees";
import { useRealtime } from "@/lib/realtime";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Painel do cliente — Privora" },
      { name: "description", content: "Solicite serviços e acompanhe suas solicitações." },
    ],
  }),
  component: () => <DashboardShell role="cliente"><ClienteContent /></DashboardShell>,
});

interface DBRequest {
  id: string;
  service_type: ServiceType;
  sub_type: string;
  flags: string[];
  gender_pref: string[];
  local_option: LocalOption;
  status: string;
  lat: number;
  lng: number;
  room_booking_id: string | null;
  created_at: string;
}

interface DBProposal {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  client_price: number;
  message: string | null;
  local_option: LocalOption;
  status: string;
  created_at: string;
  provider?: {
    full_name: string;
    avatar_url: string | null;
    gender: string | null;
    rating_avg: number;
    rating_count: number;
    has_local: boolean;
  };
}

function ClienteContent() {
  const { user, updateLocation } = useAuth();
  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [view, setView] = useState<"map" | "request" | "proposals" | "match" | "payment" | "room">("map");
  const { plan } = useMyPlan();
  const opcoes = useServiceOptions();
  const [radius, setRadius] = useState(10);
  // o raio máximo vem do plano: grátis 5 km, Pass 10 km, Black 20 km
  const raioMax = featureLimit(plan, "raio_max", 10);
  const raiosDisponiveis = radiusOptions.filter((r) => r.value <= raioMax);
  useEffect(() => { if (radius > raioMax) setRadius(raioMax); }, [raioMax, radius]);

  const [myRequests, setMyRequests] = useState<DBRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<DBProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [payingProposal, setPayingProposal] = useState<DBProposal | null>(null);
  const [quote, setQuote] = useState<ProposalQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [pickingRoomFor, setPickingRoomFor] = useState<DBProposal | null>(null);
  const [bookedRoom, setBookedRoom] = useState<NearbyRoom | null>(null);
  const [chatProposalId, setChatProposalId] = useState<string | null>(null);
  const [showOffers, setShowOffers] = useState(false);
  const [showRadar, setShowRadar] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);

  async function cancelarChamado(id: string) {
    if (!window.confirm("Cancelar este chamado? As propostas recebidas serão encerradas.")) return;
    setCancelandoId(id);
    const { error } = await supabase.rpc("cancel_request", { p_request_id: id, p_reason: null });
    setCancelandoId(null);
    if (error) return toast.error(error.message);
    toast.success("Chamado cancelado.");
    if (selectedRequestId === id) { setSelectedRequestId(null); setView("map"); }
    fetchMyRequests();
  }
  const [quartosPerto, setQuartosPerto] = useState<number | null>(null);
  useEffect(() => {
    if (!coords) return;
    supabase.rpc("nearby_partner_rooms", { p_lat: coords.lat, p_lng: coords.lng, p_radius_km: radius })
      .then(({ data }) => setQuartosPerto(((data as unknown[]) ?? []).length));
  }, [coords, radius]);
  const { counts: unread } = useUnreadChats(user?.id);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const providerKey = proposals.map((p) => p.provider_id).join(",");
  useEffect(() => {
    const ids = [...new Set(proposals.map((p) => p.provider_id))];
    if (!ids.length) { setHighlighted(new Set()); return; }
    supabase.rpc("highlighted_providers", { p_ids: ids }).then(({ data }) => setHighlighted(new Set((data as string[]) ?? [])));
  }, [providerKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const sortedProposals = [...proposals].sort((a, b) => Number(highlighted.has(b.provider_id)) - Number(highlighted.has(a.provider_id)));
  const prevProposalCount = useRef(0);

  const [activeService, setActiveService] = useState<ActiveService | null>(null);

  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [subType, setSubType] = useState("");
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [localChoice, setLocalChoice] = useState<LocalOption | "">("");
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleCoordsChange = useCallback((c: MapCoords) => {
    setCoords(c);
    if (user) updateLocation(c.lat, c.lng);
  }, [user, updateLocation]);

  // Fetch active service (aceita / a_caminho / em_andamento)
  const activeIdRef = useRef<string | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // Cada resposta revela o proximo campo logo abaixo da dobra. Sem isto o
  // usuario toca numa opcao, nada aparece na tela e o formulario parece travado.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const t = setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }), 120);
    return () => clearTimeout(t);
  }, [serviceType, subType, selectedFlags.length, localChoice, selectedGenders.length]);
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
            .eq("client_id", user.id)
            .in("status", ["aceita", "a_caminho", "em_andamento"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
      if (error) { console.error("fetchActiveService", error); setActiveService(null); return; }
      if (data) {
        const [{ data: prop }, { data: prov }] = await Promise.all([
          data.accepted_proposal_id
            ? supabase.from("proposals").select("price, client_price, message, local_option").eq("id", data.accepted_proposal_id).single()
            : Promise.resolve({ data: null }),
          data.accepted_provider_id
            ? supabase.from("profiles").select("full_name, avatar_url, gender, rating_avg, rating_count, has_local").eq("id", data.accepted_provider_id).single()
            : Promise.resolve({ data: null }),
        ]);
        const svc = { ...data, proposal: prop ?? undefined, provider: prov ?? undefined } as ActiveService;
        activeIdRef.current = svc.id;
        setActiveService(svc);
        setView("match" as any);
      } else {
        activeIdRef.current = null;
        setActiveService(null);
      }
    } catch (e) {
      console.error("fetchActiveService catch", e);
      setActiveService(null);
    }
  }, [user]);

  const fetchMyRequests = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("service_requests").select("*")
      .eq("client_id", user.id)
      .in("status", ["aberta", "com_propostas", "aceita", "em_andamento"])
      .order("created_at", { ascending: false }).limit(20);
    if (data) {
      const prev = myRequests;
      setMyRequests(data as DBRequest[]);
      const newP = (data as DBRequest[]).filter(r => r.status === "com_propostas").length;
      const oldP = prev.filter(r => r.status === "com_propostas").length;
      if (newP > oldP) { playNotificationSound("proposal"); toast("Nova proposta recebida!", { icon: "🔔" }); }
    }
  }, [user, myRequests]);

  const fetchProposals = useCallback(async (requestId: string) => {
    setLoadingProposals(true);
    const { data } = await supabase
      .from("proposals")
      .select("id, request_id, provider_id, price, client_price, message, local_option, status, created_at, provider:profiles!provider_id(full_name, avatar_url, gender, rating_avg, rating_count, has_local)")
      .eq("request_id", requestId)
      .order("created_at", { ascending: false });
    if (data) {
      if (data.length > prevProposalCount.current && prevProposalCount.current > 0) playNotificationSound("proposal");
      prevProposalCount.current = data.length;
      setProposals(data as DBProposal[]);
    }
    setLoadingProposals(false);
  }, []);

  useEffect(() => {
    if (!user || !coords) return;
    fetchMyRequests();
    fetchActiveService();
  }, [user, coords, fetchActiveService]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tempo real: meus chamados e as propostas que chegam neles
  useRealtime(
    `cliente-${user?.id ?? "anon"}`,
    [{ table: "service_requests", filter: `client_id=eq.${user?.id}` }],
    () => { fetchMyRequests(); fetchActiveService(); },
    { enabled: !!user },
  );
  useRealtime(
    `propostas-${selectedRequestId ?? "none"}`,
    [{ table: "proposals", filter: `request_id=eq.${selectedRequestId}` }],
    () => { if (selectedRequestId) fetchProposals(selectedRequestId); },
    { enabled: !!selectedRequestId },
  );

  useEffect(() => { setSubType(""); setSelectedFlags([]); setLocalChoice(""); setSelectedGenders([]); }, [serviceType]);
  useEffect(() => { setSelectedFlags([]); setLocalChoice(""); setSelectedGenders([]); }, [subType]);
  useEffect(() => { setSelectedGenders([]); }, [localChoice]);
  // "No carro": local é sempre 'carro' — ponto de encontro = localização do prestador
  useEffect(() => { if (isCarro(subType)) setLocalChoice("carro"); }, [subType]);

  function toggleArr(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }
  function resetForm() { setServiceType(""); setSubType(""); setSelectedFlags([]); setLocalChoice(""); setSelectedGenders([]); }
  const showFlags = serviceType === "acompanhante" && !!subType;
  const flagsComplete = serviceType === "massagem" ? !!subType : selectedFlags.length > 0;

  async function handleSubmit() {
    if (!serviceType || !subType) return toast.error("Selecione tipo e subtipo.");
    if (serviceType === "acompanhante" && selectedFlags.length === 0) return toast.error("Selecione ao menos um serviço.");
    if (!localChoice) return toast.error("Selecione onde será o atendimento.");
    if (selectedGenders.length === 0) return toast.error("Selecione ao menos um gênero.");
    if (!user || !coords) return toast.error("Localização não disponível.");
    // P4: Verificar lock
    const { data: locked } = await supabase.rpc("is_user_locked", { p_user_id: user.id });
    if (locked) return toast.error("Você já está em um atendimento ativo. Conclua antes de solicitar outro.");
    setSubmitting(true);
    const { error } = await supabase.from("service_requests").insert({
      client_id: user.id, service_type: serviceType, sub_type: subType,
      flags: serviceType === "acompanhante" ? selectedFlags : [],
      gender_pref: selectedGenders, local_option: localChoice,
      duration: serviceType && opcoes.detalheDoTipo(serviceType) === "duracao" ? subType : null,
      radius_km: radius, lat: coords.lat, lng: coords.lng,
    });
    setSubmitting(false);
    if (error) { toast.error("Erro ao criar solicitação."); console.error(error); return; }
    playNotificationSound("message");
    toast.success("Solicitação criada! Prestadores próximos serão notificados.");
    resetForm(); setView("map"); fetchMyRequests();
  }

  const selectedRequest = myRequests.find((r) => r.id === selectedRequestId) ?? null;

  async function openPayment(proposal: DBProposal) {
    setPayingProposal(proposal);
    setQuote(null);
    setView("payment" as any);
    setLoadingQuote(true);
    const { data, error } = await supabase.rpc("quote_proposal", { p_proposal_id: proposal.id });
    setLoadingQuote(false);
    if (error || !data) {
      console.error("quote_proposal", error);
      toast.error("Não foi possível carregar a proposta. Tente novamente.");
      setPayingProposal(null); setView("proposals");
      return;
    }
    setQuote(data as ProposalQuote);
  }

  async function handleAcceptProposal(proposalId: string) {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;
    // Parceiro: é obrigatório escolher o quarto ANTES de pagar
    if (proposal.local_option === "parceiro") {
      setPickingRoomFor(proposal);
      setView("room" as any);
      return;
    }
    openPayment(proposal);
  }

  async function handleOfferAccepted({ request_id, proposal_id }: { request_id: string; proposal_id: string }) {
    setShowOffers(false);
    setSelectedRequestId(request_id);
    await fetchProposals(request_id);
    const { data } = await supabase
      .from("proposals")
      .select("id, request_id, provider_id, price, client_price, message, local_option, status, created_at, provider:profiles!provider_id(full_name, avatar_url, gender, rating_avg, rating_count, has_local)")
      .eq("id", proposal_id).single();
    if (!data) { toast.error("Não foi possível abrir a oferta."); return; }
    const proposal = { ...data, provider: Array.isArray(data.provider) ? data.provider[0] : data.provider } as unknown as DBProposal;
    fetchMyRequests();
    if (proposal.local_option === "parceiro") { setPickingRoomFor(proposal); setView("room" as any); return; }
    openPayment(proposal);
  }

  function handleRoomBooked(room: NearbyRoom) {
    setBookedRoom(room);
    const proposal = pickingRoomFor;
    setPickingRoomFor(null);
    fetchMyRequests();
    if (proposal) openPayment(proposal);
  }

  async function handlePaymentConfirmed() {
    if (!payingProposal) return;
    setAcceptingId(payingProposal.id);
    // After payment confirmed, mark proposal as accepted
    const { error } = await supabase.from("proposals").update({ status: "aceita" }).eq("id", payingProposal.id);
    setAcceptingId(null);
    if (error) { toast.error("Erro ao processar. Tente novamente."); return; }
    playNotificationSound("accepted");
    toast.success("Atendimento confirmado! O prestador foi notificado.");
    setPayingProposal(null);
    setQuote(null);
    setBookedRoom(null);
    if (selectedRequestId) fetchProposals(selectedRequestId);
    fetchMyRequests();
    await fetchActiveService();
    setView("match" as any);
  }

  function statusLabel(s: string) {
    switch (s) {
      case "aberta": return { text: "Aberta", cls: "" };
      case "com_propostas": return { text: "Com propostas!", cls: "bg-primary/20 text-primary animate-pulse" };
      case "aceita": return { text: "Aceita", cls: "bg-green-500/20 text-green-400" };
      case "a_caminho": return { text: "A caminho", cls: "bg-green-500/20 text-green-400" };
      case "em_andamento": return { text: "Em andamento", cls: "bg-yellow-500/20 text-yellow-400" };
      default: return { text: s, cls: "" };
    }
  }

  return (
    <main className="relative min-h-screen" style={{ background: "#0a0a12" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <LeafletMap onCoordsChange={handleCoordsChange} markers={[]} radiusKm={radius} />
      </div>

      <div className="fixed inset-x-0 top-[76px] z-20 flex items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-md">
          <Radar className="size-3.5 text-primary" />
          {raiosDisponiveis.map((r) => (
            <button key={r.value} onClick={() => setRadius(r.value)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${radius === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{r.label}</button>
          ))}
        </div>
        <button onClick={() => setShowHistory(true)} aria-label="Histórico"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-md hover:bg-secondary">
          <History className="size-4" />
        </button>
        {coords && (
          <button onClick={() => setShowRadar(true)} aria-label="Quem está online"
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-md hover:bg-secondary">
            <Radar className="size-4 text-primary" />
          </button>
        )}
        {coords && (
          <button onClick={() => window.dispatchEvent(new CustomEvent("map:center"))} className="flex size-9 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-md hover:bg-secondary">
            <Navigation className="size-4 text-primary" />
          </button>
        )}
      </div>

      {view === "map" && myRequests.length > 0 && (
        <div className="fixed inset-x-4 bottom-24 z-20 max-h-60 space-y-2 overflow-y-auto">
          {myRequests.map((r) => {
            const st = statusLabel(r.status);
            return (
              <button key={r.id} onClick={() => { setSelectedRequestId(r.id); fetchProposals(r.id); setView("proposals"); }}
                className="w-full rounded-xl border border-border bg-card/90 p-4 text-left backdrop-blur-sm transition-all hover:bg-card active:scale-[0.98]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{getSubLabel(r.service_type, r.sub_type)}</p>
                    <Badge variant="secondary" className="text-[10px]">{r.service_type === "massagem" ? "Massagem" : "Acompanhante"}</Badge>
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${st.cls}`}>
                    {r.status === "com_propostas" && <Bell className="mr-1 inline size-3" />}{st.text}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.gender_pref.join(", ")} · {getLocalLabel(r.local_option)}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-primary">Toque para ver propostas →</p>
                  {["aberta", "com_propostas"].includes(r.status) && (
                    <span role="button" tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); cancelarChamado(r.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); cancelarChamado(r.id); } }}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:border-destructive hover:text-destructive">
                      {cancelandoId === r.id ? "Cancelando…" : "Cancelar"}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {view === "proposals" && (
        <div className="fixed inset-x-0 bottom-0 top-[76px] z-30 overflow-y-auto bg-background/95 px-4 pb-8 pt-4 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Propostas recebidas</h2>
            {selectedRequest && ["aberta", "com_propostas"].includes(selectedRequest.status) && (
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
                disabled={cancelandoId === selectedRequest.id}
                onClick={() => cancelarChamado(selectedRequest.id)}>
                Cancelar chamado
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => { setView("map"); setSelectedRequestId(null); prevProposalCount.current = 0; }}><X className="size-5" /></Button>
          </div>
          {loadingProposals ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-primary" /></div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Inbox className="size-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma proposta ainda. Aguarde.</p>
              <Button variant="secondary" size="sm" onClick={() => { if (selectedRequestId) fetchProposals(selectedRequestId); }}>Atualizar</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedProposals.map((p) => {
                const accepted = p.status === "aceita";
                const refused = p.status === "recusada";
                return (
                  <article key={p.id} className={`rounded-2xl border bg-card p-4 ${accepted ? "border-green-500/40" : refused ? "opacity-50 border-border" : "border-border"}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent"><Sparkles className="size-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setViewingProfileId(p.provider_id)} className="truncate font-semibold text-left hover:text-primary transition-colors">
                            {p.provider?.full_name ?? "Prestador"}
                          </button>
                          {p.provider?.has_local && <span className="flex items-center gap-0.5 text-[10px] text-primary"><Home className="size-3" /> Local</span>}
                          {highlighted.has(p.provider_id) && <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">⚡ Destaque</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" /> {Number(p.provider?.rating_avg ?? 0).toFixed(1)}</span>
                          <span>{p.provider?.gender}</span>
                        </div>
                      </div>
                      {/* Cliente vê APENAS o valor total — sem breakdown */}
                      <p className="text-xl font-bold text-primary">{brl(p.price)}</p>
                    </div>
                    <ProviderPhotoStrip providerId={p.provider_id} onClick={() => setViewingProfileId(p.provider_id)} />
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {p.local_option === "parceiro" ? <Building2 className="size-3.5" /> : p.local_option === "carro" ? <Car className="size-3.5" /> : <Home className="size-3.5" />}
                      <span>{getLocalLabel(p.local_option)}</span>
                      {p.local_option === "parceiro" && <span className="text-[10px]">· quarto escolhido por você, somado ao total</span>}
                    </div>
                    {p.message && <p className="mt-2 rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground italic">"{p.message}"</p>}
                    <p className="mt-2 text-[10px] text-muted-foreground"><Clock className="mr-1 inline size-3" />{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                    {p.status !== "recusada" && (
                      <Button variant="secondary" className="mt-3 h-9 w-full" onClick={() => setChatProposalId(p.id)}>
                        <MessageCircle className="mr-2 size-4" /> Conversar
                        {unread[p.id] ? <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread[p.id]}</span> : null}
                      </Button>
                    )}
                    {p.status === "pendente" && (
                      <Button className="mt-2 h-10 w-full" disabled={acceptingId === p.id} onClick={() => handleAcceptProposal(p.id)}>
                        {acceptingId === p.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                        {acceptingId === p.id ? "Processando..." : p.local_option === "parceiro" ? "Escolher quarto e aceitar" : `Aceitar · ${brl(p.price)}`}
                      </Button>
                    )}
                    {accepted && <div className="mt-3 rounded-lg bg-green-500/10 p-2.5 text-center text-sm font-medium text-green-400">✓ Proposta aceita</div>}
                    {refused && <div className="mt-3 rounded-lg bg-secondary p-2.5 text-center text-xs text-muted-foreground">Expirada</div>}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Match / Service view ───────────────────────────── */}
      {view === "match" && activeService && user && (
        <MatchView
          service={activeService}
          role="cliente"
          userId={user.id}
          onClose={() => { activeIdRef.current = null; setView("map"); setActiveService(null); }}
          onRefresh={fetchActiveService}
        />
      )}

      {view === "map" && (
        <>
          {/* Show active service card if exists */}
          {activeService && ["aceita", "a_caminho", "em_andamento"].includes(activeService.status) && (
            <button onClick={() => setView("match")}
              className="fixed inset-x-4 bottom-24 z-20 rounded-xl border border-primary/40 bg-card/90 p-4 text-left backdrop-blur-sm animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <p className="text-sm font-semibold">Atendimento em andamento</p>
                </div>
                <Badge variant="secondary" className="bg-green-500/20 text-green-400 text-[10px]">
                  {activeService.status === "aceita" ? "Aceito" : activeService.status === "a_caminho" ? "A caminho" : "Em andamento"}
                </Badge>
              </div>
              <p className="mt-1.5 text-xs font-medium text-primary">Toque para acompanhar →</p>
            </button>
          )}
          <div className="fixed inset-x-0 bottom-6 z-30 flex items-center justify-center gap-2 px-4">
            <Button size="lg" onClick={() => setView("request")} className="h-14 rounded-full px-6 text-base shadow-glow">
              <Plus className="mr-1 size-5" /> Solicitar
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setShowOffers(true)} className="h-14 rounded-full px-6 text-base">
              <Sparkles className="mr-1 size-5" /> Ver ofertas
            </Button>
          </div>
        </>
      )}

      {view === "request" && (
        <div ref={sheetRef} className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nova solicitação</h2>
            <Button variant="ghost" size="icon" onClick={() => { setView("map"); resetForm(); }}><X className="size-5" /></Button>
          </div>
          <div className="space-y-5">
            <Field label="Raio de busca">
              <div className="flex flex-wrap gap-2">
                {radiusOptions.map((r) => {
                  const bloqueado = r.value > raioMax;
                  return (
                    <Chip key={r.value} active={radius === r.value}
                      onClick={() => { if (bloqueado) { toast("Raio maior faz parte do Pass Black.", { icon: "👑" }); return; } setRadius(r.value); }}>
                      {bloqueado ? `${r.label} 🔒` : r.label}
                    </Chip>
                  );
                })}
              </div>
            </Field>
            <Field label="Tipo de serviço">
              <div className="flex flex-wrap gap-2">
                {opcoes.tipos.map((t) => (
                  <Chip key={t.value} active={serviceType === t.value}
                    onClick={() => { setServiceType(t.value as ServiceType); setSubType(""); }}>
                    {t.label}
                  </Chip>
                ))}
              </div>
            </Field>
            {serviceType && opcoes.detalheDoTipo(serviceType) !== "nenhum" && (
              <Field label={opcoes.detalheDoTipo(serviceType) === "estilo" ? "Tipo de massagem" : "Duração"}>
                <div className="flex flex-wrap gap-2">
                  {(opcoes.detalheDoTipo(serviceType) === "estilo" ? opcoes.estilos : opcoes.duracoes(serviceType))
                    .map((s) => (
                      <Pill key={s.value} active={subType === s.value} onClick={() => setSubType(s.value)}>
                        {s.label}
                      </Pill>
                    ))}
                </div>
              </Field>
            )}
            {showFlags && (<Field label="O que você procura"><p className="mb-2 text-xs text-muted-foreground">Selecione os serviços desejados</p><div className="flex flex-wrap gap-2">{opcoes.praticas.map((f) => (<Pill key={f.value} active={selectedFlags.includes(f.value)} onClick={() => toggleArr(selectedFlags, setSelectedFlags, f.value)} showCheck small>{f.label}</Pill>))}</div></Field>)}
            {flagsComplete && isCarro(subType) && (<Field label="Local do atendimento"><div className="flex items-center gap-3 rounded-xl border border-primary bg-primary/10 p-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Car className="size-5" /></div><div className="flex-1"><p className="text-sm font-medium text-primary">No carro</p><p className="text-xs text-muted-foreground">O ponto de encontro é a localização do prestador</p></div><Check className="size-5 text-primary" /></div></Field>)}
            {flagsComplete && !isCarro(subType) && (<Field label="Local do atendimento"><div className="space-y-2">{localOptions.map((opt) => {
              const semParceiro = opt.value === "parceiro" && quartosPerto === 0;
              const active = localChoice === opt.value;
              const Icon = opt.value === "parceiro" ? Building2 : opt.value === "local_cliente" ? Home : Users;
              const desc = opt.value === "parceiro"
                ? (quartosPerto === null ? opt.desc
                   : semParceiro ? `Nenhum parceiro em ${radius} km ainda — aumente o raio ou escolha outro local`
                   : `${quartosPerto} ${quartosPerto === 1 ? "quarto disponível" : "quartos disponíveis"} em até ${radius} km`)
                : opt.desc;
              return (
                <button key={opt.value} disabled={semParceiro} onClick={() => setLocalChoice(opt.value)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    semParceiro ? "cursor-not-allowed border-border opacity-45"
                    : active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}>
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}><Icon className="size-5" /></div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  {active && <Check className="size-5 text-primary" />}
                </button>
              );
            })}</div></Field>)}
            {localChoice && flagsComplete && (<Field label="Preferência de gênero"><p className="mb-2 text-xs text-muted-foreground">Selecione um ou mais</p><div className="flex flex-wrap gap-2">{opcoes.generos.map((g) => (<Pill key={g.value} active={selectedGenders.includes(g.value)} onClick={() => toggleArr(selectedGenders, setSelectedGenders, g.value)} showCheck>{g.label}</Pill>))}</div></Field>)}
            {selectedGenders.length > 0 && (<Button className="h-13 w-full text-base" disabled={submitting} onClick={handleSubmit}>{submitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}{submitting ? "Enviando..." : "Solicitar atendimento"}</Button>)}
          </div>
        </div>
      )}
      {/* ── Payment screen (PIX) ──────────────────────────────── */}
      {(view as string) === "payment" && payingProposal && (
        <div className="fixed inset-x-0 bottom-0 top-[76px] z-40 overflow-y-auto bg-background/98 px-4 pb-8 pt-6 backdrop-blur-md">
          <div className="mx-auto max-w-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Confirmar atendimento</h2>
              <Button variant="ghost" size="icon" onClick={() => { setPayingProposal(null); setQuote(null); setView("proposals"); }}>
                <X className="size-5" />
              </Button>
            </div>

            {/* Resumo — valores pagos direto ao prestador e ao parceiro */}
            <div className="mb-5 rounded-2xl border border-border bg-card p-5">
              {loadingQuote || !quote ? (
                <div className="flex justify-center py-6"><Loader2 className="size-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Valor combinado</p>
                  <p className="mt-1 text-3xl font-bold text-primary">{brl(quote.client_total)}</p>
                  <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Atendimento · pago ao prestador</span>
                      <span>{brl(quote.service_price)}</span>
                    </div>
                    {Number(quote.room_price) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quarto{bookedRoom ? ` · ${bookedRoom.room_name}` : ""} · pago no local</span>
                        <span>{brl(quote.room_price)}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Prestador: {payingProposal.provider?.full_name ?? "—"}</p>
                    {selectedRequest && <p>Serviço: {getSubLabel(selectedRequest.service_type, selectedRequest.sub_type)} · {getLocalLabel(payingProposal.local_option)}</p>}
                    {bookedRoom && <p>Local: {bookedRoom.partner_name ?? "Parceiro"}{bookedRoom.local_address ? ` — ${bookedRoom.local_address}` : ""}</p>}
                  </div>
                </>
              )}
            </div>

            {/* Pagamento direto */}
            <div className="mb-5 rounded-2xl border border-border bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="mb-1 font-semibold text-foreground">Como funciona o pagamento</p>
              Você paga o atendimento direto ao prestador, como combinarem. O quarto de parceiro é pago no próprio estabelecimento.
              A Privora não recebe nenhuma parte desses valores. Cancelamentos ficam registrados na sua reputação.
            </div>

            <Button
              className="h-14 w-full bg-green-600 text-base text-white hover:bg-green-700"
              disabled={!!acceptingId || !quote}
              onClick={handlePaymentConfirmed}
            >
              {acceptingId ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Check className="mr-2 size-5" />}
              {acceptingId ? "Confirmando..." : "Confirmar atendimento"}
            </Button>

            <Button variant="ghost" className="mt-2 h-10 w-full text-sm text-muted-foreground"
              onClick={() => { setPayingProposal(null); setQuote(null); setView("proposals"); }}>
              Voltar às propostas
            </Button>
          </div>
        </div>
      )}

      {/* ── Escolha de quarto (parceiro) ───────────────────────── */}
      {(view as string) === "room" && pickingRoomFor && selectedRequest && (
        <RoomPicker
          requestId={selectedRequest.id}
          lat={selectedRequest.lat}
          lng={selectedRequest.lng}
          onClose={() => { setPickingRoomFor(null); setView("proposals"); }}
          onBooked={handleRoomBooked}
        />
      )}

      {showHistory && (
        <HistorySheet onClose={() => setShowHistory(false)} onViewProfile={(id) => { setShowHistory(false); setViewingProfileId(id); }} />
      )}

      {showRadar && coords && (
        <RadarSheet
          lat={coords.lat} lng={coords.lng} radius={radius}
          onClose={() => setShowRadar(false)}
          onViewProfile={(id) => setViewingProfileId(id)}
          onSeeOffers={() => { setShowRadar(false); setShowOffers(true); }}
        />
      )}

      {showOffers && coords && (
        <OffersSheet
          lat={coords.lat} lng={coords.lng} radius={radius}
          onClose={() => setShowOffers(false)}
          onAccepted={handleOfferAccepted}
          onViewProfile={(id) => setViewingProfileId(id)}
        />
      )}

      {chatProposalId && <ChatPanel proposalId={chatProposalId} onClose={() => setChatProposalId(null)} />}

      {/* Provider profile overlay */}
      {viewingProfileId && (
        <ProviderProfileView providerId={viewingProfileId} onClose={() => setViewingProfileId(null)} />
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><p className="text-sm font-semibold">{label}</p>{children}</div>; }
function Chip({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) { return <button onClick={onClick} className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"} ${className}`}>{children}</button>; }
function Pill({ active, onClick, children, showCheck = false, small = false }: { active: boolean; onClick: () => void; children: React.ReactNode; showCheck?: boolean; small?: boolean }) { return <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full border font-medium transition-all ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>{showCheck && active && <Check className={small ? "size-3" : "size-3.5"} />}{children}</button>; }
