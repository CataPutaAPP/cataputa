import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type Handler = () => void;

/**
 * Escuta mudanças no banco em tempo real e chama onChange.
 * Mantém uma consulta de segurança (fallback) num intervalo largo, para o caso
 * de a conexão cair — o app nunca depende só do tempo real.
 */
export function useRealtime(
  channelName: string,
  subscriptions: { table: string; filter?: string; event?: "INSERT" | "UPDATE" | "DELETE" | "*" }[],
  onChange: Handler,
  { enabled = true, fallbackMs = 60000 }: { enabled?: boolean; fallbackMs?: number } = {},
) {
  // guarda o handler em ref: o pai recria a função a cada render e isso
  // reinscreveria o canal sem necessidade
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = subscriptions.map((s) => `${s.table}:${s.event ?? "*"}:${s.filter ?? ""}`).join("|");

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(channelName);
    subscriptions.forEach((s) => {
      channel.on(
        "postgres_changes",
        { event: s.event ?? "*", schema: "public", table: s.table, ...(s.filter ? { filter: s.filter } : {}) },
        () => cb.current(),
      );
    });
    channel.subscribe();
    const fallback = setInterval(() => cb.current(), fallbackMs);
    return () => { supabase.removeChannel(channel); clearInterval(fallback); };
  }, [channelName, key, enabled, fallbackMs]); // eslint-disable-line react-hooks/exhaustive-deps
}
