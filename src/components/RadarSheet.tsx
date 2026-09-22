import { useCallback, useEffect, useState } from "react";
import { X, Loader2, Radar, Star, MapPin, Home, Sparkles, Inbox, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModalPortal } from "@/components/ModalPortal";
import { ProviderPhotoStrip } from "@/components/ProviderProfile";
import { supabase } from "@/lib/supabase";

interface OnlineProvider {
  provider_id: string; provider_name: string | null; gender: string | null;
  rating_avg: number | null; rating_count: number; fotos: number; destaque: boolean;
  has_local: boolean; tem_oferta: boolean; distance_km: number; online_desde: string;
}

/** Radar de quem está online agora — recurso do Privora Pass. */
export function RadarSheet({ lat, lng, radius, onClose, onViewProfile, onSeeOffers }: {
  lat: number; lng: number; radius: number;
  onClose: () => void; onViewProfile: (id: string) => void; onSeeOffers: () => void;
}) {
  const [rows, setRows] = useState<OnlineProvider[] | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("nearby_online_providers", {
      p_lat: lat, p_lng: lng, p_radius_km: radius,
    });
    if (error) {
      if (error.message?.includes("Pass")) setBlocked(error.message);
      else toast.error(error.message);
      setRows([]); return;
    }
    setBlocked(null);
    setRows((data as OnlineProvider[]) ?? []);
  }, [lat, lng, radius]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);   // o radar se atualiza sozinho
    return () => clearInterval(t);
  }, [load]);

  return (
    <ModalPortal>
      <div className="fixed inset-x-0 bottom-0 top-[76px] z-40 flex flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><Radar className="size-5 text-primary" /> Online agora</h2>
            <p className="text-xs text-muted-foreground">Prestadores disponíveis neste momento, em até {radius} km</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8">
          {blocked ? (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Lock className="size-12 text-muted-foreground/40" />
              <p className="max-w-xs text-sm text-muted-foreground">{blocked}</p>
              <p className="text-xs text-muted-foreground">Abra os planos no ícone da coroa para assinar.</p>
            </div>
          ) : !rows ? (
            <div className="flex justify-center py-10"><Loader2 className="size-7 animate-spin text-primary" /></div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Inbox className="size-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Ninguém online em {radius} km agora.</p>
              <Button variant="secondary" size="sm" onClick={onSeeOffers}>Ver ofertas publicadas</Button>
            </div>
          ) : rows.map((p) => (
            <article key={p.provider_id} className={`rounded-2xl border p-4 ${p.destaque ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"}`}>
              <div className="flex items-start gap-3">
                <div className="relative flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent">
                  <Sparkles className="size-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-green-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => onViewProfile(p.provider_id)} className="truncate text-left font-semibold hover:text-primary">
                      {p.provider_name ?? "Prestador"}
                    </button>
                    {p.destaque && <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">⚡ Destaque</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" />{Number(p.rating_avg ?? 0).toFixed(1)} ({p.rating_count})</span>
                    {p.gender && <span>{p.gender}</span>}
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{Number(p.distance_km).toFixed(1)} km</span>
                    {p.has_local && <span className="flex items-center gap-1 text-primary"><Home className="size-3" /> Local</span>}
                  </div>
                </div>
              </div>

              <ProviderPhotoStrip providerId={p.provider_id} onClick={() => onViewProfile(p.provider_id)} />

              <div className="mt-3 flex items-center gap-2">
                <Button variant="secondary" className="h-9 flex-1" onClick={() => onViewProfile(p.provider_id)}>Ver perfil</Button>
                {p.tem_oferta && <Badge variant="secondary" className="shrink-0 text-[10px]">tem oferta ativa</Badge>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </ModalPortal>
  );
}
