import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Chaves gerais do app, ligadas e desligadas no Admin → Resumo.
 *  - rooms: reserva de quartos de parceiros pelo app
 *  - clinicStaff: equipe com foto + agenda de clínicas
 * Com a chave desligada, o parceiro aparece só como vitrine no mapa.
 * Enquanto carrega, vale o modo mais contido (tudo desligado).
 */
export interface Flags { rooms: boolean; clinicStaff: boolean; pronto: boolean }
let guardado: Flags | null = null;
let pedido: Promise<Flags> | null = null;

function buscar(): Promise<Flags> {
  if (!pedido) {
    pedido = Promise.resolve(supabase.rpc("app_flags")).then(({ data, error }) => {
      // banco ainda sem as chaves: comporta-se como antes
      const f: Flags = error || !data
        ? { rooms: true, clinicStaff: true, pronto: true }
        : { rooms: !!(data as { rooms?: boolean }).rooms, clinicStaff: !!(data as { clinic_staff?: boolean }).clinic_staff, pronto: true };
      guardado = f;
      return f;
    });
  }
  return pedido;
}

export function useFlags(): Flags {
  const [f, setF] = useState<Flags>(guardado ?? { rooms: false, clinicStaff: false, pronto: false });
  useEffect(() => { let vivo = true; buscar().then((x) => { if (vivo) setF(x); }); return () => { vivo = false; }; }, []);
  return f;
}
