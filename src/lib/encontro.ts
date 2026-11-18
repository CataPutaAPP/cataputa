import { useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

/**
 * Encontro ao vivo: rota de carro, instruções de navegação e posição em tempo real
 * das duas pessoas de um atendimento, entre o aceite e o início.
 *
 * - Rotas: OSRM público (gratuito, sem chave). Sem resposta, estima pela linha reta.
 * - Tempo real: canal privado do Supabase "rota:<id do atendimento>". Só as duas pessoas
 *   do atendimento entram (regra no banco). A posição não é gravada, só repassada.
 * - Reserva: se o canal não abrir, lê a última posição gravada a cada 30 s.
 */

export interface Ponto { lat: number; lng: number }

export interface Passo {
  texto: string;          // "Vire à direita na Rua X"
  local: Ponto;           // onde a manobra acontece
  metros: number;         // extensão do trecho que começa nesta manobra
}

export interface Rota {
  km: number;
  min: number;
  linha: [number, number][];
  passos: Passo[];
  estimada: boolean;
}

export interface PosicaoAoVivo extends Ponto { rumo: number | null; quando: number }

const ROTEADOR = "https://router.project-osrm.org/route/v1/driving";

/** Distância em linha reta, em km. */
export function retaKm(a: Ponto, b: Ponto) {
  const r = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/* ─── instruções em português ─── */
const LADO: Record<string, string> = {
  left: "à esquerda", right: "à direita", "slight left": "levemente à esquerda", "slight right": "levemente à direita",
  "sharp left": "acentuadamente à esquerda", "sharp right": "acentuadamente à direita", straight: "em frente", uturn: "o retorno",
};

interface ManobraOsrm { type?: string; modifier?: string; exit?: number; location?: [number, number] }
interface PassoOsrm { maneuver?: ManobraOsrm; name?: string; distance?: number }

function instrucao(p: PassoOsrm): string {
  const m = p.maneuver ?? {};
  const lado = LADO[m.modifier ?? ""] ?? "";
  const via = p.name ? ` na ${p.name}` : "";
  const para = p.name ? ` para a ${p.name}` : "";
  switch (m.type) {
    case "depart": return `Siga${lado && lado !== "em frente" ? " " + lado : ""}${via}`;
    case "arrive": return "Você chegou ao ponto de encontro";
    case "roundabout": case "rotary":
      return `Na rotatória, pegue a ${m.exit ?? 1}ª saída${para}`;
    case "exit roundabout": case "exit rotary": return `Saia da rotatória${para}`;
    case "fork": return `Na bifurcação, mantenha-se ${lado || "em frente"}${para}`;
    case "merge": return `Entre ${lado}${para}`.replace("  ", " ");
    case "on ramp": return `Pegue o acesso ${lado}${para}`.replace("  ", " ");
    case "off ramp": return `Pegue a saída ${lado}${para}`.replace("  ", " ");
    case "end of road": return `No fim da via, vire ${lado}${para}`;
    case "new name": case "continue":
      if (m.modifier === "uturn") return `Faça o retorno${para}`;
      if (!lado || lado === "em frente") return `Continue em frente${via}`;
      return `Mantenha-se ${lado}${via}`;
    default:
      if (m.modifier === "uturn") return `Faça o retorno${para}`;
      if (!lado || lado === "em frente") return `Siga em frente${via}`;
      return `Vire ${lado}${para}`;
  }
}

/** Rota de carro pelas ruas, com os passos da navegação. */
export async function buscarRota(de: Ponto, ate: Ponto): Promise<Rota> {
  try {
    const url = `${ROTEADOR}/${de.lng},${de.lat};${ate.lng},${ate.lat}?overview=full&geometries=geojson&steps=true`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = await resp.json();
    const r = j?.routes?.[0];
    if (!r) throw new Error("sem rota");
    const passos: Passo[] = [];
    for (const leg of r.legs ?? []) {
      for (const s of (leg.steps ?? []) as PassoOsrm[]) {
        const loc = s.maneuver?.location;
        if (!loc) continue;
        passos.push({ texto: instrucao(s), local: { lat: loc[1], lng: loc[0] }, metros: s.distance ?? 0 });
      }
    }
    return {
      km: r.distance / 1000, min: Math.max(1, Math.round(r.duration / 60)),
      linha: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]),
      passos, estimada: false,
    };
  } catch {
    const km = retaKm(de, ate) * 1.35;          // ruas costumam ser ~35% mais longas que a reta
    return {
      km, min: Math.max(1, Math.round((km / 25) * 60)),
      linha: [[de.lat, de.lng], [ate.lat, ate.lng]],
      passos: [{ texto: "Siga até o ponto de encontro", local: de, metros: km * 1000 }, { texto: "Você chegou ao ponto de encontro", local: ate, metros: 0 }],
      estimada: true,
    };
  }
}

/** Menor distância (km) entre um ponto e a linha da rota. */
export function distanciaDaRota(p: Ponto, linha: [number, number][]): number {
  let min = Infinity;
  for (const [lat, lng] of linha) min = Math.min(min, retaKm(p, { lat, lng }));
  return min;
}

export const fmtKm = (km: number) => (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1).replace(".", ",")} km`);
export const fmtMin = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
export const horaChegada = (m: number) =>
  new Date(Date.now() + m * 60000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

/**
 * Minha posição (GPS do aparelho) e a da outra pessoa, ao vivo.
 * Só compartilha enquanto o componente estiver na tela.
 */
export function useEncontroAoVivo(requestId?: string) {
  const { user, updateLocation } = useAuth();
  const [eu, setEu] = useState<PosicaoAoVivo | null>(null);
  const [outro, setOutro] = useState<PosicaoAoVivo | null>(null);
  const [erroGps, setErroGps] = useState("");
  const [aoVivo, setAoVivo] = useState(false);       // canal em tempo real conectado?
  const canalRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const conectado = useRef(false);
  const ultimoEnvio = useRef<{ t: number; p: Ponto } | null>(null);
  const ultimaGravacao = useRef(0);

  /* GPS do aparelho */
  useEffect(() => {
    if (!navigator.geolocation) { setErroGps("Este aparelho não informa a localização."); return; }
    const recebe = (p: GeolocationPosition) => {
      const pos: PosicaoAoVivo = {
        lat: p.coords.latitude, lng: p.coords.longitude,
        rumo: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null, quando: Date.now(),
      };
      setEu(pos); setErroGps("");
      // repassa ao vivo para a outra pessoa: a cada 4 s ou ao andar 25 m
      const u = ultimoEnvio.current;
      if (canalRef.current && conectado.current && (!u || Date.now() - u.t > 4000 || retaKm(u.p, pos) > 0.025)) {
        ultimoEnvio.current = { t: Date.now(), p: pos };
        canalRef.current.send({ type: "broadcast", event: "pos", payload: { de: user?.id, lat: pos.lat, lng: pos.lng, rumo: pos.rumo } }).catch(() => {});
      }
      // grava a posição de tempos em tempos (reserva, caso o tempo real caia)
      if (Date.now() - ultimaGravacao.current > 30000) {
        ultimaGravacao.current = Date.now();
        updateLocation(pos.lat, pos.lng).catch(() => {});
      }
    };
    const falha = (e: GeolocationPositionError) => {
      if (e.code === e.PERMISSION_DENIED) setErroGps("Permita o acesso à localização para ver a rota.");
    };
    navigator.geolocation.getCurrentPosition(recebe, falha, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
    const id = navigator.geolocation.watchPosition(recebe, falha, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [updateLocation, user?.id]);

  /* canal em tempo real */
  useEffect(() => {
    if (!requestId || !user?.id) return;
    let vivo = true;
    (async () => {
      try { await supabase.realtime.setAuth(); } catch { /* segue com o token atual */ }
      if (!vivo) return;
      const canal = supabase.channel(`rota:${requestId}`, { config: { private: true, broadcast: { self: false } } });
      canalRef.current = canal;
      canal.on("broadcast", { event: "pos" }, ({ payload }) => {
        const p = payload as { de?: string; lat?: number; lng?: number; rumo?: number | null };
        if (!p || p.de === user.id || typeof p.lat !== "number" || typeof p.lng !== "number") return;
        setOutro({ lat: p.lat, lng: p.lng, rumo: p.rumo ?? null, quando: Date.now() });
      });
      canal.subscribe((st) => {
        if (!vivo) return;
        conectado.current = st === "SUBSCRIBED";
        setAoVivo(conectado.current);
        if (conectado.current) ultimoEnvio.current = null;   // manda a minha posição na próxima leitura do GPS
      });
    })();
    return () => {
      vivo = false;
      conectado.current = false;
      if (canalRef.current) supabase.removeChannel(canalRef.current);
      canalRef.current = null;
      setAoVivo(false);
    };
  }, [requestId, user?.id]);

  /* reserva: última posição gravada da outra pessoa, a cada 30 s (quando não há sinal ao vivo recente) */
  useEffect(() => {
    if (!requestId) return;
    let vivo = true;
    const ler = async () => {
      const { data, error } = await supabase.rpc("service_other_position", { p_request_id: requestId });
      const p = data as { lat?: number | null; lng?: number | null } | null;
      if (!vivo || error || !p?.lat || !p?.lng) return;
      setOutro((atual) => (atual && Date.now() - atual.quando < 45000 ? atual : { lat: p.lat!, lng: p.lng!, rumo: null, quando: Date.now() - 30000 }));
    };
    ler();
    const t = setInterval(ler, 30000);
    return () => { vivo = false; clearInterval(t); };
  }, [requestId]);

  return { eu, outro, erroGps, aoVivo };
}
