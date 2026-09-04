import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { LeafletMap, type MapCoords, type MapMarker } from "@/components/LeafletMap";
import { MatchView, type ActiveService } from "@/components/MatchView";
import { PhotoManager } from "@/components/ProviderProfile";
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
  localOptions,
  getSubLabel,
} from "@/lib/service-options";

export const Route = createFileRoute("/prestador")({
  head: () => ({
    meta: [
      { title: "Painel do prestador — ServiHub" },
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
  const [view, setView] = useState<"map" | "offer" | "details" | "match">("map");
  const [radius, setRadius] = useState(10);
  const [available, setAvailable] = useState(true);

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
  const fetchActiveService = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("service_requests")
      .select(`
        *,
        proposal:proposals!accepted_proposal_id(price, client_price, message, local_option),
        client:profiles!client_id(full_name, avatar_url, gender, rating_avg, rating_count)
      `)
      .eq("accepted_provider_id", user.id)
      .in("status", ["aceita", "a_caminho", "em_andamento", "concluida"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const svc = {
        ...data,
        proposal: Array.isArray(data.proposal) ? data.proposal[0] : data.proposal,
        client: Array.isArray(data.client) ? data.client[0] : data.client,
      } as ActiveService;
      setActiveService(svc);
      if (["aceita", "a_caminho", "em_andamento"].includes(svc.status)) {
        setView("match");
      }
    } else {
      setActiveService(null);
    }
  }, [user]);

  // Poll for requests every 15s
  useEffect(() => {
    if (!coords || !available) return;
    fetchRequests();
    fetchMyProposals();
    fetchActiveService();
    const interval = setInterval(() => {
      fetchRequests();
      fetchMyProposals();
    }, 15000);
    return () => clearInterval(interval);
  }, [coords, available, fetchRequests, fetchMyProposals, fetchActiveService]);

  // Reset offer form when type changes
  useEffect(() => { setOfferSubType(""); setOfferFlags([]); }, [offerType]);

  // Map markers from client requests
  const mapMarkers: MapMarker[] = requests.map((r) => ({
    id: r.id,
    lat: r.lat,
    lng: r.lng,
    color: r.service_type === "massagem" ? "#22c55e" : "#eab308",
    size: 14,
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

    toast.success(`Proposta enviada! Você recebe R$ ${(price * 0.93).toFixed(2)} se aceita.`);
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

    toast.success(`Oferta publicada! Você recebe R$ ${(price * 0.93).toFixed(2)} por atendimento.`);
    setOfferType("");
    setOfferSubType("");
    setOfferFlags([]);
    setOfferPrice("");
    setOfferDesc("");
    setView("map");
  }

  const providerNet = (val: string) => {
    const n = parseFloat(val.replace(",", "."));
    return isNaN(n) || n <= 0 ? null : (n * 0.93).toFixed(2);
  };

  return (
    <main className="relative min-h-screen" style={{ background: "#0a0a12" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <LeafletMap onCoordsChange={handleCoordsChange} markers={mapMarkers} radiusKm={radius} />
      </div>

      {/* ── Top controls ───────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-[60px] z-20 flex items-center gap-2 px-4 py-3">
        {/* Availability toggle */}
        <div className="flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-md">
          <div className={`size-2 rounded-full ${available ? "bg-green-500" : "bg-red-500"}`} />
          <span className="text-xs font-medium">{available ? "Online" : "Offline"}</span>
          <Switch checked={available} onCheckedChange={setAvailable} className="scale-75" />
        </div>

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
        <div className="fixed left-4 top-[116px] z-20">
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

      {/* ── My proposals (floating cards) — only when no active service ── */}
      {view === "map" && myProposals.length > 0 && !selectedRequest && !activeService && (
        <div className="fixed inset-x-4 bottom-24 z-20 max-h-40 space-y-2 overflow-y-auto">
          {myProposals.slice(0, 2).map((p) => {
            const isAccepted = p.status === "aceita";
            return (
              <div key={p.id} onClick={isAccepted ? () => fetchActiveService() : undefined}
                className={`rounded-xl border bg-card/90 p-3 backdrop-blur-sm ${isAccepted ? "border-green-500/40 cursor-pointer" : "border-border"}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Proposta R$ {Number(p.price).toFixed(2)}</p>
                  <Badge variant="secondary" className={`text-[10px] ${isAccepted ? "bg-green-500/20 text-green-400" : ""}`}>
                    {p.status === "pendente" ? "Aguardando" : isAccepted ? "Aceita! Toque →" : p.status}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Você recebe R$ {(Number(p.price) * 0.93).toFixed(2)}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Match / Service view ───────────────────────────── */}
      {view === "match" && activeService && user && (
        <MatchView
          service={activeService}
          role="prestador"
          userId={user.id}
          onClose={() => { setView("map"); setActiveService(null); }}
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
              <span>Local: {selectedRequest.local_option === "local_atendente" ? "Atendente" : "Parceiro"}</span>
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
                  <span className="ml-1">(após comissão da plataforma)</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Local do atendimento</Label>
              <div className="flex gap-2">
                {localOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setProposalLocal(opt.value)}
                    className={`flex-1 rounded-xl border p-2.5 text-center text-xs font-medium transition-all ${
                      proposalLocal === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {opt.value === "local_atendente" ? "Tenho local" : "Usar parceiro"}
                  </button>
                ))}
              </div>
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
                    <span className="ml-1">(após comissão)</span>
                  </p>
                )}
              </Field>
            )}

            {/* Local */}
            {offerSubType && (
              <Field label="Local">
                <div className="flex gap-2">
                  {localOptions.map((opt) => (
                    <Chip key={opt.value} active={offerLocal === opt.value} onClick={() => setOfferLocal(opt.value)}>
                      {opt.value === "local_atendente" ? "Tenho local" : "Parceiro"}
                    </Chip>
                  ))}
                </div>
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

            {/* Photos */}
            {offerSubType && user && (
              <div className="rounded-xl border border-border bg-secondary/30 p-4">
                <PhotoManager userId={user.id} onDone={() => {}} />
              </div>
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
