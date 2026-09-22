import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Loader2, Building2, Clock, MapPin, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { LeafletMap, type MapMarker } from "@/components/LeafletMap";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/fees";

export interface NearbyRoom {
  room_id: string;
  partner_id: string;
  partner_name: string | null;
  local_type: string | null;
  local_address: string | null;
  partner_lat: number;
  partner_lng: number;
  room_name: string;
  room_description: string | null;
  photo_url: string | null;
  price: number;
  duration_minutes: number;
  distance_km: number;
  available: boolean;
}

interface RoomPickerProps {
  requestId: string;
  lat: number;
  lng: number;
  onClose: () => void;
  /** Chamado após book_room ter sucesso */
  onBooked: (room: NearbyRoom) => void;
}

const RADIUS_STEPS = [5, 10, 20];

/**
 * Obrigatório quando o atendimento é em parceiro: o cliente escolhe o quarto
 * ANTES de pagar. A reserva fica "pendente" (segurada ~15 min) e é confirmada
 * automaticamente pelo banco quando o pagamento aceita a proposta.
 */
export function RoomPicker({ requestId, lat, lng, onClose, onBooked }: RoomPickerProps) {
  const [radius, setRadius] = useState(10);
  const [rooms, setRooms] = useState<NearbyRoom[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  const fetchRooms = useCallback(async () => {
    setRooms(null);
    const { data, error } = await supabase.rpc("nearby_partner_rooms", {
      p_lat: lat, p_lng: lng, p_radius_km: radius,
    });
    if (error) { console.error("nearby_partner_rooms", error); toast.error("Erro ao buscar parceiros."); setRooms([]); return; }
    setRooms((data as NearbyRoom[]) ?? []);
  }, [lat, lng, radius]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const markers: MapMarker[] = useMemo(() => {
    const byPartner = new Map<string, NearbyRoom>();
    (rooms ?? []).forEach((r) => { if (!byPartner.has(r.partner_id)) byPartner.set(r.partner_id, r); });
    return [...byPartner.values()].map((r) => ({
      id: r.partner_id,
      lat: r.partner_lat,
      lng: r.partner_lng,
      color: rooms?.some((x) => x.partner_id === r.partner_id && x.room_id === selected) ? "#22c55e" : "#a855f7",
      size: 18,
      onClick: () => {
        const first = rooms?.find((x) => x.partner_id === r.partner_id && x.available);
        if (first) setSelected(first.room_id);
        document.getElementById(`room-${first?.room_id ?? r.room_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      },
    }));
  }, [rooms, selected]);

  async function handleConfirm() {
    const room = rooms?.find((r) => r.room_id === selected);
    if (!room) return;
    setBooking(true);
    const { error } = await supabase.rpc("book_room", { p_request_id: requestId, p_room_id: room.room_id });
    setBooking(false);
    if (error) { toast.error(error.message || "Não foi possível reservar."); fetchRooms(); return; }
    onBooked(room);
  }

  const selectedRoom = rooms?.find((r) => r.room_id === selected);

  return (
    <div className="fixed inset-x-0 bottom-0 top-[76px] z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold">Escolha o local</h2>
          <p className="text-xs text-muted-foreground">Quartos de parceiros próximos ao seu chamado</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="size-5" /></Button>
      </div>

      <div className="relative h-[34vh] shrink-0 overflow-hidden border-y border-border">
        <LeafletMap markers={markers} radiusKm={radius} />
        <div className="absolute left-3 top-3 z-[500] flex gap-1 rounded-full border border-border bg-background/85 p-1 backdrop-blur">
          {RADIUS_STEPS.map((r) => (
            <button key={r} onClick={() => setRadius(r)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${radius === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {r} km
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-32 pt-4">
        {!rooms ? (
          <div className="flex justify-center py-10"><Loader2 className="size-7 animate-spin text-primary" /></div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Building2 className="size-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum parceiro em {radius} km.</p>
            {radius < 20 && <Button variant="secondary" size="sm" onClick={() => setRadius(20)}>Ampliar para 20 km</Button>}
          </div>
        ) : (
          rooms.map((r) => {
            const active = selected === r.room_id;
            return (
              <button key={r.room_id} id={`room-${r.room_id}`} disabled={!r.available}
                onClick={() => setSelected(r.room_id)}
                className={`flex w-full gap-3 rounded-2xl border p-3 text-left transition-all ${
                  !r.available ? "cursor-not-allowed border-border opacity-45"
                  : active ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary"}`}>
                <div className="size-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {r.photo_url
                    ? <img src={r.photo_url} alt={r.room_name} className="size-full object-cover" />
                    : <div className="flex size-full items-center justify-center"><Building2 className="size-7 text-muted-foreground" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-semibold">{r.room_name}</p>
                    <p className="shrink-0 font-bold text-primary">{brl(r.price)}</p>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{r.partner_name ?? "Parceiro"}{r.local_type ? ` · ${r.local_type}` : ""}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-3" /> {r.duration_minutes} min</span>
                    <span className="flex items-center gap-1"><MapPin className="size-3" /> {Number(r.distance_km).toFixed(1)} km</span>
                    {!r.available && <Badge variant="secondary" className="text-[10px]">Ocupado agora</Badge>}
                    {active && <Check className="size-4 text-primary" />}
                  </div>
                </div>
              </button>
            );
          })
        )}
        {rooms && rooms.length > 0 && (
          <button onClick={fetchRooms} className="mx-auto flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className="size-3" /> Atualizar disponibilidade
          </button>
        )}
      </div>

      {selectedRoom && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 p-4 backdrop-blur">
          <p className="mb-2 text-center text-xs text-muted-foreground">
            O valor do quarto ({brl(selectedRoom.price)}) é somado ao total do atendimento.
          </p>
          <Button className="h-13 w-full text-base" disabled={booking} onClick={handleConfirm}>
            {booking ? <Loader2 className="mr-2 size-5 animate-spin" /> : <Check className="mr-2 size-5" />}
            {booking ? "Reservando..." : "Reservar e ir para pagamento"}
          </Button>
        </div>
      )}
    </div>
  );
}
