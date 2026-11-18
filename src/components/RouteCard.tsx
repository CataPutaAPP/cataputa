import { useEffect, useRef, useState } from "react";
import { Navigation, Clock, Loader2, MapPin, Car } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * Rota até o ponto de encontro, dentro do app: mapa com o trajeto, distância,
 * tempo estimado e hora prevista de chegada, atualizados enquanto a pessoa se desloca.
 * Mostra também a que distância a outra pessoa está do ponto.
 * Para navegação com voz, curva a curva, há os botões do Waze e do Google Maps.
 */
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const ROTEADOR = "https://router.project-osrm.org/route/v1/driving";

interface Ponto { lat: number; lng: number }
interface Rota { km: number; min: number; linha: [number, number][]; estimada: boolean }

/* eslint-disable @typescript-eslint/no-explicit-any */
function carregarLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const w = window as any;
    if (w.L) return resolve(w.L);
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = LEAFLET_CSS; document.head.appendChild(l);
    }
    const espera = () => {
      const t = setInterval(() => { if (w.L) { clearInterval(t); resolve(w.L); } }, 100);
      setTimeout(() => { clearInterval(t); if (!w.L) reject(new Error("mapa indisponível")); }, 10000);
    };
    if (document.querySelector(`script[src="${LEAFLET_JS}"]`)) return espera();
    const s = document.createElement("script"); s.src = LEAFLET_JS; s.async = true;
    s.onload = () => (w.L ? resolve(w.L) : reject(new Error("mapa indisponível")));
    s.onerror = () => reject(new Error("mapa indisponível"));
    document.head.appendChild(s);
  });
}

/** Distância em linha reta, em km. */
function retaKm(a: Ponto, b: Ponto) {
  const r = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Rota de carro pelas ruas. Se o serviço de rotas não responder, estima pela linha reta. */
async function buscarRota(de: Ponto, ate: Ponto): Promise<Rota> {
  try {
    const url = `${ROTEADOR}/${de.lng},${de.lat};${ate.lng},${ate.lat}?overview=full&geometries=geojson`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = await resp.json();
    const r = j?.routes?.[0];
    if (!r) throw new Error("sem rota");
    return {
      km: r.distance / 1000, min: Math.max(1, Math.round(r.duration / 60)),
      linha: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]), estimada: false,
    };
  } catch {
    const km = retaKm(de, ate) * 1.35;                       // ruas costumam ser ~35% mais longas que a reta
    return { km, min: Math.max(1, Math.round((km / 25) * 60)), linha: [[de.lat, de.lng], [ate.lat, ate.lng]], estimada: true };
  }
}

const fmtKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace(".", ",")} km`);
const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
const chegada = (m: number) => new Date(Date.now() + m * 60000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

export function RouteCard({ destino, requestId, otherName }: { destino: Ponto; requestId?: string; otherName?: string }) {
  const { updateLocation } = useAuth();
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const camada = useRef<any>(null);
  const [eu, setEu] = useState<Ponto | null>(null);
  const [erroGps, setErroGps] = useState("");
  const [rota, setRota] = useState<Rota | null>(null);
  const [outro, setOutro] = useState<{ km: number; min: number } | null>(null);
  const [outroPos, setOutroPos] = useState<Ponto | null>(null);
  const [semMapa, setSemMapa] = useState(false);
  const ultimaRota = useRef<{ de: Ponto; quando: number } | null>(null);
  const ultimoEnvio = useRef(0);

  /* minha posição, acompanhada enquanto a tela está aberta */
  useEffect(() => {
    if (!navigator.geolocation) { setErroGps("Este aparelho não informa a localização."); return; }
    const recebe = (p: GeolocationPosition) => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
      setEu(pos); setErroGps("");
      // mantém minha posição atualizada para a outra pessoa ver a que distância estou (no máximo a cada 30 s)
      if (Date.now() - ultimoEnvio.current > 30000) { ultimoEnvio.current = Date.now(); updateLocation(pos.lat, pos.lng).catch(() => {}); }
    };
    const falha = (e: GeolocationPositionError) => {
      if (e.code === e.PERMISSION_DENIED) setErroGps("Permita o acesso à localização para ver a rota.");
    };
    // primeira posição rápida (pode ser aproximada); depois acompanha com precisão
    navigator.geolocation.getCurrentPosition(recebe, falha, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
    const id = navigator.geolocation.watchPosition(recebe, falha, { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [updateLocation]);

  /* minha rota: refaz quando ando mais de 150 m ou a cada 60 s */
  useEffect(() => {
    if (!eu) return;
    const u = ultimaRota.current;
    if (u && retaKm(u.de, eu) < 0.15 && Date.now() - u.quando < 60000) return;
    ultimaRota.current = { de: eu, quando: Date.now() };
    let vivo = true;
    buscarRota(eu, destino).then((r) => { if (vivo) setRota(r); });
    return () => { vivo = false; };
  }, [eu, destino.lat, destino.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  /* a outra pessoa: a que distância está do ponto (a cada 30 s) */
  useEffect(() => {
    if (!requestId) return;
    let vivo = true;
    const ler = async () => {
      const { data, error } = await supabase.rpc("service_other_position", { p_request_id: requestId });
      const p = data as { lat?: number | null; lng?: number | null } | null;
      if (!vivo || error || !p?.lat || !p?.lng) return;
      const pos = { lat: p.lat, lng: p.lng };
      setOutroPos(pos);
      const r = await buscarRota(pos, destino);
      if (vivo) setOutro({ km: r.km, min: r.min });
    };
    ler();
    const t = setInterval(ler, 30000);
    return () => { vivo = false; clearInterval(t); };
  }, [requestId, destino.lat, destino.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  /* mapa */
  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !caixa.current || mapa.current) return;
      mapa.current = L.map(caixa.current, { zoomControl: false, attributionControl: false }).setView([destino.lat, destino.lng], 14);
      L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(mapa.current);
      camada.current = L.layerGroup().addTo(mapa.current);
    }).catch(() => { if (vivo) setSemMapa(true); });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapa.current || !camada.current) return;
    camada.current.clearLayers();
    const pontos: [number, number][] = [[destino.lat, destino.lng]];
    if (rota) { L.polyline(rota.linha, { color: "#D8B890", weight: 5, opacity: 0.9, dashArray: rota.estimada ? "6 8" : undefined }).addTo(camada.current); pontos.push(...rota.linha); }
    L.circleMarker([destino.lat, destino.lng], { radius: 9, color: "#fff", weight: 2, fillColor: "#B17078", fillOpacity: 1 }).addTo(camada.current);
    if (eu) { L.circleMarker([eu.lat, eu.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#3b82f6", fillOpacity: 1 }).addTo(camada.current); pontos.push([eu.lat, eu.lng]); }
    if (outroPos) { L.circleMarker([outroPos.lat, outroPos.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#22c55e", fillOpacity: 1 }).addTo(camada.current); pontos.push([outroPos.lat, outroPos.lng]); }
    if (pontos.length > 1) mapa.current.fitBounds(L.latLngBounds(pontos), { padding: [28, 28], maxZoom: 16 });
  }, [rota, eu, outroPos, destino.lat, destino.lng]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const cheguei = !!rota && rota.km < 0.12;
  const quem = otherName?.trim().split(" ")[0] || "A outra pessoa";

  return (
    <div className="mt-3">
      {!semMapa && (
        <div className="sh-dark-tiles overflow-hidden rounded-xl border border-border">
          <div ref={caixa} className="h-52 w-full bg-secondary" aria-label="Mapa com a rota até o ponto de encontro" />
        </div>
      )}

      <div className="mt-3 rounded-xl bg-secondary/60 px-3 py-2.5">
        {erroGps ? (
          <p className="text-xs text-muted-foreground">{erroGps}</p>
        ) : !rota ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Calculando a rota…</p>
        ) : cheguei ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><MapPin className="size-4" /> Você está no ponto de encontro</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-lg font-bold leading-tight"><Car className="size-4 text-primary" /> {fmtMin(rota.min)}</p>
              <p className="text-xs text-muted-foreground">{fmtKm(rota.km)} de carro{rota.estimada ? " (estimativa)" : ""}</p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" /> Chegada</p>
              <p className="text-base font-semibold">{chegada(rota.min)}</p>
            </div>
          </div>
        )}
        {outro && (
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
            {outro.km < 0.12 ? `${quem} já está no ponto de encontro.` : `${quem} está a ${fmtMin(outro.min)} do ponto (${fmtKm(outro.km)}).`}
          </p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary"
          href={`https://waze.com/ul?ll=${destino.lat},${destino.lng}&navigate=yes`} target="_blank" rel="noreferrer">
          <Navigation className="size-4" /> Waze
        </a>
        <a className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary"
          href={`https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}`} target="_blank" rel="noreferrer">
          <Navigation className="size-4" /> Google Maps
        </a>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Tempo e chegada são estimativas e se atualizam durante o trajeto. Para navegação com voz, abra no Waze ou no Google Maps.
      </p>
    </div>
  );
}
