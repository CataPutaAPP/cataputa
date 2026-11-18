import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Navigation, Clock, Loader2, MapPin, Car, X, Volume2, VolumeX, LocateFixed, Radio, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBackClose } from "@/lib/back";
import {
  buscarRota, distanciaDaRota, fmtKm, fmtMin, horaChegada, retaKm, useEncontroAoVivo,
  type Ponto, type PosicaoAoVivo, type Rota,
} from "@/lib/encontro";

/**
 * Rota até o ponto de encontro e acompanhamento ao vivo das duas pessoas.
 *  - Quem se desloca vê o trajeto, o tempo, a hora de chegada e pode abrir a navegação
 *    em tela cheia (instrução da próxima curva, com voz, recalculando se sair da rota).
 *  - Quem espera no local vê a outra pessoa se aproximando no mapa, com o tempo até chegar.
 */

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

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

const linkWaze = (d: Ponto) => `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`;
const linkGoogle = (d: Ponto) => `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lng}&travelmode=driving&dir_action=navigate`;

/* ─── Mapa ─────────────────────────────────────────────────────────── */
function MapaRota({ destino, eu, outro, linhaEu, linhaOutro, seguir, onArrastar, className }: {
  destino: Ponto; eu: PosicaoAoVivo | null; outro: PosicaoAoVivo | null;
  linhaEu?: [number, number][] | null | undefined; linhaOutro?: [number, number][] | null | undefined;
  seguir?: Ponto | null | undefined; onArrastar?: (() => void) | undefined; className?: string | undefined;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<any>(null);
  const camada = useRef<any>(null);
  const [pronto, setPronto] = useState(false);
  const [semMapa, setSemMapa] = useState(false);
  const ajustou = useRef(false);
  const arrastar = useRef(onArrastar);
  arrastar.current = onArrastar;

  useEffect(() => {
    let vivo = true;
    carregarLeaflet().then((L) => {
      if (!vivo || !caixa.current || mapa.current) return;
      mapa.current = L.map(caixa.current, { zoomControl: false, attributionControl: false }).setView([destino.lat, destino.lng], 15);
      L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(mapa.current);
      camada.current = L.layerGroup().addTo(mapa.current);
      mapa.current.on("dragstart", () => arrastar.current?.());
      setPronto(true);
    }).catch(() => { if (vivo) setSemMapa(true); });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const L = (window as any).L;
    if (!pronto || !L || !mapa.current || !camada.current) return;
    camada.current.clearLayers();
    const pontos: [number, number][] = [[destino.lat, destino.lng]];
    if (linhaOutro?.length) { L.polyline(linhaOutro, { color: "#22c55e", weight: 4, opacity: 0.75, dashArray: "6 8" }).addTo(camada.current); pontos.push(...linhaOutro); }
    if (linhaEu?.length) { L.polyline(linhaEu, { color: "#D8B890", weight: 6, opacity: 0.95 }).addTo(camada.current); pontos.push(...linhaEu); }
    L.marker([destino.lat, destino.lng], {
      icon: L.divIcon({ className: "", iconSize: [30, 30], iconAnchor: [15, 28],
        html: '<div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#B17078;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"><span style="transform:rotate(45deg);color:#fff;font:700 13px sans-serif">P</span></div>' }),
    }).addTo(camada.current);
    const seta = (p: PosicaoAoVivo, cor: string) => L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13],
        html: p.rumo != null
          ? `<div style="width:26px;height:26px;transform:rotate(${p.rumo}deg)"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M12 2 L20 21 L12 16.5 L4 21 Z" fill="${cor}" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg></div>`
          : `<div style="width:18px;height:18px;margin:4px;border-radius:50%;background:${cor};border:3px solid #fff;box-shadow:0 0 0 6px ${cor}33"></div>` }),
      zIndexOffset: 500,
    }).addTo(camada.current);
    if (outro) { seta(outro, "#22c55e"); pontos.push([outro.lat, outro.lng]); }
    if (eu) { seta(eu, "#3b82f6"); pontos.push([eu.lat, eu.lng]); }

    if (seguir) {
      mapa.current.setView([seguir.lat, seguir.lng], Math.max(mapa.current.getZoom(), 16), { animate: true });
    } else if (pontos.length > 1 && !ajustou.current) {
      mapa.current.fitBounds(L.latLngBounds(pontos), { padding: [30, 30], maxZoom: 16 });
      if (linhaEu?.length || linhaOutro?.length) ajustou.current = true;   // só enquadra uma vez; depois o usuário mexe à vontade
    }
  }, [pronto, destino.lat, destino.lng, eu, outro, linhaEu, linhaOutro, seguir]);

  useEffect(() => { ajustou.current = false; }, [linhaEu?.length, linhaOutro?.length]);
  useEffect(() => { const t = setTimeout(() => mapa.current?.invalidateSize(), 250); return () => clearTimeout(t); }, [className]);

  if (semMapa) return null;
  return (
    <div className={`sh-dark-tiles overflow-hidden ${className ?? ""}`}>
      <div ref={caixa} className="size-full bg-secondary" aria-label="Mapa com a rota até o ponto de encontro" />
    </div>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ─── Rota que se atualiza conforme a pessoa anda ─────────────────── */
function useRotaViva(de: Ponto | null, destino: Ponto, ativo: boolean) {
  const [rota, setRota] = useState<Rota | null>(null);
  const ultima = useRef<{ de: Ponto; quando: number } | null>(null);
  const [forcar, setForcar] = useState(0);

  useEffect(() => {
    if (!ativo || !de) return;
    const u = ultima.current;
    if (u && retaKm(u.de, de) < 0.15 && Date.now() - u.quando < 60000) return;
    ultima.current = { de, quando: Date.now() };
    let vivo = true;
    buscarRota(de, destino).then((r) => { if (vivo) setRota(r); });
    return () => { vivo = false; };
  }, [de, destino.lat, destino.lng, ativo, forcar]); // eslint-disable-line react-hooks/exhaustive-deps

  const recalcular = useCallback(() => { ultima.current = null; setForcar((n) => n + 1); }, []);
  return { rota, recalcular };
}

/* ─── Cartão no atendimento ───────────────────────────────────────── */
export function RouteCard({ destino, requestId, otherName, viajo = true, outroViaja = false }: {
  destino: Ponto; requestId?: string; otherName?: string;
  /** eu me desloco até o ponto? */
  viajo?: boolean;
  /** a outra pessoa se desloca até o ponto? */
  outroViaja?: boolean;
}) {
  const { eu, outro, erroGps, aoVivo } = useEncontroAoVivo(requestId);
  const { rota, recalcular } = useRotaViva(eu, destino, viajo);
  const { rota: rotaOutro } = useRotaViva(outro, destino, outroViaja);
  const [telaCheia, setTelaCheia] = useState(false);

  const quem = otherName?.trim().split(" ")[0] || "A outra pessoa";
  const cheguei = viajo && !!eu && retaKm(eu, destino) < 0.06;
  const outroChegou = outroViaja && !!outro && retaKm(outro, destino) < 0.06;
  const outroRecente = !!outro && Date.now() - outro.quando < 60000;

  return (
    <div className="mt-3">
      {/* resumo primeiro, para nunca ficar escondido pelo rodapé */}
      <div className="rounded-xl bg-secondary/60 px-3 py-2.5">
        {viajo && (erroGps ? (
          <p className="text-xs text-muted-foreground">{erroGps}</p>
        ) : cheguei ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-primary"><MapPin className="size-4" /> Você está no ponto de encontro</p>
        ) : !rota ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Calculando a rota…</p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-lg font-bold leading-tight"><Car className="size-4 text-primary" /> {fmtMin(rota.min)}</p>
              <p className="text-xs text-muted-foreground">{fmtKm(rota.km)} de carro{rota.estimada ? " (estimativa)" : ""}</p>
            </div>
            <div className="text-right">
              <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground"><Clock className="size-3.5" /> Chegada</p>
              <p className="text-base font-semibold">{horaChegada(rota.min)}</p>
            </div>
          </div>
        ))}

        {outroViaja && (
          <div className={viajo ? "mt-2 border-t border-border pt-2" : ""}>
            {outroChegou ? (
              <p className="text-sm font-semibold text-primary">{quem} chegou ao ponto de encontro.</p>
            ) : outro && rotaOutro ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm"><span className="font-semibold">{quem}</span> está a <span className="font-semibold">{fmtMin(rotaOutro.min)}</span> ({fmtKm(rotaOutro.km)})</p>
                {!viajo && <p className="shrink-0 text-xs text-muted-foreground">chega {horaChegada(rotaOutro.min)}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Aguardando a localização de {quem}…</p>
            )}
          </div>
        )}

        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Radio className={`size-3 ${aoVivo && outroRecente ? "text-green-500" : ""}`} />
          {aoVivo ? (outroRecente ? "Acompanhando ao vivo" : "Ao vivo — aguardando o sinal da outra pessoa") : "Atualiza a cada 30 segundos"}
        </p>
      </div>

      <button type="button" onClick={() => setTelaCheia(true)} className="relative mt-3 block w-full text-left" aria-label="Abrir a navegação em tela cheia">
        <MapaRota destino={destino} eu={eu} outro={outro} linhaEu={viajo ? rota?.linha : null} linhaOutro={outroViaja ? rotaOutro?.linha : null}
          className="pointer-events-none h-48 rounded-xl border border-border" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
          <Maximize2 className="size-3" /> Tela cheia
        </span>
      </button>

      <Button className="mt-3 h-11 w-full" onClick={() => setTelaCheia(true)}>
        <Navigation className="mr-2 size-4" /> {viajo ? "Navegar até o ponto" : `Acompanhar ${quem} no mapa`}
      </Button>
      {viajo && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary" href={linkWaze(destino)} target="_blank" rel="noreferrer">
            <Navigation className="size-4" /> Waze
          </a>
          <a className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary" href={linkGoogle(destino)} target="_blank" rel="noreferrer">
            <Navigation className="size-4" /> Google Maps
          </a>
        </div>
      )}

      {/* tela cheia fora da janela do atendimento, por cima de tudo */}
      {telaCheia && typeof document !== "undefined" && createPortal(
        <Navegacao destino={destino} eu={eu} outro={outro} rota={viajo ? rota : null} rotaOutro={outroViaja ? rotaOutro : null}
          quem={quem} viajo={viajo} aoVivo={aoVivo} onRecalcular={recalcular} onClose={() => setTelaCheia(false)} />,
        document.body,
      )}
    </div>
  );
}

/* ─── Navegação em tela cheia ─────────────────────────────────────── */
function falar(texto: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR"; u.rate = 1.02;
    s.speak(u);
  } catch { /* aparelho sem voz */ }
}

function Navegacao({ destino, eu, outro, rota, rotaOutro, quem, viajo, aoVivo, onRecalcular, onClose }: {
  destino: Ponto; eu: PosicaoAoVivo | null; outro: PosicaoAoVivo | null; rota: Rota | null; rotaOutro: Rota | null;
  quem: string; viajo: boolean; aoVivo: boolean; onRecalcular: () => void; onClose: () => void;
}) {
  useBackClose(true, onClose);
  const [seguindo, setSeguindo] = useState(true);
  const [voz, setVoz] = useState(true);
  const [proximo, setProximo] = useState(1);
  const avisos = useRef<Set<string>>(new Set());
  const ultimoDesvio = useRef(0);

  // tela acesa enquanto navega
  useEffect(() => {
    let trava: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((t) => { trava = t; }).catch(() => {});
    return () => { trava?.release().catch(() => {}); window.speechSynthesis?.cancel(); };
  }, []);

  // rota nova: recomeça da primeira manobra
  useEffect(() => { setProximo(1); avisos.current.clear(); }, [rota]);

  // avança as manobras e recalcula se sair da rota
  const passos = rota?.passos ?? [];
  const passo = passos[Math.min(proximo, passos.length - 1)];
  const distPasso = eu && passo ? retaKm(eu, passo.local) : null;

  useEffect(() => {
    if (!viajo || !eu || !rota || passos.length < 2) return;
    let i = proximo;
    while (i < passos.length - 1 && retaKm(eu, passos[i]!.local) < 0.03) i++;
    if (i !== proximo) setProximo(i);
    if (!rota.estimada && distanciaDaRota(eu, rota.linha) > 0.06 && Date.now() - ultimoDesvio.current > 15000) {
      ultimoDesvio.current = Date.now();
      if (voz) falar("Recalculando a rota");
      onRecalcular();
    }
  }, [eu]); // eslint-disable-line react-hooks/exhaustive-deps

  // voz: primeira instrução, aviso a 150 m e na hora da manobra
  useEffect(() => {
    if (!viajo || !voz || !passo || distPasso == null) return;
    const chave = `${rota?.linha.length}-${proximo}`;
    if (!avisos.current.has(`ini-${rota?.linha.length}`)) {
      avisos.current.add(`ini-${rota?.linha.length}`);
      falar(proximo >= passos.length - 1 ? passo.texto : `Em ${fmtKm(distPasso).replace("km", "quilômetros").replace(" m", " metros")}, ${passo.texto.toLowerCase()}`);
      return;
    }
    if (distPasso < 0.04 && !avisos.current.has(`agora-${chave}`)) { avisos.current.add(`agora-${chave}`); falar(passo.texto); }
    else if (distPasso < 0.15 && !avisos.current.has(`perto-${chave}`)) { avisos.current.add(`perto-${chave}`); falar(`Em ${Math.round(distPasso * 100) * 10} metros, ${passo.texto.toLowerCase()}`); }
  }, [distPasso, proximo, voz, viajo]); // eslint-disable-line react-hooks/exhaustive-deps

  // quanto falta (a partir da manobra atual)
  let faltaKm: number | null = null;
  let faltaMin: number | null = null;
  if (viajo && rota && eu && distPasso != null) {
    faltaKm = distPasso + passos.slice(proximo).reduce((s, p) => s + p.metros, 0) / 1000;
    faltaMin = Math.max(1, Math.round(rota.min * (rota.km > 0 ? faltaKm / rota.km : 1)));
  }
  const cheguei = viajo && !!eu && retaKm(eu, destino) < 0.06;
  const centro = seguindo ? (viajo ? eu : outro) : null;

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-background">
      <MapaRota destino={destino} eu={eu} outro={outro} linhaEu={rota?.linha} linhaOutro={rotaOutro?.linha}
        seguir={centro} onArrastar={() => setSeguindo(false)} className="absolute inset-0" />

      {/* topo: próxima manobra */}
      <div className="relative z-10 m-3 mt-[calc(0.75rem+env(safe-area-inset-top))] rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {viajo ? (
              cheguei ? <p className="text-lg font-bold text-primary">Você chegou ao ponto de encontro</p>
              : !rota ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Calculando a rota…</p>
              : (
                <>
                  <p className="text-2xl font-bold leading-none">{distPasso != null ? fmtKm(distPasso) : ""}</p>
                  <p className="mt-1 text-base font-semibold leading-snug">{passo?.texto}</p>
                  {passos[proximo + 1] && (
                    <p className="mt-1 truncate text-xs text-muted-foreground">Depois: {passos[proximo + 1]?.texto}</p>
                  )}
                </>
              )
            ) : (
              <p className="text-base font-semibold">
                {outro && rotaOutro ? `${quem} está a ${fmtMin(rotaOutro.min)} (${fmtKm(rotaOutro.km)})` : `Aguardando a localização de ${quem}…`}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <Button size="icon" variant="secondary" onClick={onClose} aria-label="Fechar"><X className="size-5" /></Button>
            {viajo && (
              <Button size="icon" variant="secondary" onClick={() => { setVoz((v) => !v); window.speechSynthesis?.cancel(); }} aria-label={voz ? "Desligar voz" : "Ligar voz"}>
                {voz ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {!seguindo && (
        <Button size="sm" variant="secondary" className="absolute bottom-40 right-3 z-10 shadow-lg" onClick={() => setSeguindo(true)}>
          <LocateFixed className="mr-1.5 size-4" /> Recentralizar
        </Button>
      )}

      {/* rodapé: tempo, chegada e a outra pessoa */}
      <div className="relative z-10 mt-auto m-3 mb-[calc(0.75rem+env(safe-area-inset-bottom))] rounded-2xl bg-card/95 p-3 shadow-lg backdrop-blur">
        {viajo && faltaMin != null && faltaKm != null && !cheguei && (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xl font-bold leading-none">{fmtMin(faltaMin)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{fmtKm(faltaKm)}{rota?.estimada ? " · estimativa" : ""}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Chegada</p>
              <p className="text-lg font-semibold leading-none">{horaChegada(faltaMin)}</p>
            </div>
          </div>
        )}
        {viajo && outro && (
          <p className="mt-2 text-xs text-muted-foreground">
            {rotaOutro ? `${quem} está a ${fmtMin(rotaOutro.min)} do ponto.` : `${quem} aparece em verde no mapa.`}
          </p>
        )}
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Radio className={`size-3 ${aoVivo ? "text-green-500" : ""}`} /> {aoVivo ? "Ao vivo" : "Atualiza a cada 30 segundos"}
        </p>
        {viajo && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium" href={linkWaze(destino)} target="_blank" rel="noreferrer">
              <Navigation className="size-4" /> Abrir no Waze
            </a>
            <a className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium" href={linkGoogle(destino)} target="_blank" rel="noreferrer">
              <Navigation className="size-4" /> Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
