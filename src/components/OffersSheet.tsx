import { useCallback, useEffect, useState } from "react";
import { X, Loader2, Sparkles, Star, MapPin, Home, Users, Building2, Car, Check, Inbox, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModalPortal } from "@/components/ModalPortal";
import { ProviderPhotoStrip } from "@/components/ProviderProfile";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/fees";
import { getSubLabel, getLocalLabel, type ServiceType } from "@/lib/service-options";
import { useServiceOptions } from "@/lib/options";

export interface NearbyOffer {
  offer_id: string; provider_id: string; provider_name: string | null; gender: string | null;
  rating_avg: number | null; rating_count: number; fotos: number; destaque: boolean;
  service_type: ServiceType; sub_type: string; flags: string[] | null; price: number;
  local_option: string; description: string | null; distance_km: number; created_at: string;
}

/**
 * Vitrine de ofertas publicadas pelos prestadores.
 * Aceitar cria o chamado + a proposta; daí em diante o fluxo é o mesmo de sempre.
 */
export function OffersSheet({ lat, lng, radius, onClose, onAccepted, onViewProfile }: {
  lat: number; lng: number; radius: number;
  onClose: () => void;
  onAccepted: (r: { request_id: string; proposal_id: string }) => void;
  onViewProfile: (providerId: string) => void;
}) {
  const opcoes = useServiceOptions();
  const [tipo, setTipo] = useState<string | null>(null);
  const [offers, setOffers] = useState<NearbyOffer[] | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [generos, setGeneros] = useState<string[]>([]);
  const [locais, setLocais] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [precoMax, setPrecoMax] = useState<number | null>(null);
  const [ordem, setOrdem] = useState("relevancia");
  const [faixa, setFaixa] = useState<{ minimo: number; maximo: number; total: number } | null>(null);

  const alterna = (lista: string[], set: (v: string[]) => void, v: string) =>
    set(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  const filtrosAtivos =
    generos.length + locais.length + flags.length + (precoMax ? 1 : 0) + (ordem !== "relevancia" ? 1 : 0);

  useEffect(() => {
    supabase.rpc("offers_price_range", { p_lat: lat, p_lng: lng, p_radius_km: radius })
      .then(({ data }) => setFaixa(data as typeof faixa));
  }, [lat, lng, radius]);

  const load = useCallback(async () => {
    setOffers(null);
    const { data, error } = await supabase.rpc("nearby_offers", {
      p_lat: lat, p_lng: lng, p_radius_km: radius,
      p_service_type: tipo,
      p_genders: generos.length ? generos : null,
      p_min_price: null,
      p_max_price: precoMax,
      p_locals: locais.length ? locais : null,
      p_flags: flags.length ? flags : null,
      p_order: ordem,
    });
    if (error) { console.error("nearby_offers", error); toast.error("Erro ao buscar ofertas."); setOffers([]); return; }
    setOffers((data as NearbyOffer[]) ?? []);
  }, [lat, lng, radius, tipo, generos, locais, flags, precoMax, ordem]);
  useEffect(() => { load(); }, [load]);

  async function accept(o: NearbyOffer) {
    setAccepting(o.offer_id);
    const { data, error } = await supabase.rpc("accept_offer", { p_offer_id: o.offer_id, p_lat: lat, p_lng: lng });
    setAccepting(null);
    if (error) { toast.error(error.message); load(); return; }
    onAccepted(data as { request_id: string; proposal_id: string });
  }

  const LocalIcon = ({ v }: { v: string }) =>
    v === "parceiro" ? <Building2 className="size-3.5" /> : v === "carro" ? <Car className="size-3.5" />
      : v === "local_cliente" ? <Users className="size-3.5" /> : <Home className="size-3.5" />;

  return (
    <ModalPortal>
      <div className="fixed inset-x-0 bottom-0 top-[76px] z-40 flex flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">Ofertas perto de você</h2>
            <p className="text-xs text-muted-foreground">Publicadas por prestadores · aceite direto, sem esperar proposta</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
        </div>

        <div className="flex items-center gap-2 px-4 pb-3">
          {[{ value: null as string | null, label: "Todos" }, ...opcoes.tipos].map((t) => (
            <button key={t.label} onClick={() => setTipo(t.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${tipo === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              {t.label}
            </button>
          ))}
          <button onClick={() => setMostrarFiltros((v) => !v)}
            className={`ml-auto flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium ${
              filtrosAtivos ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            <SlidersHorizontal className="size-3.5" />
            {filtrosAtivos ? `Filtros (${filtrosAtivos})` : "Filtros"}
          </button>
        </div>

        {mostrarFiltros && (
          <div className="space-y-3 border-y border-border bg-card/50 px-4 py-3">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">ORDENAR POR</p>
              <div className="flex flex-wrap gap-1.5">
                {([["relevancia", "Relevância"], ["preco_menor", "Menor preço"], ["preco_maior", "Maior preço"],
                  ["nota", "Melhor nota"], ["recentes", "Mais recentes"]] as [string, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => setOrdem(v)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${ordem === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {faixa && faixa.total > 0 && faixa.maximo > faixa.minimo && (
              <div>
                <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">
                  ATÉ {precoMax ? brl(precoMax) : brl(faixa.maximo)}
                </p>
                <input type="range" min={faixa.minimo} max={faixa.maximo} step={10}
                  value={precoMax ?? faixa.maximo}
                  onChange={(e) => setPrecoMax(Number(e.target.value) >= faixa.maximo ? null : Number(e.target.value))}
                  className="w-full accent-[var(--primary)]" />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">QUEM ATENDE</p>
              <div className="flex flex-wrap gap-1.5">
                {opcoes.generos.map((g) => (
                  <button key={g.value} onClick={() => alterna(generos, setGeneros, g.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${generos.includes(g.value) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">ONDE</p>
              <div className="flex flex-wrap gap-1.5">
                {([["local_atendente", "No local dele(a)"], ["local_cliente", "Vai até você"],
                  ["parceiro", "Motel parceiro"], ["carro", "No carro"]] as [string, string][]).map(([v, l]) => (
                  <button key={v} onClick={() => alterna(locais, setLocais, v)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${locais.includes(v) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">INCLUI</p>
              <div className="flex flex-wrap gap-1.5">
                {opcoes.praticas.map((f) => (
                  <button key={f.value} onClick={() => alterna(flags, setFlags, f.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${flags.includes(f.value) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filtrosAtivos > 0 && (
              <button onClick={() => { setGeneros([]); setLocais([]); setFlags([]); setPrecoMax(null); setOrdem("relevancia"); }}
                className="text-xs text-muted-foreground underline">
                Limpar filtros
              </button>
            )}
          </div>
        )}

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-8">
          {!offers ? (
            <div className="flex justify-center py-10"><Loader2 className="size-7 animate-spin text-primary" /></div>
          ) : offers.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Inbox className="size-12 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {filtrosAtivos ? "Nenhuma oferta com esses filtros." : `Nenhuma oferta em ${radius} km agora.`}
              </p>
              <p className="text-xs text-muted-foreground">Abra um chamado e os prestadores próximos enviam propostas.</p>
            </div>
          ) : offers.map((o) => (
            <article key={o.offer_id} className={`rounded-2xl border p-4 ${o.destaque ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"}`}>
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent"><Sparkles className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => onViewProfile(o.provider_id)} className="truncate text-left font-semibold hover:text-primary">
                      {o.provider_name ?? "Prestador"}
                    </button>
                    {o.destaque && <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">⚡ Destaque</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" />{Number(o.rating_avg ?? 0).toFixed(1)} ({o.rating_count})</span>
                    {o.gender && <span>{o.gender}</span>}
                    <span className="flex items-center gap-1"><MapPin className="size-3" />{Number(o.distance_km).toFixed(1)} km</span>
                  </div>
                </div>
                <p className="shrink-0 text-xl font-bold text-primary">{brl(o.price)}</p>
              </div>

              <ProviderPhotoStrip providerId={o.provider_id} onClick={() => onViewProfile(o.provider_id)} />

              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="secondary" className="text-[10px]">{opcoes.rotulo(o.sub_type) || getSubLabel(o.service_type, o.sub_type)}</Badge>
                <span className="flex items-center gap-1 text-muted-foreground"><LocalIcon v={o.local_option} />{getLocalLabel(o.local_option)}</span>
              </div>
              {o.flags && o.flags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {o.flags.map((f) => (
                    <span key={f} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {opcoes.rotulo(f)}
                    </span>
                  ))}
                </div>
              )}
              {o.description && <p className="mt-2 rounded-lg bg-secondary/50 p-2.5 text-xs italic text-muted-foreground">"{o.description}"</p>}

              <Button className="mt-3 h-10 w-full" disabled={accepting === o.offer_id} onClick={() => accept(o)}>
                {accepting === o.offer_id ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />}
                {o.local_option === "parceiro" ? "Escolher quarto e aceitar" : `Aceitar · ${brl(o.price)}`}
              </Button>
            </article>
          ))}
        </div>
      </div>
    </ModalPortal>
  );
}
