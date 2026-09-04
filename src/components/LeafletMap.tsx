import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { MapPin, Loader2 } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface MapCoords {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  size?: number;
  onClick?: () => void;
}

interface LeafletMapProps {
  onCoordsChange?: (coords: MapCoords) => void;
  markers?: MapMarker[];
  radiusKm?: number;
  children?: ReactNode;
}

/* ─── Leaflet loader ────────────────────────────────────────────────── */

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

// Free OSM tiles — no API key ever
const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function ensureLeafletCSS() {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

function ensureCustomCSS() {
  if (document.getElementById("sh-map-css")) return;
  const style = document.createElement("style");
  style.id = "sh-map-css";
  style.textContent = `
    /* Dark mode: invert OSM tiles */
    .sh-dark-tiles .leaflet-tile-pane {
      filter: invert(1) hue-rotate(180deg) brightness(0.65) contrast(1.2) saturate(0.3);
    }
    /* Keep markers and overlays normal (un-invert) */
    .sh-dark-tiles .leaflet-marker-pane,
    .sh-dark-tiles .leaflet-shadow-pane,
    .sh-dark-tiles .leaflet-overlay-pane {
      filter: none;
    }
    .sh-dark-tiles .leaflet-container {
      background: #0a0a12 !important;
    }
    @keyframes sh-pulse {
      0%   { transform: scale(1); opacity: .7; }
      100% { transform: scale(3.5); opacity: 0; }
    }
    .sh-dot-ring { animation: sh-pulse 2s ease-out infinite; }
    .dark-popup .leaflet-popup-content-wrapper {
      background: hsl(240 6% 10%);
      color: hsl(240 5% 90%);
      border: 1px solid hsl(240 4% 20%);
      border-radius: 12px;
      font-size: 13px;
      box-shadow: 0 8px 32px rgba(0,0,0,.5);
    }
    .dark-popup .leaflet-popup-tip {
      background: hsl(240 6% 10%);
      border: 1px solid hsl(240 4% 20%);
    }
  `;
  document.head.appendChild(style);
}

function loadLeafletJS(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }
    const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`);
    if (existing) {
      const check = setInterval(() => {
        if ((window as any).L) { clearInterval(check); resolve((window as any).L); }
      }, 100);
      setTimeout(() => { clearInterval(check); reject(new Error("Leaflet timeout")); }, 10000);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => (window as any).L ? resolve((window as any).L) : reject(new Error("L not found"));
    script.onerror = () => reject(new Error("Script load failed"));
    document.head.appendChild(script);
  });
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function LeafletMap({ onCoordsChange, markers = [], radiusKm = 0, children }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const markerLayerRef = useRef<any[]>([]);
  const Lref = useRef<any>(null);

  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);

  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  /* ── Geolocation ──────────────────────────────────────── */
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Seu navegador não suporta geolocalização.");
      setLoading(false);
      return;
    }
    const wid = navigator.geolocation.watchPosition(
      (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setCoords(c);
        setGeoError(null);
        onCoordsChange?.(c);
      },
      () => {
        setGeoError("Permita o acesso à localização para ver o mapa.");
        setLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(wid);
  }, []);

  /* ── Init map ─────────────────────────────────────────── */
  useEffect(() => {
    if (!coords || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    ensureLeafletCSS();
    ensureCustomCSS();

    loadLeafletJS()
      .then((L) => {
        if (cancelled || !containerRef.current) return;
        Lref.current = L;

        // Fix default icon paths
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
          iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
          shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        });

        const map = L.map(containerRef.current, {
          center: [coords.lat, coords.lng],
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
        });

        L.tileLayer(TILE_URL, {
          maxZoom: 19,
          attribution: "",
        }).addTo(map);

        // User dot
        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:22px;height:22px">
              <div class="sh-dot-ring" style="position:absolute;inset:0;background:rgba(124,58,237,.3);border-radius:50%"></div>
              <div style="position:absolute;inset:4px;background:#7c3aed;border:3px solid #fff;border-radius:50%;box-shadow:0 0 14px rgba(124,58,237,.6)"></div>
            </div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        userMarkerRef.current = L.marker([coords.lat, coords.lng], { icon, zIndexOffset: 1000 }).addTo(map);

        mapRef.current = map;
        setLoading(false);
        setTimeout(() => map.invalidateSize(), 200);
      })
      .catch((err) => {
        console.error("LeafletMap:", err);
        setMapError("Não foi possível carregar o mapa.");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [coords]);

  /* ── Update user position ────────────────────────────── */
  useEffect(() => {
    if (!coords || !mapRef.current || !userMarkerRef.current) return;
    userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
  }, [coords]);

  /* ── Radius circle ───────────────────────────────────── */
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!L || !map || !coords) return;

    if (circleRef.current) { circleRef.current.remove(); circleRef.current = null; }

    if (radiusKm > 0) {
      circleRef.current = L.circle([coords.lat, coords.lng], {
        radius: radiusKm * 1000,
        color: "#7c3aed",
        fillColor: "#7c3aed",
        fillOpacity: 0.06,
        weight: 1.5,
        dashArray: "6 4",
      }).addTo(map);
    }
  }, [coords, radiusKm]);

  /* ── Custom markers ──────────────────────────────────── */
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!L || !map) return;

    markerLayerRef.current.forEach((m) => m.remove());
    markerLayerRef.current = [];

    markers.forEach((m) => {
      const c = m.color ?? "#22c55e";
      const sz = m.size ?? 12;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${sz}px;height:${sz}px;background:${c};border:2px solid rgba(255,255,255,.9);border-radius:50%;box-shadow:0 0 8px ${c}80;cursor:pointer"></div>`,
        iconSize: [sz, sz],
        iconAnchor: [sz / 2, sz / 2],
      });
      const mk = L.marker([m.lat, m.lng], { icon }).addTo(map);
      if (m.onClick) mk.on("click", m.onClick);
      markerLayerRef.current.push(mk);
    });
  }, [markers]);

  /* ── Center on user (via event) ──────────────────────── */
  const centerOnUser = useCallback(() => {
    const c = coordsRef.current;
    if (c && mapRef.current) mapRef.current.setView([c.lat, c.lng], 14, { animate: true });
  }, []);

  useEffect(() => {
    const h = () => centerOnUser();
    window.addEventListener("map:center", h);
    return () => window.removeEventListener("map:center", h);
  }, [centerOnUser]);

  /* ── Render ──────────────────────────────────────────── */
  return (
    <>
      {/* sh-dark-tiles class triggers the CSS invert filter on tiles only */}
      <div
        ref={containerRef}
        className="sh-dark-tiles"
        style={{ position: "absolute", inset: 0, zIndex: 0, background: "#0a0a12" }}
      />

      {loading && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#0a0a12" }}>
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando mapa…</p>
        </div>
      )}

      {geoError && (
        <div className="absolute inset-x-4 top-4 z-40 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-sm text-destructive backdrop-blur-md">
          <MapPin className="mb-1 inline size-4" /> {geoError}
        </div>
      )}

      {mapError && (
        <div style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "#0a0a12" }}>
          <MapPin className="size-8 text-destructive" />
          <p className="text-sm text-destructive">{mapError}</p>
        </div>
      )}

      {children}
    </>
  );
}
