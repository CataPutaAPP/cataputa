import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  MapPin, Plus, X, Navigation, Radar, Sparkles, Eye, Check,
  Loader2, Star, Home, Users, Clock, Inbox, Bell,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { LeafletMap, type MapCoords, type MapMarker } from "@/components/LeafletMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { playNotificationSound } from "@/lib/notifications";
import {
  type ServiceType, type LocalOption, serviceSubTypes, serviceFlags,
  genderOptions, radiusOptions, localOptions, getSubLabel,
} from "@/lib/service-options";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Painel do cliente — CataPuta Web" },
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
  created_at: string;
}

interface DBProposal {
  id: string;
  request_id: string;
  provider_id: string;
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
  const [view, setView] = useState<"map" | "request" | "proposals">("map");
  const [radius, setRadius] = useState(10);

  const [myRequests, setMyRequests] = useState<DBRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<DBProposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const prevProposalCount = useRef(0);

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
      .select("id, request_id, provider_id, client_price, message, local_option, status, created_at, provider:profiles!provider_id(full_name, avatar_url, gender, rating_avg, rating_count, has_local)")
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
    const interval = setInterval(() => {
      fetchMyRequests();
      if (selectedRequestId) fetchProposals(selectedRequestId);
    }, 8000);
    return () => clearInterval(interval);
  }, [user, coords, selectedRequestId]);

  useEffect(() => { setSubType(""); setSelectedFlags([]); setLocalChoice(""); setSelectedGenders([]); }, [serviceType]);
  useEffect(() => { setSelectedFlags([]); setLocalChoice(""); setSelectedGenders([]); }, [subType]);
  useEffect(() => { setSelectedGenders([]); }, [localChoice]);

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
    setSubmitting(true);
    const { error } = await supabase.from("service_requests").insert({
      client_id: user.id, service_type: serviceType, sub_type: subType,
      flags: serviceType === "acompanhante" ? selectedFlags : [],
      gender_pref: selectedGenders, local_option: localChoice,
      radius_km: radius, lat: coords.lat, lng: coords.lng,
    });
    setSubmitting(false);
    if (error) { toast.error("Erro ao criar solicitação."); console.error(error); return; }
    playNotificationSound("message");
    toast.success("Solicitação criada! Prestadores próximos serão notificados.");
    resetForm(); setView("map"); fetchMyRequests();
  }

  async function handleAcceptProposal(proposalId: string) {
    setAcceptingId(proposalId);
    const { error } = await supabase.from("proposals").update({ status: "aceita" }).eq("id", proposalId);
    setAcceptingId(null);
    if (error) { toast.error("Erro ao aceitar proposta."); return; }
    playNotificationSound("accepted");
    toast.success("Proposta aceita! O prestador foi notificado.");
    if (selectedRequestId) fetchProposals(selectedRequestId);
    fetchMyRequests();
  }

  function statusLabel(s: string) {
    switch (s) {
      case "aberta": return { text: "Aberta", cls: "" };
      case "com_propostas": return { text: "Com propostas!", cls: "bg-primary/20 text-primary animate-pulse" };
      case "aceita": return { text: "Aceita", cls: "bg-green-500/20 text-green-400" };
      case "em_andamento": return { text: "Em andamento", cls: "bg-yellow-500/20 text-yellow-400" };
      default: return { text: s, cls: "" };
    }
  }

  return (
    <main className="relative min-h-screen" style={{ background: "#0a0a12" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <LeafletMap onCoordsChange={handleCoordsChange} markers={[]} radiusKm={radius} />
      </div>

      <div className="fixed inset-x-0 top-[60px] z-20 flex items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-md">
          <Radar className="size-3.5 text-primary" />
          {radiusOptions.map((r) => (
            <button key={r.value} onClick={() => setRadius(r.value)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${radius === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{r.label}</button>
          ))}
        </div>
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
                <p className="mt-1 text-xs text-muted-foreground">{r.gender_pref.join(", ")} · {r.local_option === "local_atendente" ? "Local do atendente" : "Parceiro"}</p>
                <p className="mt-1.5 text-xs font-medium text-primary">Toque para ver propostas →</p>
              </button>
            );
          })}
        </div>
      )}

      {view === "proposals" && (
        <div className="fixed inset-x-0 bottom-0 top-[60px] z-30 overflow-y-auto bg-background/95 px-4 pb-8 pt-4 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Propostas recebidas</h2>
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
              {proposals.map((p) => {
                const accepted = p.status === "aceita";
                const refused = p.status === "recusada";
                return (
                  <article key={p.id} className={`rounded-2xl border bg-card p-4 ${accepted ? "border-green-500/40" : refused ? "opacity-50 border-border" : "border-border"}`}>
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent"><Sparkles className="size-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold">{p.provider?.full_name ?? "Prestador"}</p>
                          {p.provider?.has_local && <span className="flex items-center gap-0.5 text-[10px] text-primary"><Home className="size-3" /> Local</span>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" /> {Number(p.provider?.rating_avg ?? 0).toFixed(1)}</span>
                          <span>{p.provider?.gender}</span>
                        </div>
                      </div>
                      {/* Cliente vê APENAS o valor total — sem breakdown */}
                      <p className="text-xl font-bold text-primary">R$ {Number(p.client_price).toFixed(2)}</p>
                    </div>
                    {p.message && <p className="mt-2 rounded-lg bg-secondary/50 p-2.5 text-xs text-muted-foreground italic">"{p.message}"</p>}
                    <p className="mt-2 text-[10px] text-muted-foreground"><Clock className="mr-1 inline size-3" />{new Date(p.created_at).toLocaleString("pt-BR")}</p>
                    {p.status === "pendente" && (
                      <Button className="mt-3 h-10 w-full" disabled={acceptingId === p.id} onClick={() => handleAcceptProposal(p.id)}>
                        {acceptingId === p.id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                        {acceptingId === p.id ? "Aceitando..." : "Aceitar esta proposta"}
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

      {view === "map" && (
        <Button size="lg" onClick={() => setView("request")} className="fixed bottom-6 left-1/2 z-30 h-14 -translate-x-1/2 rounded-full px-7 text-base shadow-glow">
          <Plus className="mr-1 size-5" /> Solicitar Serviço
        </Button>
      )}

      {view === "request" && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nova solicitação</h2>
            <Button variant="ghost" size="icon" onClick={() => { setView("map"); resetForm(); }}><X className="size-5" /></Button>
          </div>
          <div className="space-y-5">
            <Field label="Raio de busca"><div className="flex gap-2">{radiusOptions.map((r) => (<Chip key={r.value} active={radius === r.value} onClick={() => setRadius(r.value)}>{r.label}</Chip>))}</div></Field>
            <Field label="Tipo de serviço"><div className="flex gap-2">{(["massagem", "acompanhante"] as ServiceType[]).map((t) => (<Chip key={t} active={serviceType === t} onClick={() => setServiceType(t)} className="capitalize">{t}</Chip>))}</div></Field>
            {serviceType && (<Field label={serviceType === "massagem" ? "Tipo de massagem" : "Duração / Modalidade"}><div className="flex flex-wrap gap-2">{serviceSubTypes[serviceType].map((s) => (<Pill key={s.value} active={subType === s.value} onClick={() => setSubType(s.value)}>{s.label}</Pill>))}</div></Field>)}
            {showFlags && (<Field label="O que você procura"><p className="mb-2 text-xs text-muted-foreground">Selecione os serviços desejados</p><div className="flex flex-wrap gap-2">{serviceFlags.map((f) => (<Pill key={f.value} active={selectedFlags.includes(f.value)} onClick={() => toggleArr(selectedFlags, setSelectedFlags, f.value)} showCheck small>{f.label}</Pill>))}</div></Field>)}
            {flagsComplete && (<Field label="Local do atendimento"><div className="space-y-2">{localOptions.map((opt) => { const active = localChoice === opt.value; const Icon = opt.value === "local_atendente" ? Home : Users; return (<button key={opt.value} onClick={() => setLocalChoice(opt.value)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}><div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}><Icon className="size-5" /></div><div className="flex-1"><p className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>{opt.label}</p><p className="text-xs text-muted-foreground">{opt.desc}</p></div>{active && <Check className="size-5 text-primary" />}</button>); })}</div></Field>)}
            {localChoice && (<Field label="Preferência de gênero"><p className="mb-2 text-xs text-muted-foreground">Selecione um ou mais</p><div className="flex flex-wrap gap-2">{genderOptions.map((g) => (<Pill key={g.value} active={selectedGenders.includes(g.value)} onClick={() => toggleArr(selectedGenders, setSelectedGenders, g.value)} showCheck>{g.label}</Pill>))}</div></Field>)}
            {selectedGenders.length > 0 && (<Button className="h-13 w-full text-base" disabled={submitting} onClick={handleSubmit}>{submitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}{submitting ? "Enviando..." : "Solicitar atendimento"}</Button>)}
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><p className="text-sm font-semibold">{label}</p>{children}</div>; }
function Chip({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) { return <button onClick={onClick} className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"} ${className}`}>{children}</button>; }
function Pill({ active, onClick, children, showCheck = false, small = false }: { active: boolean; onClick: () => void; children: React.ReactNode; showCheck?: boolean; small?: boolean }) { return <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full border font-medium transition-all ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>{showCheck && active && <Check className={small ? "size-3" : "size-3.5"} />}{children}</button>; }
