import { useCallback, useEffect, useState } from "react";
import { BarChart3, Eye, Send, CheckCircle2, Wallet, Lock, Loader2, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { brl } from "@/lib/fees";

interface Stats {
  dias: number; completo: boolean; concluidos: number; nota: number;
  visualizacoes: number | null; propostas: number | null; aceitas: number | null;
  taxa_aceite: number | null; faturamento: number | null; ticket_medio: number | null;
  impulso_ate: string | null; online: boolean;
}

const periodos = [7, 30, 90];

/** Estatísticas do prestador — números completos fazem parte do plano Pro. */
export function ProviderStats() {
  const [dias, setDias] = useState(30);
  const [s, setS] = useState<Stats | null>(null);
  const [serie, setSerie] = useState<{ dia: string; visualizacoes: number }[]>([]);

  const load = useCallback(async () => {
    setS(null);
    const { data } = await supabase.rpc("provider_stats", { p_days: dias });
    const st = data as Stats | null;
    setS(st);
    if (st?.completo) {
      const { data: sr } = await supabase.rpc("provider_views_series", { p_days: Math.min(dias, 14) });
      setSerie((sr as { dia: string; visualizacoes: number }[]) ?? []);
    } else setSerie([]);
  }, [dias]);
  useEffect(() => { load(); }, [load]);

  if (!s) return <div className="flex justify-center py-8"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const maxV = Math.max(1, ...serie.map((d) => d.visualizacoes));
  const Item = ({ icon, label, value, locked = false }: { icon: React.ReactNode; label: string; value: string; locked?: boolean }) => (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</p>
      <p className={`mt-1 text-lg font-bold ${locked ? "text-muted-foreground/40" : ""}`}>{locked ? "—" : value}</p>
    </div>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold"><BarChart3 className="size-4 text-primary" /> Suas estatísticas</h3>
        <div className="flex gap-1">
          {periodos.map((d) => (
            <button key={d} onClick={() => setDias(d)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${dias === d ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Item icon={<CheckCircle2 className="size-3" />} label="Atendimentos concluídos" value={String(s.concluidos)} />
        <Item icon={<Star className="size-3" />} label="Sua nota" value={Number(s.nota ?? 0).toFixed(1)} />
        <Item icon={<Eye className="size-3" />} label="Visitas ao perfil" value={String(s.visualizacoes ?? 0)} locked={!s.completo} />
        <Item icon={<Send className="size-3" />} label="Propostas enviadas" value={String(s.propostas ?? 0)} locked={!s.completo} />
        <Item icon={<CheckCircle2 className="size-3" />} label="Taxa de aceite" value={`${s.taxa_aceite ?? 0}%`} locked={!s.completo} />
        <Item icon={<Wallet className="size-3" />} label="Você recebeu" value={brl(s.faturamento ?? 0)} locked={!s.completo} />
      </div>

      {s.completo ? (
        serie.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="mb-2 text-[11px] text-muted-foreground">Visitas por dia</p>
            <div className="flex h-20 items-end gap-1">
              {serie.map((d) => (
                <div key={d.dia} className="flex flex-1 flex-col items-center gap-1" title={`${d.visualizacoes} em ${new Date(d.dia).toLocaleDateString("pt-BR")}`}>
                  <div className="w-full rounded-t bg-primary/70" style={{ height: `${(d.visualizacoes / maxV) * 100}%`, minHeight: d.visualizacoes ? 4 : 1 }} />
                  <span className="text-[9px] text-muted-foreground">{new Date(d.dia).getDate()}</span>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>Visitas, propostas, taxa de aceite e faturamento fazem parte do plano <b className="text-primary">Pro</b>. Veja no ícone da coroa.</span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        O valor das propostas é 100% seu — o CataPuta não cobra comissão sobre atendimentos.
      </p>
    </section>
  );
}
