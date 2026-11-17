import { useCallback, useEffect, useRef, useState } from "react";
import { X, Volume2, VolumeX, Star, MapPin, Loader2, Play, Sparkles, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SecureImg, useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";

interface Short {
  provider_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  distance_km: number | null;
  city: string | null;
  video_url: string;
  destaque: boolean;
  online: boolean;
}

/**
 * Vídeos curtos: feed vertical com o vídeo de apresentação (já aprovado) de quem anuncia.
 * Um vídeo por tela; desliza para o próximo. Só o vídeo da tela toca, os outros ficam parados.
 */
export function ShortsFeed({ lat, lng, oculto = false, onClose, onViewProfile }: {
  lat: number | null; lng: number | null; oculto?: boolean;
  onClose: () => void; onViewProfile: (providerId: string) => void;
}) {
  const [itens, setItens] = useState<Short[] | null>(null);
  const [erro, setErro] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [mudo, setMudo] = useState(true);
  const caixa = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("shorts_feed", { p_lat: lat, p_lng: lng, p_limit: 40 });
    if (error) { setErro(error.message); setItens([]); return; }
    setErro(""); setItens((data as Short[]) ?? []);
  }, [lat, lng]);
  useEffect(() => { carregar(); }, [carregar]);

  // descobre qual vídeo está na tela pela posição da rolagem
  const aoRolar = useCallback(() => {
    const el = caixa.current;
    if (!el || el.clientHeight === 0) return;
    setAtivo(Math.round(el.scrollTop / el.clientHeight));
  }, []);

  // "Voltar" do teclado fecha
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose]);

  return (
    <div className={`fixed inset-0 z-50 bg-black text-white ${oculto ? "hidden" : ""}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={onClose} aria-label="Fechar"
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/50 backdrop-blur">
          <X className="size-5" />
        </button>
        <p className="flex items-center gap-1.5 text-sm font-semibold drop-shadow"><Video className="size-4" /> Vídeos</p>
        <button onClick={() => setMudo((m) => !m)} aria-label={mudo ? "Ligar som" : "Desligar som"}
          className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/50 backdrop-blur">
          {mudo ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </button>
      </div>

      {itens === null && (
        <div className="flex h-full items-center justify-center"><Loader2 className="size-8 animate-spin" /></div>
      )}

      {itens !== null && itens.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <Video className="size-12 opacity-60" />
          <p className="text-lg font-semibold">{erro ? "Vídeos indisponíveis agora" : "Ainda não há vídeos por aqui"}</p>
          <p className="text-sm opacity-70">
            {erro ? "Tente de novo em instantes." : "Assim que os anunciantes publicarem seus vídeos de apresentação, eles aparecem aqui."}
          </p>
          <Button variant="secondary" onClick={onClose}>Voltar ao mapa</Button>
        </div>
      )}

      {itens !== null && itens.length > 0 && (
        <div ref={caixa} onScroll={aoRolar}
          className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]">
          {itens.map((s, i) => (
            <Tela key={s.provider_id} short={s} tocando={i === ativo && !oculto} perto={Math.abs(i - ativo) <= 1}
              mudo={mudo} onViewProfile={onViewProfile} />
          ))}
        </div>
      )}
    </div>
  );
}

function Tela({ short: s, tocando, perto, mudo, onViewProfile }: {
  short: Short; tocando: boolean; perto: boolean; mudo: boolean; onViewProfile: (id: string) => void;
}) {
  // só busca o arquivo do vídeo da tela e dos vizinhos, para não gastar dados à toa
  const url = useSignedUrl(perto ? s.video_url : null);
  const video = useRef<HTMLVideoElement>(null);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (tocando && !pausado) { v.play().catch(() => {}); }
    else { v.pause(); if (!tocando) { v.currentTime = 0; } }
  }, [tocando, pausado, url]);
  useEffect(() => { if (!tocando) setPausado(false); }, [tocando]);

  const nome = s.display_name?.trim() || s.username || "Anunciante";
  const nota = Number(s.rating_avg ?? 0);

  return (
    <section className="relative flex h-[100dvh] snap-start snap-always items-center justify-center bg-black">
      {url ? (
        <video ref={video} src={url} muted={mudo} loop playsInline preload="metadata"
          onClick={() => setPausado((p) => !p)} className="h-full w-full object-contain" />
      ) : (
        <Loader2 className="size-8 animate-spin opacity-60" />
      )}

      {pausado && tocando && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-black/50 backdrop-blur"><Play className="size-8" /></span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-24">
        <div className="pointer-events-auto mx-auto flex max-w-md items-end gap-3">
          <button onClick={() => onViewProfile(s.provider_id)} className="shrink-0" aria-label={`Ver perfil de ${nome}`}>
            {s.avatar_url
              ? <SecureImg src={s.avatar_url} alt="" className="size-14 rounded-full border-2 border-white/80 object-cover" />
              : <span className="flex size-14 items-center justify-center rounded-full border-2 border-white/80 bg-white/10 text-lg font-semibold">{nome.charAt(0).toUpperCase()}</span>}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate text-base font-semibold drop-shadow">{nome}</p>
              {s.destaque && (
                <span className="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  <Sparkles className="size-3" /> Destaque
                </span>
              )}
              {s.online && <span className="rounded-full bg-green-500/90 px-2 py-0.5 text-[10px] font-semibold text-black">Online</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs opacity-90">
              {Number(s.rating_count ?? 0) > 0 && (
                <span className="flex items-center gap-1"><Star className="size-3.5 fill-current" /> {nota.toFixed(1)} ({s.rating_count})</span>
              )}
              {s.distance_km != null
                ? <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {s.distance_km < 1 ? "a menos de 1 km" : `a ${s.distance_km.toFixed(0)} km`}</span>
                : s.city ? <span className="flex items-center gap-1"><MapPin className="size-3.5" /> {s.city}</span> : null}
            </div>
          </div>
          <Button onClick={() => onViewProfile(s.provider_id)} className="shrink-0 rounded-full">Ver perfil</Button>
        </div>
      </div>
    </section>
  );
}
