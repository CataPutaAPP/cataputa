import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, LocateFixed, Loader2, MapPin, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { carregarLeaflet } from "@/components/RouteCard";
import { useBackClose } from "@/lib/back";
import type { Ponto } from "@/lib/encontro";

/**
 * Escolher outro ponto de encontro: buscar um endereço, usar a posição atual
 * ou tocar no mapa. Busca de endereços pelo OpenStreetMap (gratuita, sem chave).
 */
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const BUSCA = "https://nominatim.openstreetmap.org/search";

interface Resultado { lat: number; lng: number; nome: string; detalhe: string }

export function MeetingPointPicker({ inicial, onConfirm, onClose }: {
  inicial: Ponto | null;
  onConfirm: (p: Ponto, rotulo: string) => Promise<boolean>;
  onClose: () => void;
}) {
  useBackClose(true, onClose);
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);            // eslint-disable-line @typescript-eslint/no-explicit-any
  const pino = useRef<any>(null);            // eslint-disable-line @typescript-eslint/no-explicit-any
  const [ponto, setPonto] = useState<Ponto | null>(inicial);
  const [rotulo, setRotulo] = useState(inicial ? "Ponto atual" : "");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const centro = useRef<Ponto | null>(inicial);

  /* mapa: tocar marca o ponto */
  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !caixa.current || mapa.current) return;
      const c = inicial ?? { lat: -23.55, lng: -46.63 };
      mapa.current = L.map(caixa.current, { zoomControl: false, attributionControl: false }).setView([c.lat, c.lng], 15);
      L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(mapa.current);
      mapa.current.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        setPonto({ lat: e.latlng.lat, lng: e.latlng.lng }); setRotulo("Ponto marcado no mapa");
      });
      mapa.current.on("moveend", () => { const m = mapa.current?.getCenter(); if (m) centro.current = { lat: m.lat, lng: m.lng }; });
    }).catch(() => {});
    if (!inicial && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((p) => {
        const q = { lat: p.coords.latitude, lng: p.coords.longitude };
        centro.current = q;
        mapa.current?.setView([q.lat, q.lng], 15);
      }, () => {}, { timeout: 8000 });
    }
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* pino */
  useEffect(() => {
    const L = (window as any).L;                // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!L || !mapa.current) return;
    pino.current?.remove(); pino.current = null;
    if (!ponto) return;
    pino.current = L.marker([ponto.lat, ponto.lng], {
      icon: L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 28],
        html: '<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#B17078;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);color:#fff;font:700 13px sans-serif">P</span></div>' }),
    }).addTo(mapa.current);
  }, [ponto]);

  /* busca de endereço (espera a pessoa parar de digitar) */
  useEffect(() => {
    const q = busca.trim();
    if (q.length < 4) { setResultados([]); return; }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const c = centro.current;
        const perto = c ? `&viewbox=${c.lng - 0.4},${c.lat + 0.4},${c.lng + 0.4},${c.lat - 0.4}` : "";
        const r = await fetch(`${BUSCA}?format=jsonv2&limit=6&countrycodes=br&accept-language=pt-BR${perto}&q=${encodeURIComponent(q)}`,
          { signal: AbortSignal.timeout(8000) });
        const j = (await r.json()) as Array<{ lat: string; lon: string; name?: string; display_name: string }>;
        setResultados(j.map((x) => {
          const partes = x.display_name.split(", ");
          return { lat: Number(x.lat), lng: Number(x.lon), nome: x.name || partes[0] || x.display_name, detalhe: partes.slice(1, 4).join(", ") };
        }));
      } catch { setResultados([]); }
      setBuscando(false);
    }, 700);
    return () => clearTimeout(t);
  }, [busca]);

  function escolher(r: Resultado) {
    setPonto({ lat: r.lat, lng: r.lng }); setRotulo(r.nome); setResultados([]); setBusca("");
    mapa.current?.setView([r.lat, r.lng], 17);
  }

  function minhaPosicao() {
    if (!navigator.geolocation) return toast.error("Este aparelho não informa a localização.");
    navigator.geolocation.getCurrentPosition((p) => {
      const q = { lat: p.coords.latitude, lng: p.coords.longitude };
      setPonto(q); setRotulo("Minha localização atual");
      mapa.current?.setView([q.lat, q.lng], 17);
    }, () => toast.error("Não foi possível obter sua localização."), { enableHighAccuracy: true, timeout: 15000 });
  }

  async function confirmar() {
    if (!ponto) return;
    setSalvando(true);
    const ok = await onConfirm(ponto, rotulo || "Ponto combinado");
    setSalvando(false);
    if (ok) onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex flex-col bg-background">
      <div className="sh-dark-tiles isolate z-0 absolute inset-0 overflow-hidden">
        <div ref={caixa} className="size-full bg-secondary" aria-label="Toque no mapa para marcar o ponto de encontro" />
      </div>

      <div className="relative z-20 m-3 mt-[calc(0.75rem+env(safe-area-inset-top))] rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Combinar outro ponto</p>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fechar"><X className="size-5" /></Button>
        </div>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar endereço ou lugar" className="pl-9" />
          {buscando && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        {resultados.length > 0 && (
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {resultados.map((r) => (
              <button key={`${r.lat},${r.lng}`} onClick={() => escolher(r)}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-secondary">
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="min-w-0"><span className="block truncate text-sm font-medium">{r.nome}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{r.detalhe}</span></span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">Ou toque no mapa para marcar o ponto. Prefira um lugar público e fácil de achar.</p>
      </div>

      <div className="relative z-20 mt-auto m-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur">
        {ponto ? <p className="truncate text-sm"><span className="text-muted-foreground">Ponto: </span><span className="font-medium">{rotulo || "Ponto marcado no mapa"}</span></p>
          : <p className="text-sm text-muted-foreground">Nenhum ponto escolhido ainda.</p>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={minhaPosicao}><LocateFixed className="mr-1.5 size-4" /> Onde estou</Button>
          <Button disabled={!ponto || salvando} onClick={confirmar}>
            {salvando ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Check className="mr-1.5 size-4" />} Confirmar ponto
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">A outra pessoa é avisada na hora e os dois passam a ver a rota até o novo ponto.</p>
      </div>
    </div>,
    document.body,
  );
}
