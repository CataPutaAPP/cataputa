import { useState, useEffect, useCallback, useRef } from "react";
import {
  Navigation, Check, X, Loader2, Star, Clock, MapPin,
  Car, Flag, Play, Square, MessageCircle, AlertTriangle,
  ChevronDown, Timer, Sparkles, Heart,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { playNotificationSound } from "@/lib/notifications";
import { getSubLabel, getLocalLabel, type ServiceType, type LocalOption } from "@/lib/service-options";
import { brl } from "@/lib/fees";
import { ReportButton } from "@/components/ReportButton";
import { RouteCard } from "@/components/RouteCard";
import { ChatPanel, useUnreadChats } from "@/components/ChatPanel";
import { useRealtime } from "@/lib/realtime";
import type { Profile } from "@/context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface ActiveService {
  id: string;
  service_type: ServiceType;
  sub_type: string;
  flags: string[];
  local_option: LocalOption;
  status: string;
  lat: number;
  lng: number;
  meeting_lat: number | null;
  meeting_lng: number | null;
  provider_fee_pct?: number | null;
  room_booking_id?: string | null;
  client_id: string;
  accepted_provider_id: string | null;
  accepted_proposal_id: string | null;
  provider_en_route_at: string | null;
  client_en_route_at?: string | null;
  provider_arrived_at: string | null;
  client_arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  // Joined
  proposal?: {
    price: number;
    client_price: number;
    message: string | null;
    local_option: LocalOption;
  };
  client?: Pick<Profile, "full_name" | "avatar_url" | "gender" | "rating_avg" | "rating_count">;
  provider?: Pick<Profile, "full_name" | "avatar_url" | "gender" | "rating_avg" | "rating_count" | "has_local">;
}

interface MatchViewProps {
  service: ActiveService;
  role: "cliente" | "prestador";
  userId: string;
  onClose: () => void;
  onRefresh: () => void;
}

/* ─── Local do parceiro: endereço, quarto e código da reserva ─────── */

function PartnerSpot({ bookingId, requestId, otherName, viajo, outroViaja }: { bookingId: string; requestId: string; otherName: string; viajo: boolean; outroViaja: boolean }) {
  const [info, setInfo] = useState<{
    nome: string | null; endereco: string | null; tipo: string | null; lat: number | null; lng: number | null;
    quarto: string | null; status: string;
  } | null>(null);
  useEffect(() => {
    let vivo = true;
    (async () => {
      // caminho normal: uma função do banco que só responde a quem participa da reserva
      const spot = await supabase.rpc("booking_spot", { p_booking_id: bookingId });
      if (!spot.error && spot.data) {
        const s = spot.data as { partner_name: string | null; local_address: string | null; local_type: string | null;
          lat: number | null; lng: number | null; room_name: string | null; status: string };
        if (vivo) setInfo({ nome: s.partner_name, endereco: s.local_address, tipo: s.local_type, lat: s.lat, lng: s.lng, quarto: s.room_name, status: String(s.status) });
        return;
      }
      // compatibilidade: enquanto a função ainda não existir no banco
      const { data: b } = await supabase.from("room_bookings").select("room_id, partner_id, status").eq("id", bookingId).maybeSingle();
      if (!b) return;
      const [{ data: room }, { data: p }] = await Promise.all([
        supabase.from("partner_rooms").select("name").eq("id", b.room_id).maybeSingle(),
        supabase.from("profiles").select("full_name, local_address, local_type, lat, lng").eq("id", b.partner_id).maybeSingle(),
      ]);
      if (vivo) setInfo({
        nome: p?.full_name ?? null, endereco: p?.local_address ?? null, tipo: p?.local_type ?? null,
        lat: p?.lat ?? null, lng: p?.lng ?? null, quarto: room?.name ?? null, status: String(b.status),
      });
    })();
    return () => { vivo = false; };
  }, [bookingId]);

  if (!info) return null;
  const codigo = bookingId.replace(/-/g, "").slice(0, 4).toUpperCase();
  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-primary" /> Local do encontro</p>
      <p className="mt-2 font-medium">{info.nome ?? "Local parceiro"}{info.tipo ? <span className="text-xs capitalize text-muted-foreground"> · {info.tipo}</span> : null}</p>
      {info.endereco && <p className="text-sm text-muted-foreground">{info.endereco}</p>}
      {info.quarto && <p className="mt-1 text-sm">Quarto: <span className="font-medium">{info.quarto}</span></p>}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
        <span className="text-xs text-muted-foreground">Código para informar na recepção</span>
        <span className="font-mono text-lg font-bold tracking-widest text-primary">{codigo}</span>
      </div>
      {info.status === "cancelada" && (
        <p className="mt-2 text-xs font-medium text-destructive">Esta reserva foi desfeita pelo local. Combinem outro ponto pelo chat.</p>
      )}
      {info.lat && info.lng && <RouteCard destino={{ lat: info.lat, lng: info.lng }} requestId={requestId} otherName={otherName} viajo={viajo} outroViaja={outroViaja} />}
      <p className="mt-2 text-[11px] text-muted-foreground">O quarto é pago direto no estabelecimento.</p>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────── */

export function MatchView({ service, role, userId, onClose, onRefresh }: MatchViewProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { counts: unread } = useUnreadChats(userId);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pediuNota = useRef(false);

  const isClient = role === "cliente";
  const isProvider = role === "prestador";
  const other = isClient ? service.provider : service.client;
  const otherName = other?.full_name ?? (isClient ? "Prestador" : "Cliente");
  const otherId = isClient ? service.accepted_provider_id : service.client_id;

  const [otherBadges, setOtherBadges] = useState<{ vip: boolean; verificado: boolean; atendimentos: number } | null>(null);
  useEffect(() => {
    if (!otherId) return;
    supabase.rpc("user_public_badges", { p_user_id: otherId })
      .then(({ data }) => setOtherBadges(data as typeof otherBadges));
  }, [otherId]);

  // Timer for em_andamento
  useEffect(() => {
    if (service.status === "em_andamento" && service.started_at) {
      const start = new Date(service.started_at).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [service.status, service.started_at]);

  // Tempo real: cada etapa do atendimento aparece na hora para os dois lados
  useRealtime(
    `atendimento-${service.id}`,
    [{ table: "service_requests", filter: `id=eq.${service.id}` }],
    onRefresh,
    { fallbackMs: 30000 },
  );

  // Check if already rated
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("ratings")
        .select("id")
        .eq("request_id", service.id)
        .eq("from_user_id", userId)
        .maybeSingle();
      if (data) setRatingSubmitted(true);
      else if (service.status === "concluida" && !pediuNota.current) {
        // concluiu e ainda não avaliou: abre a avaliação sozinha, uma única vez
        pediuNota.current = true;
        setShowRating(true);
      }
    })();
  }, [service.id, userId, service.status]);

  const callRpc = useCallback(async (fn: string, params: Record<string, unknown>, successMsg: string) => {
    setLoading(fn);
    const { error } = await supabase.rpc(fn, params);
    setLoading(null);
    if (error) {
      toast.error(error.message || `Erro ao executar ${fn}`);
      console.error(fn, error);
      return false;
    }
    playNotificationSound("accepted");
    toast.success(successMsg);
    onRefresh();
    return true;
  }, [onRefresh]);

  // ─── Ponto de encontro (carro / local do prestador) ───
  const providerSetsPoint = ["carro", "local_atendente"].includes(service.local_option);
  function handleSendMyLocation() {
    if (!navigator.geolocation) return toast.error("Geolocalização não disponível.");
    setLoading("set_meeting_point");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLoading(null);
        await callRpc("set_meeting_point", {
          p_request_id: service.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude,
        }, "Ponto de encontro enviado ao cliente!");
      },
      () => { setLoading(null); toast.error("Não foi possível obter sua localização."); },
      { enableHighAccuracy: true },
    );
  }

  // ─── Provider actions ───
  async function handleEnRoute() {
    await callRpc("provider_en_route", { p_request_id: service.id, p_provider_id: userId }, "Você sinalizou que está a caminho!");
  }
  async function handleProviderArrived() {
    await callRpc("provider_arrived", { p_request_id: service.id, p_provider_id: userId }, "Você sinalizou que chegou!");
  }

  // ─── Quem se desloca até o ponto ───
  const clientTravels = ["local_atendente", "carro", "parceiro"].includes(service.local_option);
  const providerTravels = ["local_cliente", "parceiro"].includes(service.local_option);

  async function handleClientEnRoute() {
    await callRpc("meet_update", { p_request_id: service.id, p_step: "cliente_a_caminho" }, "Você sinalizou que está a caminho!");
  }
  async function handleProviderReady() {
    // no local de quem atende: o ponto de encontro é a posição atual, se ainda não foi enviado
    if (providerSetsPoint && !service.meeting_lat && navigator.geolocation) {
      await new Promise<void>((ok) => navigator.geolocation.getCurrentPosition(
        async (pos) => {
          await supabase.rpc("set_meeting_point", { p_request_id: service.id, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
          ok();
        },
        () => ok(), { enableHighAccuracy: true, timeout: 15000 },
      ));
    }
    await callRpc("meet_update", { p_request_id: service.id, p_step: "prestador_pronto" }, "Pronto! O cliente foi avisado.");
  }

  // ─── Client actions ───
  async function handleClientArrived() {
    await callRpc("client_arrived", { p_request_id: service.id, p_client_id: userId }, "Presença confirmada!");
  }
  async function handleStartService() {
    await callRpc("start_service", { p_request_id: service.id, p_client_id: userId }, "Atendimento iniciado! O timer está rodando.");
  }

  // ─── Shared actions ───
  async function handleComplete() {
    await callRpc("complete_service", { p_request_id: service.id, p_user_id: userId }, "Atendimento concluído!");
    setShowRating(true);
  }
  async function handleCancel(reason: string) {
    const ok = await callRpc("cancel_service", {
      p_request_id: service.id, p_user_id: userId, p_reason: reason,
    }, "Serviço cancelado.");
    if (ok) setShowCancel(false);
  }
  async function handleSubmitRating() {
    if (myRating < 1) return toast.error("Selecione uma nota.");
    if (!otherId) return;
    setLoading("rating");
    const { error } = await supabase.rpc("submit_rating", {
      p_request_id: service.id,
      p_from_user_id: userId,
      p_to_user_id: otherId,
      p_stars: myRating,
      p_comment: isClient ? (myComment || null) : null,
    });
    setLoading(null);
    if (error) { toast.error(error.message); return; }
    playNotificationSound("accepted");
    toast.success("Avaliação enviada!");
    setRatingSubmitted(true);
    setShowRating(false);
  }

  // ─── Helpers ───
  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const providerIsOnWay = !!service.provider_en_route_at;
  const clientIsOnWay = !!service.client_en_route_at;
  const providerHere = !!service.provider_arrived_at;
  const clientHere = !!service.client_arrived_at;
  const bothHere = providerHere && clientHere;
  const isActive = ["aceita", "a_caminho", "em_andamento"].includes(service.status);
  const isDone = service.status === "concluida";
  const isCancelled = service.status === "cancelada";

  // ─── Cancel confirmation overlay ───
  if (showCancel) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/20">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold">Cancelar serviço?</h3>
          </div>
          <p className="mb-1 text-sm text-muted-foreground">
            {service.started_at
              ? "O serviço já foi iniciado. Cancelar agora pesa bastante na sua reputação."
              : "Cancelamentos ficam registrados no seu perfil e afetam sua reputação."
            }
          </p>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowCancel(false)}>Voltar</Button>
            <Button variant="destructive" className="flex-1" disabled={loading === "cancel_service"}
              onClick={() => handleCancel(isClient ? "cancelado pelo cliente" : "cancelado pelo prestador")}>
              {loading === "cancel_service" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <X className="mr-2 size-4" />}
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Rating overlay ───
  if (showRating && !ratingSubmitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-2xl">
          <h3 className="mb-1 text-center text-lg font-semibold">Avalie o atendimento</h3>
          <p className="mb-5 text-center text-sm text-muted-foreground">Como foi com {otherName}?</p>
          <div className="mb-5 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setMyRating(n)}
                className="transition-transform hover:scale-110 active:scale-95">
                <Star className={`size-10 ${n <= myRating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
              </button>
            ))}
          </div>
          {/* Cliente é avaliado só por estrelas — sem comentário, para não virar exposição */}
          {isClient && (
            <Textarea rows={2} value={myComment} onChange={(e) => setMyComment(e.target.value)}
              placeholder="Comentário (opcional)" className="mb-4" />
          )}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setShowRating(false)}>Agora não</Button>
            <Button className="flex-1" disabled={loading === "rating" || myRating < 1} onClick={handleSubmitRating}>
              {loading === "rating" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Heart className="mr-2 size-4" />}
              Enviar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed app-page z-30 overflow-y-auto bg-background/95 px-4 pb-8 pt-4 backdrop-blur-md">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {isDone ? "Atendimento concluído" : isCancelled ? "Serviço cancelado" : "Atendimento"}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
      </div>

      {/* Match card */}
      <div className="mb-4 rounded-2xl border border-primary/30 bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
            <Sparkles className="size-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{otherName}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {otherBadges?.vip && (
                <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">★ VIP</span>
              )}
              {otherBadges && otherBadges.atendimentos > 0 && (
                <span className="text-[11px]">{otherBadges.atendimentos} atendimento(s)</span>
              )}
              {other?.gender && <span>{other.gender}</span>}
              <span className="flex items-center gap-0.5">
                <Star className="size-3 fill-yellow-500 text-yellow-500" />
                {Number(other?.rating_avg ?? 0).toFixed(1)} ({other?.rating_count ?? 0})
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">
              {brl(service.proposal?.price ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isClient ? "pago direto ao prestador" : "você recebe (integral)"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{getSubLabel(service.service_type, service.sub_type)}</Badge>
          <Badge variant="secondary">{getLocalLabel(service.local_option, isClient ? "cliente" : "prestador")}</Badge>
        </div>
      </div>

      {/* Local do parceiro (quando o atendimento é em quarto reservado) */}
      {service.room_booking_id && service.status !== "concluida" && service.status !== "cancelada" && (
        <PartnerSpot bookingId={service.room_booking_id} requestId={service.id} otherName={otherName} viajo={isClient ? clientTravels : providerTravels} outroViaja={isClient ? providerTravels : clientTravels} />
      )}

      {/* Ponto de encontro */}
      {!service.room_booking_id && service.status !== "concluida" && service.status !== "cancelada" && service.status !== "em_andamento" && (
        <div className="mb-5 rounded-2xl border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-primary" /> Ponto de encontro</p>
          {service.meeting_lat && service.meeting_lng ? (
            <RouteCard destino={{ lat: service.meeting_lat, lng: service.meeting_lng }} requestId={service.id} otherName={otherName}
              viajo={isClient ? clientTravels : providerTravels} outroViaja={isClient ? providerTravels : clientTravels} />
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {isClient && providerSetsPoint ? "O prestador vai enviar a localização exata." : "Ponto ainda não definido."}
            </p>
          )}
          {isProvider && providerSetsPoint && (
            <Button variant="secondary" size="sm" className="mt-3 w-full" disabled={loading === "set_meeting_point"} onClick={handleSendMyLocation}>
              {loading === "set_meeting_point" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Navigation className="mr-2 size-4" />}
              {service.meeting_lat ? "Atualizar com minha localização atual" : "Enviar minha localização como ponto"}
            </Button>
          )}
        </div>
      )}

      {/* Status timeline */}
      <div className="mb-5 space-y-2">
        <StatusStep icon={<Check />} label="Proposta aceita" done time={service.created_at} />
        {!providerTravels && (
          <StatusStep icon={<MapPin />} label="Prestador pronto para receber"
            done={providerHere} time={service.provider_arrived_at}
            active={!providerHere && isProvider && isActive} />
        )}
        {!clientTravels && (
          <StatusStep icon={<Flag />} label="Cliente pronto para receber"
            done={clientHere} time={service.client_arrived_at}
            active={!clientHere && isClient && isActive} />
        )}
        {providerTravels && (
          <>
            <StatusStep icon={<Car />} label="Prestador a caminho"
              done={providerIsOnWay} time={service.provider_en_route_at}
              active={!providerIsOnWay && isProvider && service.status === "aceita"} />
            <StatusStep icon={<MapPin />} label="Prestador chegou"
              done={providerHere} time={service.provider_arrived_at}
              active={providerIsOnWay && !providerHere && isProvider} />
          </>
        )}
        {clientTravels && (
          <>
            <StatusStep icon={<Car />} label="Cliente a caminho"
              done={clientIsOnWay || clientHere} time={service.client_en_route_at ?? null}
              active={!clientIsOnWay && !clientHere && isClient && isActive} />
            <StatusStep icon={<Flag />} label="Cliente chegou"
              done={clientHere} time={service.client_arrived_at}
              active={clientIsOnWay && !clientHere && isClient} />
          </>
        )}
        <StatusStep icon={<Play />} label="Atendimento iniciado"
          done={!!service.started_at} time={service.started_at}
          active={bothHere && !service.started_at && isClient} />
        <StatusStep icon={<Square />} label={isDone ? "Concluído" : "Aguardando conclusão"}
          done={isDone} time={service.completed_at} />
      </div>

      {/* Chat do atendimento */}
      {service.accepted_proposal_id && (
        <Button variant="secondary" className="mb-5 h-11 w-full" onClick={() => setChatOpen(true)}>
          <MessageCircle className="mr-2 size-4" /> Conversar com {otherName}
          {unread[service.accepted_proposal_id] ? <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{unread[service.accepted_proposal_id]}</span> : null}
        </Button>
      )}
      {chatOpen && service.accepted_proposal_id && (
        <ChatPanel proposalId={service.accepted_proposal_id} onClose={() => setChatOpen(false)} />
      )}

      {/* Timer (em andamento) */}
      {service.status === "em_andamento" && (
        <div className="mb-5 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 p-5 text-center">
          <Timer className="mx-auto mb-2 size-8 text-yellow-500" />
          <p className="text-3xl font-bold tracking-wider text-yellow-400">{fmt(elapsed)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Atendimento em andamento</p>
        </div>
      )}

      {/* Cancelled info */}
      {isCancelled && (
        <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center">
          <AlertTriangle className="mx-auto mb-2 size-8 text-destructive" />
          <p className="font-semibold text-destructive">Serviço cancelado</p>
          {service.cancel_reason && <p className="mt-1 text-sm text-muted-foreground">{service.cancel_reason}</p>}
        </div>
      )}

      {/* Done + rating prompt */}
      {isDone && !ratingSubmitted && (
        <div className="mb-5 rounded-2xl border border-green-500/30 bg-green-500/5 p-4 text-center">
          <Heart className="mx-auto mb-2 size-8 text-green-500" />
          <p className="font-semibold text-green-400">Atendimento concluído!</p>
          <Button className="mt-3" onClick={() => setShowRating(true)}>
            <Star className="mr-2 size-4" /> Avaliar {otherName}
          </Button>
        </div>
      )}

      {isDone && ratingSubmitted && (
        <div className="mb-5 rounded-2xl border border-green-500/30 bg-green-500/5 p-4 text-center">
          <Check className="mx-auto mb-2 size-8 text-green-500" />
          <p className="font-semibold text-green-400">Avaliação enviada!</p>
          <p className="mt-1 text-sm text-muted-foreground">Obrigado pelo feedback.</p>
        </div>
      )}

      {/* Action buttons — grudados no rodape para nunca cairem abaixo da dobra */}
      <div className="sticky bottom-0 -mx-4 space-y-3 border-t border-border/50 bg-background/95 px-4 pb-2 pt-3 backdrop-blur-md">
        {/* Prestador que se desloca: a caminho → cheguei */}
        {isProvider && providerTravels && service.status === "aceita" && !providerIsOnWay && (
          <Button className="h-13 w-full text-base" onClick={handleEnRoute} disabled={loading === "provider_en_route"}>
            {loading === "provider_en_route" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Car className="mr-2 size-5" />}
            Estou a caminho
          </Button>
        )}
        {isProvider && providerTravels && providerIsOnWay && !providerHere && (
          <Button className="h-13 w-full text-base" onClick={handleProviderArrived} disabled={loading === "provider_arrived"}>
            {loading === "provider_arrived" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <MapPin className="mr-2 size-5" />}
            Cheguei no local
          </Button>
        )}

        {/* Prestador que recebe no próprio local: pronto para receber */}
        {isProvider && !providerTravels && isActive && !providerHere && !service.started_at && (
          <Button className="h-13 w-full text-base" onClick={handleProviderReady} disabled={loading === "meet_update"}>
            {loading === "meet_update" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <MapPin className="mr-2 size-5" />}
            Estou pronto para receber
          </Button>
        )}

        {/* Cliente que se desloca: a caminho → cheguei */}
        {isClient && clientTravels && isActive && !clientIsOnWay && !clientHere && !service.started_at && (
          <Button className="h-13 w-full text-base" onClick={handleClientEnRoute} disabled={loading === "meet_update"}>
            {loading === "meet_update" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Car className="mr-2 size-5" />}
            Estou a caminho
          </Button>
        )}
        {isClient && clientTravels && isActive && clientIsOnWay && !clientHere && !service.started_at && (
          <Button className="h-13 w-full text-base" onClick={handleClientArrived} disabled={loading === "client_arrived"}>
            {loading === "client_arrived" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Flag className="mr-2 size-5" />}
            Cheguei no local
          </Button>
        )}

        {/* Cliente que recebe no próprio local: pronto para receber */}
        {isClient && !clientTravels && isActive && !clientHere && !service.started_at && (
          <Button className="h-13 w-full text-base" onClick={handleClientArrived} disabled={loading === "client_arrived"}>
            {loading === "client_arrived" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Flag className="mr-2 size-5" />}
            Estou pronto para receber
          </Button>
        )}

        {/* Client: iniciar atendimento (ambos presentes) */}
        {isClient && bothHere && !service.started_at && (
          <Button className="h-14 w-full bg-green-600 text-base text-white hover:bg-green-700"
            onClick={handleStartService} disabled={loading === "start_service"}>
            {loading === "start_service" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Play className="mr-2 size-5" />}
            INICIAR ATENDIMENTO
          </Button>
        )}

        {/* Both: concluir */}
        {service.status === "em_andamento" && (
          <Button className="h-13 w-full bg-green-600 text-base text-white hover:bg-green-700"
            onClick={handleComplete} disabled={loading === "complete_service"}>
            {loading === "complete_service" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Square className="mr-2 size-5" />}
            Concluir atendimento
          </Button>
        )}

        {/* Avisos de espera — dizem quem está a caminho e quem espera, conforme o local */}
        {isActive && !service.started_at && (() => {
          const outroViaja = isClient ? providerTravels : clientTravels;
          const outroACaminho = isClient ? providerIsOnWay : clientIsOnWay;
          const outroPronto = isClient ? providerHere : clientHere;
          const euPronto = isClient ? clientHere : providerHere;
          let aviso: string | null = null;
          let destaque = false;
          if (bothHere) {
            aviso = isClient ? "Tudo pronto. Toque acima para iniciar!" : "Tudo pronto. Aguardando o cliente iniciar o atendimento.";
            destaque = true;
          } else if (outroPronto && !euPronto) {
            destaque = true;
            if (isClient) aviso = outroViaja ? "O prestador chegou! Confirme que está pronto para receber." : "O prestador está pronto para receber você.";
            else aviso = outroViaja ? "O cliente chegou! Confirme que está pronto para receber." : "O cliente está pronto para receber você.";
          } else if (outroViaja && outroACaminho && !outroPronto) {
            aviso = isClient ? "O prestador está a caminho..." : "O cliente está a caminho...";
          } else if (euPronto && !outroPronto) {
            if (isClient) aviso = outroViaja ? "Aguardando o prestador chegar..." : "Aguardando o prestador confirmar que está pronto...";
            else aviso = outroViaja ? "Aguardando o cliente chegar..." : "Aguardando o cliente confirmar que está pronto...";
          }
          return aviso ? (
            <p className={`text-center text-sm ${destaque ? "animate-pulse font-medium text-primary" : "text-muted-foreground"}`}>{aviso}</p>
          ) : null;
        })()}

        {/* Cancel (always available before done) */}
        {isActive && (
          <Button variant="ghost" className="h-10 w-full text-sm text-muted-foreground hover:text-destructive"
            onClick={() => setShowCancel(true)}>
            <X className="mr-2 size-4" /> Cancelar serviço
          </Button>
        )}
        {otherId && (
          <div className="flex justify-center">
            <ReportButton reportedId={otherId} requestId={service.id} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Status step ───────────────────────────────────────────────────── */

function StatusStep({
  icon, label, done, time, active = false,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  time?: string | null;
  active?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
      done ? "bg-green-500/10" : active ? "bg-primary/10 border border-primary/30" : "opacity-40"
    }`}>
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
        done ? "bg-green-500/20 text-green-400" : active ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
      }`}>
        {done ? <Check className="size-4" /> : <span className="[&>svg]:size-4">{icon}</span>}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${done ? "text-green-400" : active ? "text-primary" : "text-muted-foreground"}`}>
          {label}
        </p>
        {done && time && (
          <p className="text-[10px] text-muted-foreground">{new Date(time).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        )}
      </div>
      {active && <div className="size-2 animate-pulse rounded-full bg-primary" />}
    </div>
  );
}
