import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

/**
 * Horário de funcionamento do parceiro (fuso de Brasília).
 * Sem horário definido = aberto 24 h. Fora do horário, o local some do mapa
 * e não recebe reservas.
 */
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
type Dia = { aberto: boolean; opens: string; closes: string };
const PADRAO: Dia = { aberto: true, opens: "10:00", closes: "22:00" };

export function PartnerHours({ userId }: { userId: string }) {
  const [sempre, setSempre] = useState(true);
  const [dias, setDias] = useState<Dia[]>(() => DIAS.map(() => ({ ...PADRAO })));
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("partner_hours").select("weekday, opens, closes").eq("partner_id", userId);
    setCarregando(false);
    if (error || !data || data.length === 0) { setSempre(true); return; }
    setSempre(false);
    setDias(DIAS.map((_, i) => {
      const h = (data as { weekday: number; opens: string; closes: string }[]).find((x) => x.weekday === i);
      return h ? { aberto: true, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) } : { ...PADRAO, aberto: false };
    }));
  }, [userId]);
  useEffect(() => { carregar(); }, [carregar]);

  const mudar = (i: number, parte: Partial<Dia>) => setDias((d) => d.map((x, n) => (n === i ? { ...x, ...parte } : x)));
  const copiarParaTodos = (i: number) => setDias((d) => d.map(() => ({ ...d[i]! })));

  async function salvar() {
    const lista = sempre ? [] : dias.map((d, i) => ({ weekday: i, ...d })).filter((d) => d.aberto)
      .map((d) => ({ weekday: d.weekday, opens: d.opens, closes: d.closes }));
    if (!sempre && lista.length === 0) return toast.error("Marque ao menos um dia aberto, ou escolha 24 horas.");
    setSalvando(true);
    const { error } = await supabase.rpc("set_partner_hours", { p_hours: lista });
    setSalvando(false);
    if (error) return toast.error(error.message || "Não foi possível salvar o horário.");
    toast.success(sempre ? "Aberto 24 horas, todos os dias." : "Horário salvo. Fora dele, seu local sai do mapa.");
  }

  if (carregando) return <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-primary" /></div>;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold"><Clock className="size-4 text-primary" /> Horário de funcionamento</p>
      <p className="mt-1 text-xs text-muted-foreground">Horário de Brasília. Fora do horário seu local não aparece no mapa nem recebe reservas.</p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[{ v: true, t: "24 horas" }, { v: false, t: "Horário definido" }].map((o) => (
          <button key={o.t} onClick={() => setSempre(o.v)}
            className={`rounded-xl border py-2.5 text-sm font-medium transition-colors ${sempre === o.v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
            {o.t}
          </button>
        ))}
      </div>

      {!sempre && (
        <div className="mt-3 space-y-2">
          {DIAS.map((nome, i) => {
            const d = dias[i]!;
            return (
              <div key={nome} className={`flex flex-wrap items-center gap-2 rounded-xl border border-border p-2.5 ${d.aberto ? "" : "opacity-55"}`}>
                <button onClick={() => mudar(i, { aberto: !d.aberto })} aria-pressed={d.aberto}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${d.aberto ? "bg-green-500" : "bg-muted"}`}>
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${d.aberto ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span className="w-20 text-sm font-medium">{nome}</span>
                {d.aberto ? (
                  <span className="ml-auto flex items-center gap-1.5 text-sm">
                    <input type="time" value={d.opens} onChange={(e) => mudar(i, { opens: e.target.value })} aria-label={`${nome} abre`}
                      className="rounded-lg border border-border bg-background px-2 py-1.5" />
                    <span className="text-muted-foreground">às</span>
                    <input type="time" value={d.closes} onChange={(e) => mudar(i, { closes: e.target.value })} aria-label={`${nome} fecha`}
                      className="rounded-lg border border-border bg-background px-2 py-1.5" />
                  </span>
                ) : <span className="ml-auto text-xs text-muted-foreground">Fechado</span>}
                {d.aberto && (
                  <button onClick={() => copiarParaTodos(i)} className="w-full text-right text-[11px] text-primary hover:underline">
                    Usar este horário em todos os dias
                  </button>
                )}
              </div>
            );
          })}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Fecha depois da meia-noite? Coloque a hora de fechar menor que a de abrir (ex.: 18:00 às 06:00).
            Abre e fecha na mesma hora = aberto o dia inteiro.
          </p>
        </div>
      )}

      <Button className="mt-4 h-11 w-full" disabled={salvando} onClick={salvar}>
        {salvando && <Loader2 className="mr-2 size-4 animate-spin" />} Salvar horário
      </Button>
    </section>
  );
}
