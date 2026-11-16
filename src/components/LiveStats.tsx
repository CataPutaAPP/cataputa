import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useT } from "@/lib/i18n";

/**
 * Números da tela de abertura: o que está acontecendo agora + o acumulado.
 * Vêm de uma função do banco que só devolve totais. Atualiza sozinho a cada 30 s.
 * Contador "de agora" que está em zero não aparece (evita cara de lugar vazio).
 */
interface Stats {
  online: number; encontros_agora: number; quartos_reservados: number;
  total_encontros: number; total_reservas: number; total_membros: number;
}

export function LiveStats() {
  const { t } = useT();
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    let vivo = true;
    const buscar = () => supabase.rpc("public_stats").then(({ data, error }) => {
      if (vivo && !error && data && typeof data === "object") setS(data as Stats);
    });
    buscar();
    const timer = setInterval(buscar, 30000);
    return () => { vivo = false; clearInterval(timer); };
  }, []);

  if (!s) return null;
  const agora = [
    { n: s.online, rotulo: t("stats.online") },
    { n: s.encontros_agora, rotulo: t("stats.now") },
    { n: s.quartos_reservados, rotulo: t("stats.rooms") },
  ].filter((x) => Number(x.n) > 0);
  const total = [
    { n: s.total_membros, rotulo: t("stats.members") },
    { n: s.total_encontros, rotulo: t("stats.done") },
    { n: s.total_reservas, rotulo: t("stats.bookings") },
  ].filter((x) => Number(x.n) > 0);
  if (agora.length === 0 && total.length === 0) return null;
  const fmt = (n: number) => Number(n).toLocaleString("pt-BR");

  return (
    <div className="w-full max-w-sm space-y-2">
      {agora.length > 0 && (
        <div className="flex gap-2">
          {agora.map((x) => (
            <div key={x.rotulo} className="flex-1 rounded-2xl border border-border bg-background/70 px-2 py-3 text-center backdrop-blur-md">
              <p className="flex items-center justify-center gap-1.5 font-display text-2xl font-bold text-primary">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-green-400" />
                </span>
                {fmt(x.n)}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{x.rotulo}</p>
            </div>
          ))}
        </div>
      )}
      {total.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground">
          {total.map((x, i) => (
            <span key={x.rotulo}>{i > 0 && " · "}<span className="font-semibold text-foreground">{fmt(x.n)}</span> {x.rotulo}</span>
          ))}
        </p>
      )}
    </div>
  );
}
