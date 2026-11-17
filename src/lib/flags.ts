import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Chaves gerais do app, ligadas e desligadas no Admin → Resumo.
 *  - rooms: reserva de quartos de parceiros pelo app
 *  - clinicStaff: equipe com foto + agenda de clínicas
 *  - requests: chamados (cliente abre pedido, prestadores enviam propostas)
 *  - shorts: feed de vídeos curtos dos anunciantes
 * Com a chave desligada, o recurso some da tela.
 * Enquanto carrega, vale o modo mais contido (tudo desligado).
 */
export interface Flags { rooms: boolean; clinicStaff: boolean; requests: boolean; shorts: boolean; pronto: boolean }
const CONTIDO: Flags = { rooms: false, clinicStaff: false, requests: false, shorts: false, pronto: true };
let guardado: Flags | null = null;
let pedido: Promise<Flags> | null = null;

const ligado = (v: unknown) => v === true || ["1", "true"].includes(String(v).replace(/"/g, ""));

async function consultar(): Promise<Flags> {
  // leitura nova: todas as chaves feature_* de uma vez
  const novo = await supabase.rpc("app_features");
  if (!novo.error && novo.data) {
    const d = novo.data as Record<string, unknown>;
    return {
      rooms: ligado(d["feature_rooms"]),
      clinicStaff: ligado(d["feature_clinic_staff"]),
      // chave ainda não criada no banco: chamados seguem como sempre foram
      requests: d["feature_requests"] === undefined ? true : ligado(d["feature_requests"]),
      shorts: ligado(d["feature_shorts"]),
      pronto: true,
    };
  }
  // banco ainda sem a função nova: usa a antiga (chamados seguem ligados)
  const antigo = await supabase.rpc("app_flags");
  if (antigo.error || !antigo.data) return CONTIDO;
  const a = antigo.data as { rooms?: boolean; clinic_staff?: boolean };
  return { rooms: !!a.rooms, clinicStaff: !!a.clinic_staff, requests: true, shorts: false, pronto: true };
}

function buscar(): Promise<Flags> {
  if (!pedido) {
    pedido = consultar().catch(() => CONTIDO).then((f) => { guardado = f; return f; });
  }
  return pedido;
}

export function useFlags(): Flags {
  const [f, setF] = useState<Flags>(guardado ?? { ...CONTIDO, pronto: false });
  useEffect(() => { let vivo = true; buscar().then((x) => { if (vivo) setF(x); }); return () => { vivo = false; }; }, []);
  return f;
}
