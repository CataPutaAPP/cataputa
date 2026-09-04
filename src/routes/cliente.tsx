import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  MapPin,
  Plus,
  X,
  Navigation,
  Radar,
  Sparkles,
  Eye,
  Check,
  Loader2,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { LeafletMap, type MapCoords, type MapMarker } from "@/components/LeafletMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/AuthContext";
import type { ServiceRequest } from "@/types";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Painel do cliente — ServiHub" },
      {
        name: "description",
        content: "Solicite serviços, defina urgência e acompanhe suas solicitações ativas.",
      },
      { property: "og:title", content: "Painel do cliente — ServiHub" },
      { property: "og:description", content: "Solicite serviços e acompanhe o andamento." },
    ],
  }),
  component: ClienteDashboard,
});

/* ─── Data ──────────────────────────────────────────────────────────── */

type ServiceType = "massagem" | "acompanhante";

const serviceSubTypes: Record<ServiceType, { value: string; label: string }[]> = {
  massagem: [
    { value: "nuru", label: "Nuru" },
    { value: "quick", label: "Quick" },
    { value: "desportiva", label: "Desportiva" },
    { value: "relaxante", label: "Relaxante" },
    { value: "pedras_quentes", label: "Pedras Quentes" },
    { value: "tantrica", label: "Tântrica" },
  ],
  acompanhante: [
    { value: "rapidinha_carro", label: "Rapidinha no carro" },
    { value: "rapidinha_parceiro", label: "Rapidinha com parceiro" },
    { value: "1_hora", label: "1 hora" },
  ],
};

const genderOptions = [
  { value: "mulheres", label: "Mulheres" },
  { value: "homens", label: "Homens" },
  { value: "travesti", label: "Travesti" },
];

const extraFlags = [
  { value: "beijo_boca", label: "Beijo na boca" },
  { value: "oral_sem_capa", label: "Oral sem capa" },
  { value: "anal", label: "Anal" },
  { value: "podolatria", label: "Podolatria" },
  { value: "fetiche", label: "Fetiche" },
  { value: "inversao", label: "Inversão" },
  { value: "no_carro", label: "No carro" },
];

const radiusOptions = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
];

interface AvailableService {
  id: string;
  provider_name: string;
  service_type: ServiceType;
  sub_type: string;
  gender: string;
  rating: number;
  price: number;
  distance_km: number;
  lat: number;
  lng: number;
}

function generateMockServices(lat: number, lng: number): AvailableService[] {
  const names = ["Luna", "Valentina", "Isabela", "Camila", "Rafael", "Lucas", "Alexia", "Bianca", "Dani", "Chris"];
  const genders = ["mulheres", "homens", "travesti"];
  const types: ServiceType[] = ["massagem", "acompanhante"];

  return Array.from({ length: 8 }, (_, i) => {
    const type = types[i % 2];
    const subs = serviceSubTypes[type];
    const offsetLat = (Math.random() - 0.5) * 0.08;
    const offsetLng = (Math.random() - 0.5) * 0.08;
    return {
      id: `mock-${i}`,
      provider_name: names[i % names.length],
      service_type: type,
      sub_type: subs[Math.floor(Math.random() * subs.length)].value,
      gender: genders[Math.floor(Math.random() * genders.length)],
      rating: 3.5 + Math.random() * 1.5,
      price: 100 + Math.floor(Math.random() * 400),
      distance_km: 0.5 + Math.random() * 9.5,
      lat: lat + offsetLat,
      lng: lng + offsetLng,
    };
  });
}

/* ─── Component ─────────────────────────────────────────────────────── */

function ClienteDashboard() {
  return (
    <DashboardShell role="cliente">
      <ClienteContent />
    </DashboardShell>
  );
}

function ClienteContent() {
  const { user } = useAuth();

  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [view, setView] = useState<"map" | "request" | "available">("map");
  const [radius, setRadius] = useState(5);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [availableServices, setAvailableServices] = useState<AvailableService[]>([]);
  const [selectedService, setSelectedService] = useState<AvailableService | null>(null);

  // Form
  const [serviceType, setServiceType] = useState<ServiceType | "">("");
  const [subType, setSubType] = useState("");
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [wantsPartner, setWantsPartner] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleCoordsChange = useCallback((c: MapCoords) => {
    setCoords(c);
  }, []);

  // Generate mock services
  useEffect(() => {
    if (coords) {
      setAvailableServices(generateMockServices(coords.lat, coords.lng));
    }
  }, [coords?.lat, coords?.lng]);

  // Reset sub-type when service type changes
  useEffect(() => {
    setSubType("");
  }, [serviceType]);

  // Build map markers from available services
  const mapMarkers: MapMarker[] = availableServices
    .filter((s) => s.distance_km <= radius)
    .map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      color: s.service_type === "massagem" ? "#22c55e" : "#eab308",
      size: 12,
      onClick: () => setSelectedService(s),
    }));

  function toggleMulti(arr: string[], setArr: (v: string[]) => void, value: string) {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  }

  function resetForm() {
    setServiceType("");
    setSubType("");
    setSelectedGenders([]);
    setSelectedExtras([]);
    setWantsPartner(false);
  }

  async function handleSubmit() {
    if (!serviceType || !subType) {
      toast.error("Selecione o tipo e subtipo de serviço.");
      return;
    }
    if (selectedGenders.length === 0) {
      toast.error("Selecione ao menos uma preferência de gênero.");
      return;
    }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));

    const request: ServiceRequest = {
      id: crypto.randomUUID(),
      client_id: user?.id ?? "",
      client_name: user?.full_name ?? "Visitante",
      service_type: `${serviceType} — ${subType}`,
      description: `Gênero: ${selectedGenders.join(", ")}${selectedExtras.length ? ` | Extras: ${selectedExtras.join(", ")}` : ""}`,
      location: coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "N/D",
      urgency: "media",
      status: "aberta",
      wants_partner: wantsPartner,
      created_at: new Date().toISOString(),
    };
    setRequests((prev) => [request, ...prev]);
    setSubmitting(false);
    resetForm();
    setView("map");
    toast.success("Solicitação enviada! Prestadores no raio foram notificados.");
  }

  function getSubLabel(type: ServiceType, sub: string) {
    return serviceSubTypes[type]?.find((x) => x.value === sub)?.label ?? sub;
  }

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <main className="relative min-h-screen bg-[#0a0a12]">
      {/* Full-screen map */}
      <LeafletMap
        className="fixed inset-0"
        onCoordsChange={handleCoordsChange}
        markers={mapMarkers}
        radiusKm={radius}
      />

      {/* ── Top controls ───────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-[60px] z-20 flex items-center gap-2 px-4 py-3">
        {/* Radius selector */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-md">
          <Radar className="size-3.5 text-primary" />
          {radiusOptions.map((r) => (
            <button
              key={r.value}
              onClick={() => setRadius(r.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                radius === r.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Available toggle */}
        <button
          onClick={() => setView(view === "available" ? "map" : "available")}
          className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-2 text-xs font-medium backdrop-blur-md transition-colors hover:bg-secondary"
        >
          <Eye className="size-3.5" />
          {view === "available" ? "Mapa" : "Disponíveis"}
        </button>

        {/* Center button */}
        {coords && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("map:center"))}
            className="flex size-9 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-md hover:bg-secondary"
          >
            <Navigation className="size-4 text-primary" />
          </button>
        )}
      </div>

      {/* ── Available services list ─────────────────────────────── */}
      {view === "available" && (
        <div className="fixed inset-x-0 bottom-0 top-[120px] z-20 overflow-y-auto bg-background/95 px-4 pb-8 pt-4 backdrop-blur-md">
          <h2 className="mb-4 text-lg font-semibold">Disponíveis até {radius} km</h2>
          <div className="space-y-3">
            {availableServices
              .filter((s) => s.distance_km <= radius)
              .sort((a, b) => a.distance_km - b.distance_km)
              .map((s) => (
                <article
                  key={s.id}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-secondary/30"
                >
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Sparkles className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{s.provider_name}</p>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {s.service_type === "massagem" ? "Massagem" : "Acompanhante"}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getSubLabel(s.service_type, s.sub_type)} · {s.gender}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-yellow-500 text-yellow-500" /> {s.rating.toFixed(1)}
                      </span>
                      <span>{s.distance_km.toFixed(1)} km</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">R$ {s.price}</p>
                    <Button
                      size="sm"
                      className="mt-1 h-8 text-xs"
                      onClick={() => toast.success(`Interesse enviado para ${s.provider_name}!`)}
                    >
                      Solicitar
                    </Button>
                  </div>
                </article>
              ))}
          </div>
        </div>
      )}

      {/* ── Selected service popup (map marker click) ──────────── */}
      {selectedService && view === "map" && (
        <div className="fixed inset-x-4 bottom-24 z-30 rounded-2xl border border-border bg-card p-4 shadow-xl">
          <button onClick={() => setSelectedService(null)} className="absolute right-3 top-3">
            <X className="size-4 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="font-semibold">{selectedService.provider_name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedService.service_type === "massagem" ? "Massagem" : "Acompanhante"} ·{" "}
                {getSubLabel(selectedService.service_type, selectedService.sub_type)} ·{" "}
                {selectedService.gender}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="size-3 fill-yellow-500 text-yellow-500" />{" "}
                  {selectedService.rating.toFixed(1)}
                </span>
                <span>{selectedService.distance_km.toFixed(1)} km</span>
                <span className="font-bold text-primary">R$ {selectedService.price}</span>
              </div>
            </div>
          </div>
          <Button
            className="mt-3 h-10 w-full"
            onClick={() => {
              toast.success(`Interesse enviado para ${selectedService.provider_name}!`);
              setSelectedService(null);
            }}
          >
            Confirmar interesse
          </Button>
        </div>
      )}

      {/* ── Active requests (on map) ───────────────────────────── */}
      {view === "map" && requests.length > 0 && !selectedService && (
        <div className="fixed inset-x-4 bottom-24 z-20 max-h-48 space-y-2 overflow-y-auto">
          {requests.slice(0, 2).map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card/90 p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{r.service_type}</p>
                <Badge variant="secondary" className="text-[10px]">
                  {r.status === "aberta" ? "Aberta" : "Em andamento"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── FAB ─────────────────────────────────────────────────── */}
      {view === "map" && !selectedService && (
        <Button
          size="lg"
          onClick={() => setView("request")}
          className="fixed bottom-6 left-1/2 z-30 h-14 -translate-x-1/2 rounded-full px-7 text-base shadow-glow"
        >
          <Plus className="mr-1 size-5" /> Solicitar Serviço
        </Button>
      )}

      {/* ── Request bottom sheet ───────────────────────────────── */}
      {view === "request" && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nova solicitação</h2>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fechar"
              onClick={() => { setView("map"); resetForm(); }}
            >
              <X className="size-5" />
            </Button>
          </div>

          <div className="space-y-5">
            {/* Radius */}
            <Field label="Raio de busca">
              <div className="flex gap-2">
                {radiusOptions.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRadius(r.value)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${
                      radius === r.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Service type */}
            <Field label="Tipo de serviço">
              <div className="flex gap-2">
                {(["massagem", "acompanhante"] as ServiceType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setServiceType(t)}
                    className={`flex-1 rounded-xl border py-2.5 text-sm font-medium capitalize transition-all ${
                      serviceType === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            {/* Sub-type */}
            {serviceType && (
              <Field label={serviceType === "massagem" ? "Tipo de massagem" : "Modalidade"}>
                <div className="flex flex-wrap gap-2">
                  {serviceSubTypes[serviceType].map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSubType(s.value)}
                      className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                        subType === s.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {/* Gender multi-select */}
            {subType && (
              <Field label="Preferência de gênero">
                <p className="mb-2 text-xs text-muted-foreground">Selecione um ou mais</p>
                <div className="flex flex-wrap gap-2">
                  {genderOptions.map((g) => {
                    const active = selectedGenders.includes(g.value);
                    return (
                      <button
                        key={g.value}
                        onClick={() => toggleMulti(selectedGenders, setSelectedGenders, g.value)}
                        className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {active && <Check className="size-3.5" />}
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* Extra flags */}
            {selectedGenders.length > 0 && (
              <Field label="Extras (opcional)">
                <div className="flex flex-wrap gap-2">
                  {extraFlags.map((f) => {
                    const active = selectedExtras.includes(f.value);
                    return (
                      <button
                        key={f.value}
                        onClick={() => toggleMulti(selectedExtras, setSelectedExtras, f.value)}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {active && <Check className="size-3" />}
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* Partner toggle */}
            {selectedGenders.length > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Precisa de parceiro?</p>
                  <p className="text-xs text-muted-foreground">Um parceiro pode intermediar a negociação</p>
                </div>
                <Switch checked={wantsPartner} onCheckedChange={setWantsPartner} />
              </div>
            )}

            {/* Submit */}
            {selectedGenders.length > 0 && (
              <Button className="h-13 w-full text-base" disabled={submitting} onClick={handleSubmit}>
                {submitting ? (
                  <Loader2 className="mr-2 size-5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 size-5" />
                )}
                {submitting ? "Enviando..." : "Solicitar atendimento"}
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── Helper ────────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}
