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
  Home,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/DashboardShell";
import { LeafletMap, type MapCoords, type MapMarker } from "@/components/LeafletMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import type { ServiceRequest } from "@/types";
import {
  type ServiceType,
  type LocalOption,
  serviceSubTypes,
  serviceFlags,
  genderOptions,
  radiusOptions,
  localOptions,
  getSubLabel,
} from "@/lib/service-options";

export const Route = createFileRoute("/cliente")({
  head: () => ({
    meta: [
      { title: "Painel do cliente — ServiHub" },
      {
        name: "description",
        content: "Solicite serviços, defina urgência e acompanhe suas solicitações ativas.",
      },
    ],
  }),
  component: ClienteDashboard,
});

/* ─── Mock data ─────────────────────────────────────────────────────── */

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
  has_local: boolean;
  flags: string[];
}

function generateMockServices(lat: number, lng: number): AvailableService[] {
  const names = ["Luna", "Valentina", "Isabela", "Camila", "Rafael", "Lucas", "Alexia", "Bianca", "Dani", "Chris"];
  const genders = ["mulheres", "homens", "travesti"];
  const types: ServiceType[] = ["massagem", "acompanhante"];
  return Array.from({ length: 8 }, (_, i) => {
    const type = types[i % 2];
    const subs = serviceSubTypes[type];
    const mockFlags = serviceFlags
      .filter(() => Math.random() > 0.5)
      .slice(0, 4 + Math.floor(Math.random() * 4))
      .map((f) => f.value);
    return {
      id: `mock-${i}`,
      provider_name: names[i % names.length],
      service_type: type,
      sub_type: subs[Math.floor(Math.random() * subs.length)].value,
      gender: genders[Math.floor(Math.random() * genders.length)],
      rating: 3.5 + Math.random() * 1.5,
      price: 100 + Math.floor(Math.random() * 400),
      distance_km: 0.5 + Math.random() * 9.5,
      lat: lat + (Math.random() - 0.5) * 0.08,
      lng: lng + (Math.random() - 0.5) * 0.08,
      has_local: Math.random() > 0.4,
      flags: mockFlags,
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
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [localChoice, setLocalChoice] = useState<LocalOption | "">("");
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleCoordsChange = useCallback((c: MapCoords) => setCoords(c), []);

  useEffect(() => {
    if (coords) setAvailableServices(generateMockServices(coords.lat, coords.lng));
  }, [coords?.lat, coords?.lng]);

  // Reset downstream when upstream changes
  useEffect(() => { setSubType(""); setSelectedFlags([]); setLocalChoice(""); setSelectedGenders([]); }, [serviceType]);
  useEffect(() => { setSelectedFlags([]); setLocalChoice(""); setSelectedGenders([]); }, [subType]);
  useEffect(() => { setSelectedGenders([]); }, [localChoice]);

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

  function toggleArr(arr: string[], set: (v: string[]) => void, val: string) {
    set(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  function resetForm() {
    setServiceType("");
    setSubType("");
    setSelectedFlags([]);
    setLocalChoice("");
    setSelectedGenders([]);
  }

  // Should we show the flags step? Only for acompanhante
  const showFlags = serviceType === "acompanhante" && !!subType;
  // Can we proceed past flags? For massagem: subType is enough. For acompanhante: need flags selected
  const flagsComplete = serviceType === "massagem" ? !!subType : selectedFlags.length > 0;

  async function handleSubmit() {
    if (!serviceType || !subType) return toast.error("Selecione o tipo e subtipo de serviço.");
    if (serviceType === "acompanhante" && selectedFlags.length === 0) return toast.error("Selecione ao menos um serviço oferecido.");
    if (!localChoice) return toast.error("Selecione onde será o atendimento.");
    if (selectedGenders.length === 0) return toast.error("Selecione ao menos uma preferência de gênero.");

    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 800));

    const localLabel = localChoice === "local_atendente" ? "Local do atendente" : "Parceiro";
    const flagLabels = selectedFlags.map((f) => serviceFlags.find((x) => x.value === f)?.label ?? f);

    const request: ServiceRequest = {
      id: crypto.randomUUID(),
      client_id: user?.id ?? "",
      client_name: user?.full_name ?? "Visitante",
      service_type: `${serviceType} — ${getSubLabel(serviceType, subType)}`,
      description: [
        `Gênero: ${selectedGenders.join(", ")}`,
        `Local: ${localLabel}`,
        flagLabels.length > 0 ? `Serviços: ${flagLabels.join(", ")}` : "",
      ].filter(Boolean).join(" | "),
      location: coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "N/D",
      urgency: "media",
      status: "aberta",
      wants_partner: localChoice === "parceiro",
      created_at: new Date().toISOString(),
    };
    setRequests((p) => [request, ...p]);
    setSubmitting(false);
    resetForm();
    setView("map");
    toast.success("Solicitação enviada! Prestadores no raio foram notificados.");
  }

  return (
    <main className="relative min-h-screen" style={{ background: "#0a0a12" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <LeafletMap onCoordsChange={handleCoordsChange} markers={mapMarkers} radiusKm={radius} />
      </div>

      {/* ── Top controls ───────────────────────────────────────── */}
      <div className="fixed inset-x-0 top-[60px] z-20 flex items-center gap-2 px-4 py-3">
        <div className="flex items-center gap-1 rounded-full border border-border bg-background/80 px-3 py-1.5 backdrop-blur-md">
          <Radar className="size-3.5 text-primary" />
          {radiusOptions.map((r) => (
            <button key={r.value} onClick={() => setRadius(r.value)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${radius === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {r.label}
            </button>
          ))}
        </div>
        <button onClick={() => setView(view === "available" ? "map" : "available")} className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-2 text-xs font-medium backdrop-blur-md hover:bg-secondary">
          <Eye className="size-3.5" />{view === "available" ? "Mapa" : "Disponíveis"}
        </button>
        {coords && (
          <button onClick={() => window.dispatchEvent(new CustomEvent("map:center"))} className="flex size-9 items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur-md hover:bg-secondary">
            <Navigation className="size-4 text-primary" />
          </button>
        )}
      </div>

      {/* ── Available list ─────────────────────────────────────── */}
      {view === "available" && (
        <div className="fixed inset-x-0 bottom-0 top-[120px] z-20 overflow-y-auto bg-background/95 px-4 pb-8 pt-4 backdrop-blur-md">
          <h2 className="mb-4 text-lg font-semibold">Disponíveis até {radius} km</h2>
          <div className="space-y-3">
            {availableServices
              .filter((s) => s.distance_km <= radius)
              .sort((a, b) => a.distance_km - b.distance_km)
              .map((s) => (
                <article key={s.id} className="rounded-2xl border border-border bg-card p-4 hover:bg-secondary/30">
                  <div className="flex items-center gap-4">
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
                      <p className="mt-0.5 text-xs text-muted-foreground">{getSubLabel(s.service_type, s.sub_type)} · {s.gender}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" /> {s.rating.toFixed(1)}</span>
                        <span>{s.distance_km.toFixed(1)} km</span>
                        {s.has_local && <span className="flex items-center gap-1 text-primary"><Home className="size-3" /> Tem local</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">R$ {s.price}</p>
                      <Button size="sm" className="mt-1 h-8 text-xs" onClick={() => toast.success(`Interesse enviado para ${s.provider_name}!`)}>Solicitar</Button>
                    </div>
                  </div>
                  {/* Flags do prestador */}
                  {s.flags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
                      {s.flags.map((f) => (
                        <span key={f} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                          {serviceFlags.find((x) => x.value === f)?.label ?? f}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
          </div>
        </div>
      )}

      {/* ── Selected service popup ─────────────────────────────── */}
      {selectedService && view === "map" && (
        <div className="fixed inset-x-4 bottom-24 z-30 rounded-2xl border border-border bg-card p-4 shadow-xl">
          <button onClick={() => setSelectedService(null)} className="absolute right-3 top-3"><X className="size-4 text-muted-foreground" /></button>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent"><Sparkles className="size-5" /></div>
            <div>
              <p className="font-semibold">{selectedService.provider_name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedService.service_type === "massagem" ? "Massagem" : "Acompanhante"} · {getSubLabel(selectedService.service_type, selectedService.sub_type)} · {selectedService.gender}
              </p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Star className="size-3 fill-yellow-500 text-yellow-500" /> {selectedService.rating.toFixed(1)}</span>
                <span>{selectedService.distance_km.toFixed(1)} km</span>
                <span className="font-bold text-primary">R$ {selectedService.price}</span>
                {selectedService.has_local && <span className="flex items-center gap-1 text-primary"><Home className="size-3" /> Tem local</span>}
              </div>
            </div>
          </div>
          {selectedService.flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {selectedService.flags.map((f) => (
                <span key={f} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  {serviceFlags.find((x) => x.value === f)?.label ?? f}
                </span>
              ))}
            </div>
          )}
          <Button className="mt-3 h-10 w-full" onClick={() => { toast.success(`Interesse enviado para ${selectedService.provider_name}!`); setSelectedService(null); }}>
            Confirmar interesse
          </Button>
        </div>
      )}

      {/* ── Active requests ────────────────────────────────────── */}
      {view === "map" && requests.length > 0 && !selectedService && (
        <div className="fixed inset-x-4 bottom-24 z-20 max-h-48 space-y-2 overflow-y-auto">
          {requests.slice(0, 2).map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card/90 p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{r.service_type}</p>
                <Badge variant="secondary" className="text-[10px]">{r.status === "aberta" ? "Aberta" : "Em andamento"}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{r.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── FAB ─────────────────────────────────────────────────── */}
      {view === "map" && !selectedService && (
        <Button size="lg" onClick={() => setView("request")} className="fixed bottom-6 left-1/2 z-30 h-14 -translate-x-1/2 rounded-full px-7 text-base shadow-glow">
          <Plus className="mr-1 size-5" /> Solicitar Serviço
        </Button>
      )}

      {/* ── Request bottom sheet ───────────────────────────────── */}
      {view === "request" && (
        <div className="fixed inset-x-0 bottom-0 z-40 max-h-[92vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Nova solicitação</h2>
            <Button variant="ghost" size="icon" onClick={() => { setView("map"); resetForm(); }}><X className="size-5" /></Button>
          </div>

          <div className="space-y-5">
            {/* 1. Radius */}
            <Field label="Raio de busca">
              <div className="flex gap-2">
                {radiusOptions.map((r) => (
                  <Chip key={r.value} active={radius === r.value} onClick={() => setRadius(r.value)}>{r.label}</Chip>
                ))}
              </div>
            </Field>

            {/* 2. Service type */}
            <Field label="Tipo de serviço">
              <div className="flex gap-2">
                {(["massagem", "acompanhante"] as ServiceType[]).map((t) => (
                  <Chip key={t} active={serviceType === t} onClick={() => setServiceType(t)} className="capitalize">{t}</Chip>
                ))}
              </div>
            </Field>

            {/* 3. Sub-type */}
            {serviceType && (
              <Field label={serviceType === "massagem" ? "Tipo de massagem" : "Duração / Modalidade"}>
                <div className="flex flex-wrap gap-2">
                  {serviceSubTypes[serviceType].map((s) => (
                    <Pill key={s.value} active={subType === s.value} onClick={() => setSubType(s.value)}>{s.label}</Pill>
                  ))}
                </div>
              </Field>
            )}

            {/* 4. Flags — only for acompanhante */}
            {showFlags && (
              <Field label="O que você procura">
                <p className="mb-2 text-xs text-muted-foreground">Selecione os serviços desejados</p>
                <div className="flex flex-wrap gap-2">
                  {serviceFlags.map((f) => (
                    <Pill key={f.value} active={selectedFlags.includes(f.value)} onClick={() => toggleArr(selectedFlags, setSelectedFlags, f.value)} showCheck small>
                      {f.label}
                    </Pill>
                  ))}
                </div>
              </Field>
            )}

            {/* 5. Local do atendimento */}
            {flagsComplete && (
              <Field label="Local do atendimento">
                <div className="space-y-2">
                  {localOptions.map((opt) => {
                    const active = localChoice === opt.value;
                    const Icon = opt.value === "local_atendente" ? Home : Users;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setLocalChoice(opt.value)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"}`}
                      >
                        <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                          <Icon className="size-5" />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </div>
                        {active && <Check className="size-5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}

            {/* 6. Gender */}
            {localChoice && (
              <Field label="Preferência de gênero">
                <p className="mb-2 text-xs text-muted-foreground">Selecione um ou mais</p>
                <div className="flex flex-wrap gap-2">
                  {genderOptions.map((g) => (
                    <Pill key={g.value} active={selectedGenders.includes(g.value)} onClick={() => toggleArr(selectedGenders, setSelectedGenders, g.value)} showCheck>
                      {g.label}
                    </Pill>
                  ))}
                </div>
              </Field>
            )}

            {/* 7. Submit */}
            {selectedGenders.length > 0 && (
              <Button className="h-13 w-full text-base" disabled={submitting} onClick={handleSubmit}>
                {submitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Sparkles className="mr-2 size-5" />}
                {submitting ? "Enviando..." : "Solicitar atendimento"}
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* ─── UI helpers ────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><p className="text-sm font-semibold">{label}</p>{children}</div>;
}

function Chip({ active, onClick, children, className = "" }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick} className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"} ${className}`}>
      {children}
    </button>
  );
}

function Pill({ active, onClick, children, showCheck = false, small = false }: { active: boolean; onClick: () => void; children: React.ReactNode; showCheck?: boolean; small?: boolean }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-full border font-medium transition-all ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"} ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
      {showCheck && active && <Check className={small ? "size-3" : "size-3.5"} />}
      {children}
    </button>
  );
}
