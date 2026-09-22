import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Taxa atual do prestador conforme a nota (5 / 7 / 10%). Fonte: get_provider_fee_pct no banco. */
export function useProviderFeePct(providerId: string | undefined | null) {
  const [pct, setPct] = useState<number>(10);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!providerId) return;
    let alive = true;
    supabase.rpc("get_provider_fee_pct", { p_provider_id: providerId }).then(({ data, error }) => {
      if (!alive) return;
      if (!error && data != null) setPct(Number(data));
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [providerId]);
  return { pct, loaded };
}

export const netAfterFee = (price: number, pct: number) => Math.round(price * (1 - pct / 100) * 100) / 100;

export const brl = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Retorno de quote_proposal() */
export interface ProposalQuote {
  service_price: number;
  client_fee_pct: number;
  client_fee: number;
  room_price: number;
  client_total: number;
  provider_fee_pct: number;
  provider_net: number;
  partner_net: number;
  platform_total: number;
}
