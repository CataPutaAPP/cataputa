import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Percent, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

/**
 * Promoções programadas do parceiro: desconto em % numa janela de horário,
 * em certos dias, limitado a X usos por dia (quartos / clientes).
 * O desconto entra sozinho na reserva enquanto a promoção estiver valendo.
 */
interface Promo {
  id: string; name: string; discount_pct: number; weekdays: number[];
  starts: string; ends: string; max_per_day: number | null; is_active: boolean;
}
const LETRAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const vazio = { id: "", name: "", pct: "20", weekdays: [1, 2, 3, 4] as number[], starts: "12:00", ends: "18:00", max: "", active: true };

export function PartnerPromos({ userId, unidade = "quartos" }: { userId: string; unidade?: string }) {
  const [lista, setLista] = useState<Promo[] | null>(null);
  const [form, setForm] = useState<typeof vazio | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from("partner_promos").select("*").eq("partner_id", userId).order("created_at");
    setLista(error ? [] : ((data as Promo[]) ?? []));
  }, [userId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function salvar() {
    if (!form) return;
    const pct = Number(String(form.pct).replace(",", "."));
    if (!form.name.trim()) return toast.error("Dê um nome à promoção.");
    if (!pct || pct <= 0 || pct > 90) return toast.error("Desconto entre 1% e 90%.");
    if (form.weekdays.length === 0) return toast.error("Escolha ao menos um dia.");
    setSalvando(true);
    const { error } = await supabase.rpc("save_partner_promo", {
      p_id: form.id || null, p_name: form.name.trim(), p_discount_pct: pct,
      p_weekdays: [...form.weekdays].sort(), p_starts: form.starts, p_ends: form.ends,
      p_max_per_day: form.max ? Number(form.max) : null, p_active: form.active,
    });
    setSalvando(false);
    if (error) return toast.error(error.message || "Não foi possível salvar.");
    toast.success("Promoção salva. Ela entra sozinha no horário marcado.");
    setForm(null); carregar();
  }
  async function alternar(p: Promo) {
    const { error } = await supabase.rpc("save_partner_promo", {
      p_id: p.id, p_name: p.name, p_discount_pct: p.discount_pct, p_weekdays: p.weekdays,
      p_starts: p.starts, p_ends: p.ends, p_max_per_day: p.max_per_day, p_active: !p.is_active,
    });
    if (error) return toast.error(error.message);
    carregar();
  }
  async function apagar(p: Promo) {
    if (!confirm(`Apagar a promoção "${p.name}"?`)) return;
    const { error } = await supabase.rpc("delete_partner_promo", { p_id: p.id });
    if (error) return toast.error(error.message);
    carregar();
  }

  if (!lista) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  if (form) return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{form.id ? "Editar promoção" : "Nova promoção"}</h3>
        <Button variant="ghost" size="icon" onClick={() => setForm(null)}><X className="size-5" /></Button>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Nome</p>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Happy hour da tarde" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Desconto (%)</p>
          <Input value={form.pct} inputMode="decimal" onChange={(e) => setForm({ ...form, pct: e.target.value.replace(/[^0-9.,]/g, "") })} />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Limite por dia</p>
          <Input value={form.max} inputMode="numeric" placeholder="Sem limite" onChange={(e) => setForm({ ...form, max: e.target.value.replace(/\D/g, "") })} />
          <p className="text-[11px] text-muted-foreground">Quantos {unidade} com desconto por dia.</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Dias da semana</p>
        <div className="flex gap-1.5">
          {LETRAS.map((l, i) => {
            const on = form.weekdays.includes(i);
            return (
              <button key={i} aria-label={NOMES[i]} aria-pressed={on}
                onClick={() => setForm({ ...form, weekdays: on ? form.weekdays.filter((x) => x !== i) : [...form.weekdays, i] })}
                className={`size-10 flex-1 rounded-full border text-sm font-semibold transition-colors ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
                {l}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold">Horário (Brasília)</p>
        <div className="flex items-center gap-2 text-sm">
          <input type="time" value={form.starts} onChange={(e) => setForm({ ...form, starts: e.target.value })} aria-label="Começa"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
          <span className="text-muted-foreground">às</span>
          <input type="time" value={form.ends} onChange={(e) => setForm({ ...form, ends: e.target.value })} aria-label="Termina"
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2" />
        </div>
        <p className="text-[11px] text-muted-foreground">Pode virar a madrugada (ex.: 22:00 às 04:00).</p>
      </div>
      <Button className="h-12 w-full" disabled={salvando} onClick={salvar}>
        {salvando && <Loader2 className="mr-2 size-4 animate-spin" />} Salvar promoção
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        O desconto entra sozinho na reserva feita dentro do horário, até acabar o limite do dia. O cliente vê o selo de promoção no mapa.
      </p>
      {lista.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Percent className="size-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma promoção programada.</p>
        </div>
      )}
      {lista.map((p) => (
        <article key={p.id} className={`rounded-2xl border border-border bg-card p-4 ${p.is_active ? "" : "opacity-60"}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.weekdays.length === 7 ? "Todos os dias" : [...p.weekdays].sort().map((d) => NOMES[d]).join(", ")}
                {" · "}{p.starts.slice(0, 5)} às {p.ends.slice(0, 5)}
                {" · "}{p.max_per_day ? `até ${p.max_per_day} ${unidade}/dia` : "sem limite"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-green-500/20 px-2.5 py-1 text-sm font-bold text-green-400">−{Number(p.discount_pct)}%</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => setForm({
              id: p.id, name: p.name, pct: String(p.discount_pct), weekdays: p.weekdays, starts: p.starts.slice(0, 5),
              ends: p.ends.slice(0, 5), max: p.max_per_day ? String(p.max_per_day) : "", active: p.is_active,
            })}><Pencil className="mr-1 size-3" />Editar</Button>
            <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => alternar(p)}>{p.is_active ? "Pausar" : "Ativar"}</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive" onClick={() => apagar(p)}><Trash2 className="size-3" /></Button>
          </div>
        </article>
      ))}
      <Button className="h-12 w-full" onClick={() => setForm({ ...vazio })}><Plus className="mr-2 size-5" /> Nova promoção</Button>
    </div>
  );
}
