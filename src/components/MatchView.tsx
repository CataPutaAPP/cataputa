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
import { getSubLabel, type ServiceType, type LocalOption } from "@/lib/service-options";
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
  client_id: string;
  accepted_provider_id: string | null;
  accepted_proposal_id: string | null;
  provider_en_route_at: string | null;
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

/* ─── Main component ───────────────────────────────────────────────── */

export function MatchView({ service, role, userId, onClose, onRefresh }: MatchViewProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [showRating, setShowRating] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isClient = role === "cliente";
  const isProvider = role === "prestador";
  const other = isClient ? service.provider : service.client;
  const otherName = other?.full_name ?? (isClient ? "Prestador" : "Cliente");
  const otherId = isClient ? service.accepted_provider_id : service.client_id;

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

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(onRefresh, 5000);
    return () => clearInterval(interval);
  }, [onRefresh]);

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

  // ─── Provider actions ───
  async function handleEnRoute() {
    await callRpc("provider_en_route", { p_request_id: service.id, p_provider_id: userId }, "Você sinalizou que está a caminho!");
  }
  async function handleProviderArrived() {
    await callRpc("provider_arrived", { p_request_id: service.id, p_provider_id: userId }, "Você sinalizou que chegou!");
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
      p_comment: myComment || null,
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
              ? "O serviço já foi iniciado. Cancelar agora NÃO dá direito a reembolso."
              : "Antes do início, o reembolso é total."
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
          <Textarea rows={2} value={myComment} onChange={(e) => setMyComment(e.target.value)}
            placeholder="Comentário (opcional)" className="mb-4" />
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => { setShowRating(false); onClose(); }}>Pular</Button>
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
    <div className="fixed inset-x-0 bottom-0 top-[60px] z-30 overflow-y-auto bg-background/95 px-4 pb-8 pt-4 backdrop-blur-md">
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {other?.gender && <span>{other.gender}</span>}
              <span className="flex items-center gap-0.5">
                <Star className="size-3 fill-yellow-500 text-yellow-500" />
                {Number(other?.rating_avg ?? 0).toFixed(1)} ({other?.rating_count ?? 0})
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">
              R$ {isClient
                ? Number(service.proposal?.client_price ?? 0).toFixed(2)
                : Number((service.proposal?.price ?? 0) * 0.93).toFixed(2)
              }
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isClient ? "valor total" : "você recebe"}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{getSubLabel(service.service_type, service.sub_type)}</Badge>
          <Badge variant="secondary">{service.local_option === "local_atendente" ? "Local do atendente" : "Parceiro"}</Badge>
        </div>
      </div>

      {/* Status timeline */}
      <div className="mb-5 space-y-2">
        <StatusStep icon={<Check />} label="Proposta aceita" done time={service.created_at} />
        <StatusStep icon={<Car />} label="Prestador a caminho"
          done={providerIsOnWay} time={service.provider_en_route_at}
          active={!providerIsOnWay && isProvider && service.status === "aceita"} />
        <StatusStep icon={<MapPin />} label="Prestador chegou"
          done={providerHere} time={service.provider_arrived_at}
          active={providerIsOnWay && !providerHere && isProvider} />
        <StatusStep icon={<Flag />} label="Cliente no local"
          done={clientHere} time={service.client_arrived_at}
          active={!clientHere && isClient && isActive} />
        <StatusStep icon={<Play />} label="Atendimento iniciado"
          done={!!service.started_at} time={service.started_at}
          active={bothHere && !service.started_at && isClient} />
        <StatusStep icon={<Square />} label={isDone ? "Concluído" : "Aguardando conclusão"}
          done={isDone} time={service.completed_at} />
      </div>

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

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Provider: estou a caminho */}
        {isProvider && service.status === "aceita" && !providerIsOnWay && (
          <Button className="h-13 w-full text-base" onClick={handleEnRoute} disabled={loading === "provider_en_route"}>
            {loading === "provider_en_route" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Car className="mr-2 size-5" />}
            Estou a caminho
          </Button>
        )}

        {/* Provider: cheguei */}
        {isProvider && providerIsOnWay && !providerHere && (
          <Button className="h-13 w-full text-base" onClick={handleProviderArrived} disabled={loading === "provider_arrived"}>
            {loading === "provider_arrived" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <MapPin className="mr-2 size-5" />}
            Cheguei no local
          </Button>
        )}

        {/* Client: estou no local */}
        {isClient && isActive && !clientHere && !service.started_at && (
          <Button className="h-13 w-full text-base" onClick={handleClientArrived} disabled={loading === "client_arrived"}>
            {loading === "client_arrived" ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Flag className="mr-2 size-5" />}
            Estou no local
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

        {/* Waiting hints */}
        {isClient && !clientHere && providerIsOnWay && !providerHere && (
          <p className="text-center text-sm text-muted-foreground">O prestador está a caminho...</p>
        )}
        {isClient && !clientHere && providerHere && (
          <p className="animate-pulse text-center text-sm font-medium text-primary">O prestador já chegou! Confirme sua presença.</p>
        )}
        {isProvider && providerHere && !clientHere && (
          <p className="text-center text-sm text-muted-foreground">Aguardando o cliente confirmar presença...</p>
        )}
        {isClient && bothHere && !service.started_at && (
          <p className="animate-pulse text-center text-xs text-muted-foreground">Ambos estão no local. Toque acima para iniciar!</p>
        )}

        {/* Cancel (always available before done) */}
        {isActive && (
          <Button variant="ghost" className="h-10 w-full text-sm text-muted-foreground hover:text-destructive"
            onClick={() => setShowCancel(true)}>
            <X className="mr-2 size-4" /> Cancelar serviço
          </Button>
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
          <p className="text-[10px] text-muted-foreground">{new Date(time).toLocaleString("pt-BR")}</p>
        )}
      </div>
      {active && <div className="size-2 animate-pulse rounded-full bg-primary" />}
    </div>
  );
}
