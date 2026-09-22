import { useEffect, useState } from "react";
import { Star, Lock, Loader2, MessageSquareQuote } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Review { created_at: string; stars: number; comment: string | null; author_name: string | null; bloqueado: boolean }
interface Summary { total: number; media: number; estrela5: number; estrela4: number; estrela3: number; estrela2: number; estrela1: number }

/** Avaliações do prestador. Comentários são um recurso do CataPuta Pass. */
export function ProviderReviews({ providerId }: { providerId: string }) {
  const [rows, setRows] = useState<Review[] | null>(null);
  const [sum, setSum] = useState<Summary | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.rpc("provider_reviews", { p_provider_id: providerId, p_limit: 20 }),
      supabase.rpc("rating_summary", { p_user_id: providerId }),
    ]).then(([r, s]) => {
      if (!alive) return;
      setRows((r.data as Review[]) ?? []);
      setSum((s.data as Summary) ?? null);
    });
    return () => { alive = false; };
  }, [providerId]);

  if (!rows) return <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-primary" /></div>;
  if (rows.length === 0) return <p className="py-4 text-center text-xs text-muted-foreground">Ainda sem avaliações.</p>;

  const bloqueado = rows[0]?.bloqueado;
  const barras: [number, number][] = sum
    ? [[5, sum.estrela5], [4, sum.estrela4], [3, sum.estrela3], [2, sum.estrela2], [1, sum.estrela1]]
    : [];

  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <MessageSquareQuote className="size-4" /> Avaliações {sum ? `(${sum.total})` : ""}
      </h4>

      {sum && sum.total > 0 && (
        <div className="space-y-1 rounded-xl border border-border bg-card p-3">
          {barras.map(([estrela, qtd]) => (
            <div key={estrela} className="flex items-center gap-2 text-[11px]">
              <span className="w-3 text-muted-foreground">{estrela}</span>
              <Star className="size-3 fill-yellow-500 text-yellow-500" />
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-yellow-500" style={{ width: `${sum.total ? (qtd / sum.total) * 100 : 0}%` }} />
              </div>
              <span className="w-5 text-right text-muted-foreground">{qtd}</span>
            </div>
          ))}
        </div>
      )}

      {bloqueado && (
        <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs">
          <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>Os comentários das avaliações fazem parte do <b className="text-primary">CataPuta Pass</b>. Assine no ícone da coroa.</span>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`size-3.5 ${n <= Number(r.stars) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("pt-BR")}
              </span>
            </div>
            {r.comment
              ? <p className="mt-1.5 text-sm">{r.comment}{r.author_name ? <span className="text-xs text-muted-foreground"> — {r.author_name}</span> : null}</p>
              : <p className="mt-1.5 text-xs italic text-muted-foreground">Comentário disponível no Pass</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
