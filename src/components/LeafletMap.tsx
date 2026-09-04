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
  popup?: string;
  onClick?: () => void;
}

interface LeafletMapProps {
  /** Called whenever user coords update */
  onCoordsChange?: (coords: MapCoords) => void;
  /** Markers to render on the map */
  markers?: MapMarker[];
  /** Radius circle in km (0 = no circle) */
  radiusKm?: number;
  /** Whether to show geolocation error banner */
  showGeoError?: boolean;
  /** Extra class for the container */
  className?: string;
  /** Overlay content rendered on top of the map */
  children?: ReactNode;
}

/* ─── Leaflet loader ────────────────────────────────────────────────── */

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }

    // Load CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
    }

    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => resolve((window as any).L);
    script.onerror = () => {
      leafletPromise = null;
      reject(new Error("Falha ao carregar o mapa"));
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function LeafletMap({
  onCoordsChange,
  markers = [],
  radiusKm = 0,
  showGeoError = true,
  className = "",
  children,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const markerLayerRef = useRef<any[]>([]);
  const LRef = useRef<any>(null);

  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // ── Geolocation ──────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Seu navegador não suporta geolocalização.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(newCoords);
        setGeoError(null);
        onCoordsChange?.(newCoords);
      },
      (err) => {
        setGeoError("Permita acesso à localização para usar o mapa.");
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onCoordsChange]);

  // ── Init map ─────────────────────────────────────────────────
  useEffect(() => {
    if (!coords || !containerRef.current) return;

    let cancelled = false;

    loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;
      LRef.current = L;

      if (!mapInstanceRef.current) {
        const map = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([coords.lat, coords.lng], 14);

        // Free dark tiles — no API key
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            subdomains: "abcd",
          },
        ).addTo(map);

        // User marker (purple pulsating dot)
        const userIcon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:20px;height:20px;">
              <div style="position:absolute;inset:0;background:rgba(124,58,237,0.3);border-radius:50%;animation:pulse-ring 2s ease-out infinite;"></div>
              <div style="position:absolute;inset:3px;background:#7c3aed;border:3px solid #fff;border-radius:50%;box-shadow:0 0 12px rgba(124,58,237,0.6);"></div>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        userMarkerRef.current = L.marker([coords.lat, coords.lng], {
          icon: userIcon,
          zIndexOffset: 1000,
        }).addTo(map);

        // Inject pulse animation
        if (!document.getElementById("leaflet-pulse-css")) {
          const style = document.createElement("style");
          style.id = "leaflet-pulse-css";
          style.textContent = `
            @keyframes pulse-ring {
              0% { transform: scale(1); opacity: 1; }
              100% { transform: scale(3); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
        }

        mapInstanceRef.current = map;
        setMapReady(true);
      } else {
        // Update user position
        mapInstanceRef.current.setView([coords.lat, coords.lng]);
        userMarkerRef.current?.setLatLng([coords.lat, coords.lng]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [coords]);

  // ── Radius circle ────────────────────────────────────────────
  useEffect(() => {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map || !coords) return;

    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }

    if (radiusKm > 0) {
      radiusCircleRef.current = L.circle([coords.lat, coords.lng], {
        radius: radiusKm * 1000,
        color: "#7c3aed",
        fillColor: "#7c3aed",
        fillOpacity: 0.06,
        weight: 1.5,
        dashArray: "6 4",
      }).addTo(map);
    }
  }, [coords, radiusKm, mapReady]);

  // ── Custom markers ───────────────────────────────────────────
  useEffect(() => {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Clear old markers
    markerLayerRef.current.forEach((m) => m.remove());
    markerLayerRef.current = [];

    markers.forEach((m) => {
      const color = m.color ?? "#22c55e";
      const size = m.size ?? 12;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid rgba(255,255,255,0.9);border-radius:50%;box-shadow:0 0 8px ${color}80;"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });

      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);

      if (m.popup) {
        marker.bindPopup(m.popup, {
          className: "dark-popup",
          closeButton: false,
        });
      }

      if (m.onClick) {
        marker.on("click", m.onClick);
      }

      markerLayerRef.current.push(marker);
    });

    // Inject popup styles
    if (!document.getElementById("leaflet-popup-css")) {
      const style = document.createElement("style");
      style.id = "leaflet-popup-css";
      style.textContent = `
        .dark-popup .leaflet-popup-content-wrapper {
          background: hsl(240 6% 10%);
          color: hsl(240 5% 90%);
          border: 1px solid hsl(240 4% 20%);
          border-radius: 12px;
          font-family: inherit;
          font-size: 13px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        }
        .dark-popup .leaflet-popup-tip {
          background: hsl(240 6% 10%);
          border: 1px solid hsl(240 4% 20%);
        }
      `;
      document.head.appendChild(style);
    }
  }, [markers, mapReady]);

  // ── Public: center map on user ───────────────────────────────
  const centerOnUser = useCallback(() => {
    if (coords && mapInstanceRef.current) {
      mapInstanceRef.current.setView([coords.lat, coords.lng], 14, {
        animate: true,
      });
    }
  }, [coords]);

  return (
    <div className={`relative ${className}`}>
      {/* Map container */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        style={{ background: "#0a0a12" }}
      />

      {/* Loading state */}
      {!mapReady && !geoError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#0a0a12]">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando mapa...</p>
        </div>
      )}

      {/* Geo error banner */}
      {showGeoError && geoError && (
        <div className="absolute inset-x-4 top-4 z-40 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-center text-sm text-destructive backdrop-blur-md">
          <MapPin className="mb-1 inline size-4" /> {geoError}
        </div>
      )}

      {/* Overlay children — pass coords and centerOnUser via render prop pattern isn't great here,
          so we expose them through a context-like approach. For simplicity, children just overlay. */}
      {children}
    </div>
  );
}

/* ─── Hook: use the map instance from outside ──────────────────────── */

export function useMapCenter() {
  // Thin wrapper — components that need to center can call this
  // For now it's a placeholder; in a real app we'd use a context
  return {
    center: () => {
      // Dispatched via custom event
      window.dispatchEvent(new CustomEvent("map:center"));
    },
  };
}
