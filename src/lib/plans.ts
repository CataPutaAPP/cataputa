import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Retorno de my_plan() */
export interface MyPlan {
  plan_code: string | null;
  plan_name: string | null;
  is_beta: boolean;
  billing_enabled: boolean;
  expires_at: string | null;
  can_buy: boolean;
  is_admin: boolean;
  source: string | null;
  card_blocked: boolean;
  boost_until: string | null;
  features: Record<string, number>;
  credits: { chamado: number; turbo: number; impulso: number };
}

export function useMyPlan(enabled = true) {
  const [plan, setPlan] = useState<MyPlan | null>(null);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("my_plan");
    if (!error && data) setPlan(data as MyPlan);
  }, []);
  useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);
  return { plan, refresh };
}

/** -1 = ilimitado; undefined = recurso não se aplica */
export function featureLimit(plan: MyPlan | null, feature: string, fallback: number): number {
  const v = plan?.features?.[feature];
  if (v === undefined || v === null) return fallback;
  return Number(v) < 0 ? Infinity : Number(v);
}
