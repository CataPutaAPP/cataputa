import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase, canal } from "@/lib/supabase";

/**
 * Agenda da clínica: pedidos de horário feitos pelos clientes.
 * A clínica confirma ou recusa. Só depois de confirmar o cliente recebe o WhatsApp do local.
 */
interface Ag {
  id: string; staff_id: string | null; client_id: string; starts_at: string; note: string | null;
  status: "solicitado" | "confirmado" | "recusado" | "cancelado" | "concluido"; discount_pct: number | null;
}
export const quandoBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const ROTULO: Record<Ag["status"], { t: string; c: string }> = {
  solicitado: { t: "Aguardando você", c: "bg-yellow-500/20 text-yellow-400" },
  confirmado: { t: "Confirmado", c: "bg-green-500/20 text-green-400" },
  recusado: { t: "Recusado", c: "bg-secondary text-muted-foreground" },
  cancelado: { t: "Cancelado", c: "bg-secondary text-muted-foreground" },
  concluido: { t: "Atendido", c: "bg-primary/20 text-primary" },
};

export function PartnerAgenda({ userId, onPendentes }: { userId: string; onPendentes?: (n: number) => void }) {
  const [lista, setLista] = useState<Ag[] | null>(null);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [clientes, setClientes] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [verAntigos, setVerAntigos] = useState(false);

  const carregar = useCallback(async () => {
    const desde = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data, error } = await supabase.from("partner_appointments")
      .select("id, staff_id, client_id, starts_at, note, status, discount_pct")
      .eq("partner_id", userId).gte("starts_at", desde).order("starts_at");
    const ags = error ? [] : ((data as Ag[]) ?? []);
    setLista(ags);
    onPendentes?.(ags.filter((a) => a.status === "solicitado").length);
    const [st, cl] = await Promise.all([
      supabase.from("partner_staff").select("id, name").eq("partner_id", userId),
      ags.length ? supabase.from("profiles").select("id, full_name, username").in("id", [...new Set(ags.map((a) => a.client_id))]) : Promise.resolve({ data: [] }),
    ]);
    setNomes(Object.fromEntries(((st.data as { id: string; name: string }[]) ?? []).map((s) => [s.id, s.name])));
    setClientes(Object.fromEntries(((cl.data as { id: string; full_name: string | null; username: string | null }[]) ?? [])
      .map((c) => [c.id, (c.full_name ?? c.username ?? "Cliente").split(" ")[0] ?? "Cliente"])));
  }, [userId, onPendentes]);

  useEffect(() => {
    carregar();
    const ch = canal(`agenda-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "partner_appointments", filter: `partner_id=eq.${userId}` }, () => carregar())
      .subscribe();
    const t = setInterval(carregar, 45000);          // reserva, caso o tempo real não esteja ligado nesta tabela
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [userId, carregar]);

  async function agir(a: Ag, acao: "confirmar" | "recusar" | "concluir" | "cancelar") {
    if (acao === "recusar" && !confirm("Recusar este pedido? O cliente é avisado.")) return;
    if (acao === "cancelar" && !confirm("Cancelar este horário já confirmado? O cliente é avisado.")) return;
    setOcupado(a.id);
    const { error } = await supabase.rpc("partner_appointment_action", { p_id: a.id, p_action: acao });
    setOcupado(null);
    if (error) return toast.error(error.message);
    toast.success(acao === "confirmar" ? "Confirmado. O cliente recebeu seu WhatsApp." : "Feito.");
    carregar();
  }

  if (!lista) return <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-primary" /></div>;

  const abertos = lista.filter((a) => a.status === "solicitado" || a.status === "confirmado");
  const antigos = lista.filter((a) => !abertos.includes(a)).reverse();

  const Cartao = ({ a }: { a: Ag }) => (
    <article className={`rounded-2xl border bg-card p-4 ${a.status === "solicitado" ? "border-yellow-500/40" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold capitalize">{quandoBR(a.starts_at)}</p>
          <p className="text-xs text-muted-foreground">
            {a.staff_id ? (nomes[a.staff_id] ?? "Equipe") : "Equipe"} · cliente {clientes[a.client_id] ?? "…"}
            {a.discount_pct ? ` · promoção −${Number(a.discount_pct)}%` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ROTULO[a.status].c}`}>{ROTULO[a.status].t}</span>
      </div>
      {a.note && <p className="mt-2 rounded-xl bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">"{a.note}"</p>}
      {a.status === "solicitado" && (
        <div className="mt-3 flex gap-2">
          <Button className="h-10 flex-1" disabled={ocupado === a.id} onClick={() => agir(a, "confirmar")}><Check className="mr-1 size-4" />Confirmar</Button>
          <Button className="h-10 flex-1" variant="secondary" disabled={ocupado === a.id} onClick={() => agir(a, "recusar")}><X className="mr-1 size-4" />Recusar</Button>
        </div>
      )}
      {a.status === "confirmado" && (
        <div className="mt-3 flex gap-2">
          <Button className="h-9 flex-1 text-xs" variant="secondary" disabled={ocupado === a.id} onClick={() => agir(a, "concluir")}>Marcar como atendido</Button>
          <Button className="h-9 text-xs text-destructive" variant="ghost" disabled={ocupado === a.id} onClick={() => agir(a, "cancelar")}>Cancelar</Button>
        </div>
      )}
    </article>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Horários de Brasília. Ao confirmar, o cliente recebe o WhatsApp do local para combinar os detalhes. O pagamento é direto com você.
      </p>
      {abertos.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <CalendarClock className="size-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum pedido de horário no momento.</p>
        </div>
      )}
      {abertos.map((a) => <Cartao key={a.id} a={a} />)}
      {antigos.length > 0 && (
        <button onClick={() => setVerAntigos(!verAntigos)} className="w-full py-2 text-xs font-medium text-muted-foreground">
          {verAntigos ? "Ocultar encerrados" : `Ver encerrados dos últimos 7 dias (${antigos.length})`}
        </button>
      )}
      {verAntigos && antigos.map((a) => <Cartao key={a.id} a={a} />)}
    </div>
  );
}
